use crate::{
    grid::{
        js_types::{JsRenderCellUpdate, JsRenderCellUpdateEnum},
        CellRef, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue,
    },
    wasm_bindings::js::runPython,
    Error, ErrorMsg, Pos, SheetPos, SheetRect, Span, Value,
};

use super::{
    code_cell_update::{fetch_code_cell_difference, update_code_cell_value},
    operations::Operation,
    transaction_summary::{OperationSummary, TransactionSummary},
    transaction_types::{CellsForArray, JsCodeResult, JsComputeGetCells},
    transactions::Transaction,
    GridController,
};

// only one InProgressTransaction can exist at a time (or no Transaction)

#[derive(Debug, Default, Clone)]
pub struct InProgressTransaction {
    reverse_operations: Vec<Operation>,
    cells_to_compute: Vec<SheetPos>,
    pub cursor: Option<String>,
    cells_accessed: Vec<CellRef>,
    summary: TransactionSummary,

    // save code_cell info for async calls
    current_code_cell: Option<CodeCellValue>,
    current_sheet_pos: Option<SheetPos>,
    waiting_for_async: Option<CodeCellLanguage>,

    // true when transaction completes
    pub complete: bool,
}

impl InProgressTransaction {
    /// Creates and runs a new Transaction
    ///
    /// Description
    /// * `compute` triggers the computation cycle
    pub fn new(
        grid_controller: &mut GridController,
        operations: Vec<Operation>,
        cursor: Option<String>,
        compute: bool,
    ) -> Self {
        let mut transaction = Self {
            reverse_operations: vec![],
            summary: TransactionSummary::default(),
            cursor,

            cells_to_compute: vec![],
            cells_accessed: vec![],

            current_code_cell: None,
            current_sheet_pos: None,
            waiting_for_async: None,

            complete: false,
        };

        // run computations
        transaction.transact(grid_controller, operations);

        if compute {
            transaction.loop_compute(grid_controller)
        }

        transaction
    }

    // loop compute cycle until complete or an async call is made
    fn loop_compute(&mut self, grid_controller: &mut GridController) {
        loop {
            if self.compute(grid_controller) {
                break;
            }
        }
    }

    /// returns the TransactionSummary and clears it for future updates
    pub fn transaction_summary(&mut self) -> TransactionSummary {
        let summary = self.summary.clone();
        self.summary.clear();
        summary
    }

    /// executes a set of operations
    fn transact(&mut self, grid_controller: &mut GridController, operations: Vec<Operation>) {
        // todo: move bounds recalculation to somewhere else?
        let mut sheets_with_changed_bounds = vec![];

        for op in operations.iter() {
            if let Some(new_dirty_sheet) = op.sheet_with_changed_bounds() {
                if !sheets_with_changed_bounds.contains(&new_dirty_sheet) {
                    sheets_with_changed_bounds.push(new_dirty_sheet);
                }
            }
            let reverse_operation = grid_controller.execute_operation(
                op.clone(),
                &mut self.cells_to_compute,
                &mut self.summary,
            );
            self.reverse_operations.push(reverse_operation);
        }

        for dirty_sheet in sheets_with_changed_bounds {
            grid_controller
                .grid
                .sheet_mut_from_id(dirty_sheet)
                .recalculate_bounds();
        }

        // todo... return reverse operations?
        // self.reverse_operations.reverse();
        // self.reverse_operations
    }

    pub fn get_cells(
        &self,
        grid_controller: &mut GridController,
        get_cells: JsComputeGetCells,
    ) -> Option<CellsForArray> {
        let sheet_name = get_cells.sheet_name();

        // if sheet_name is None, use the sheet_id from the pos
        let sheet = sheet_name.clone().map_or_else(
            || {
                if self.current_sheet_pos.is_none() {
                    panic!("Expected current_sheet_pos to be defined in transaction::get_cells");
                }
                Some(
                    grid_controller
                        .grid
                        .sheet_from_id(self.current_sheet_pos.unwrap().sheet_id),
                )
            },
            |sheet_name| grid_controller.grid.sheet_from_name(sheet_name),
        );

        if let Some(sheet) = sheet {
            let rect = get_cells.rect();
            let array = sheet.cell_array(rect);
            for y in rect.y_range() {
                for x in rect.x_range() {
                    if let Some(cell_ref) = sheet.try_get_cell_ref(Pos { x, y }) {
                        self.cells_accessed.push(cell_ref);
                    }
                }
            }
            Some(array)
        } else {
            // unable to find sheet by name, generate error
            let msg = if let (Some(sheet_name), Some(line_number)) =
                (sheet_name, get_cells.line_number())
            {
                format!("Sheet '{}' not found at line {}", sheet_name, line_number)
            } else {
                "Sheet not found".to_string()
            };
            self.code_cell_error(grid_controller, &msg, get_cells.line_number());
            None
        }
    }

    fn code_cell_error(
        &mut self,
        grid_controller: &mut GridController,
        error_msg: &str,
        line_number: Option<i64>,
    ) {
        let current_sheet_pos = if let Some(current_sheet_pos) = self.current_sheet_pos {
            current_sheet_pos.clone()
        } else {
            panic!("Expected current_sheet_id to be defined in transaction::code_cell_error");
        };
        let mut code_cell = if let Some(code_cell_value) = self.current_code_cell {
            code_cell_value.clone()
        } else {
            panic!("Expected current_code_cell to be defined in transaction::code_cell_error");
        };
        let sheet = grid_controller
            .grid
            .sheet_mut_from_id(current_sheet_pos.sheet_id);
        let msg = ErrorMsg::PythonError(error_msg.into());
        let span = if let Some(line_number) = line_number {
            Some(Span {
                start: line_number as u32,
                end: line_number as u32,
            })
        } else {
            None
        };
        let error = Error { span, msg };
        let result = CodeCellRunResult::Err { error };

        code_cell.output = Some(CodeCellRunOutput {
            std_out: None,
            std_err: Some(error_msg.into()),
            result,
        });
    }

    /// Sets the value of a code cell and returns the undo value, updates to the UI, and additions to the compute cycle
    fn update_code_cell_value(
        &mut self,
        grid_controller: &mut GridController,
        updated_code_cell_value: CodeCellValue,
        old_code_cell_value: Option<CodeCellValue>,
    ) {
        let current_sheet_pos = if let Some(current_sheet_pos) = self.current_sheet_pos {
            current_sheet_pos.clone()
        } else {
            panic!("Expected current_sheet_id to be defined in transaction::complete");
        };
        let sheet = grid_controller
            .grid
            .sheet_mut_from_id(current_sheet_pos.sheet_id);
        sheet.set_code_cell_value(current_sheet_pos.into(), self.current_code_cell.clone());
        let mut summary_set = &mut vec![];
        if let Some(output) = updated_code_cell_value.output {
            match output.result.output_value() {
                Some(output_value) => {
                    match output_value {
                        Value::Array(array) => {
                            for y in 0..array.size().h.into() {
                                for x in 0..array.size().w.into() {
                                    // add all but the first cell to the compute cycle
                                    if x != 0 && y != 0 {
                                        self.cells_to_compute.push(SheetPos {
                                            x: current_sheet_pos.x + x as i64,
                                            y: current_sheet_pos.y + y as i64,
                                            sheet_id: sheet.id,
                                        });
                                    }
                                    if let Ok(value) = array.get(x, y) {
                                        let entry_pos = Pos {
                                            x: current_sheet_pos.x + x as i64,
                                            y: current_sheet_pos.y + y as i64,
                                        };
                                        let (numeric_format, numeric_decimals) =
                                            sheet.cell_numeric_info(entry_pos);
                                        summary_set.push(JsRenderCellUpdate {
                                            x: current_sheet_pos.x + x as i64,
                                            y: current_sheet_pos.y + y as i64,
                                            update: JsRenderCellUpdateEnum::Value(Some(
                                                value.to_display(numeric_format, numeric_decimals),
                                            )),
                                        });
                                    }
                                }
                            }
                        }
                        Value::Single(value) => {
                            let (numeric_format, numeric_decimals) =
                                sheet.cell_numeric_info(current_sheet_pos.into());
                            summary_set.push(JsRenderCellUpdate {
                                x: current_sheet_pos.x,
                                y: current_sheet_pos.y,
                                update: JsRenderCellUpdateEnum::Value(Some(
                                    value.to_display(numeric_format, numeric_decimals),
                                )),
                            });
                        }
                    };
                }
                None => {
                    summary_set.push(JsRenderCellUpdate {
                        x: current_sheet_pos.x,
                        y: current_sheet_pos.y,
                        update: JsRenderCellUpdateEnum::Value(Some(" ERROR".into())),
                    });
                    summary_set.push(JsRenderCellUpdate {
                        x: current_sheet_pos.x,
                        y: current_sheet_pos.y,
                        update: JsRenderCellUpdateEnum::TextColor(Some("red".into())),
                    });
                    summary_set.push(JsRenderCellUpdate {
                        x: current_sheet_pos.x,
                        y: current_sheet_pos.y,
                        update: JsRenderCellUpdateEnum::Italic(Some(true)),
                    });
                }
            };
        }
        fetch_code_cell_difference(
            sheet,
            current_sheet_pos,
            old_code_cell_value.clone(),
            Some(updated_code_cell_value.clone()),
            summary_set,
            Some(&mut self.cells_to_compute),
        );
        self.reverse_operations.push(Operation::SetCellCode {
            cell_ref: sheet.get_or_create_cell_ref(current_sheet_pos.into()),
            code_cell_value: old_code_cell_value,
        });
        if !summary_set.is_empty() {
            self.summary
                .operations
                .push(OperationSummary::SetCellValues(
                    sheet.id.to_string(),
                    summary_set.clone(),
                ));
        }
        self.summary.code_cells_modified.insert(sheet.id);
        grid_controller.grid.set_dependencies(
            current_sheet_pos,
            Some(
                self.cells_accessed
                    .iter()
                    .filter_map(|cell_ref| {
                        if let Some(pos) = sheet.cell_ref_to_pos(*cell_ref) {
                            Some(SheetRect::single_pos(SheetPos {
                                x: pos.x,
                                y: pos.y,
                                sheet_id: sheet.id,
                            }))
                        } else {
                            None
                        }
                    })
                    .collect(),
            ),
        );
    }

    /// finalizes the compute cycle after an async call
    pub fn complete(&self, grid_controller: &mut GridController, result: JsCodeResult) {
        if self.complete {
            panic!("Transaction is already complete");
        }
        let (language, code_string) = if let Some(old_code_cell_value) = self.current_code_cell {
            (
                old_code_cell_value.language,
                old_code_cell_value.code_string,
            )
        } else {
            panic!("Expected current_code_cell to be defined in transaction::complete");
        };
        match self.waiting_for_async {
          None => panic!("Expected transaction to be waiting_for_async to be defined in transaction::complete"),
          Some(waiting_for_async) => {
            match waiting_for_async {
              CodeCellLanguage::Python => {
                    let updated_code_cell_value = CodeCellValue {
                        language,
                        code_string,
                        formatted_code_string: result.formatted_code(),
                        output: Some(CodeCellRunOutput {
                            std_out: result.input_python_std_out().clone(),
                            std_err: result.error_msg().clone(),
                            result: CodeCellRunResult::Ok {
                                output_value: if let Some(array_output) =
                                    result.array_output().clone()
                                {
                                    Value::Array(array_output.into())
                                } else {
                                    result.output_value().clone().into()
                                },
                                cells_accessed: self.cells_accessed,
                            },
                        }),

                        // todo: figure out how to handle modified dates in cells
                        last_modified: String::new(),
                    };
                    let sheet_pos = if let Some(sheet_pos) = self.current_sheet_pos {
                        sheet_pos
                    } else {
                        panic!("Expected current_sheet_pos to be defined in transaction::complete");
                    };
                    update_code_cell_value(grid_controller, sheet_pos, Some(updated_code_cell_value), Some(&mut self.cells_to_compute), &mut self.reverse_operations, &mut self.summary);

                    // continue the compute loop after a successful async call
                    self.loop_compute(grid_controller);
                }
                _ => panic!("Transaction.complete called for an unhandled language"),
            }
          }
        }
    }

    /// checks the next cell in the cells_to_compute and computes it
    /// returns true if an async call is made or the compute cycle is completed
    fn compute(&mut self, grid_controller: &mut GridController) -> bool {
        if let Some(sheet_pos) = self.cells_to_compute.pop() {
            // find which cells have formulas. Run the formulas and update the cells.
            // add the updated cells to the cells_to_compute
            let sheet = grid_controller.grid.sheet_mut_from_id(sheet_pos.sheet_id);

            if let Some(code_cell) = sheet.get_code_cell(sheet_pos.into()) {
                let code_string = code_cell.code_string.clone();
                let language = code_cell.language;

                match language {
                    CodeCellLanguage::Python => {
                        // python is run async so we exit the compute cycle and wait for TS to restart the transaction
                        runPython(code_string);
                        self.waiting_for_async = Some(language);
                        return true;
                    }
                    _ => {
                        crate::util::dbgjs(&format!(
                            "Compute language {} not supported in compute.rs",
                            language
                        ));
                    }
                }
            }

            // add all dependent cells to the cells_to_compute
            let dependent_cells = grid_controller.grid.get_dependent_cells(sheet_pos);

            // add to cells_to_compute
            self.cells_to_compute.extend(dependent_cells);
            true
        } else {
            self.complete = true;
            false
        }
    }
}

impl Into<Transaction> for InProgressTransaction {
    fn into(self) -> Transaction {
        Transaction {
            ops: self.reverse_operations,
            cursor: self.cursor,
        }
    }
}

impl From<Transaction> for InProgressTransaction {
    fn from(value: Transaction) -> Self {
        Self {
            cursor: value.cursor,
            ..Default::default()
        }
    }
}
