use crate::{
    grid::{CellRef, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    wasm_bindings::js::runPython,
    Error, ErrorMsg, Pos, Span,
};

use super::{
    code_cell_update::update_code_cell_value,
    dependencies::Dependencies,
    operation::Operation,
    transaction_summary::TransactionSummary,
    transaction_types::{CellsForArray, JsCodeResult, JsComputeGetCells},
    transactions::Transaction,
    GridController,
};

// only one InProgressTransaction can exist at a time (or no Transaction)

#[derive(Debug, Default, Clone)]
pub struct InProgressTransaction {
    reverse_operations: Vec<Operation>,
    cells_to_compute: Vec<CellRef>,
    pub cursor: Option<String>,
    cells_accessed: Vec<CellRef>,
    summary: TransactionSummary,

    // save code_cell info for async calls
    current_code_cell: Option<CodeCellValue>,
    pub current_cell_ref: Option<CellRef>,
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
            current_cell_ref: None,
            waiting_for_async: None,

            complete: false,
        };

        // run computations
        transaction.transact(grid_controller, operations);

        if compute {
            transaction.loop_compute(grid_controller)
        } else {
            transaction.complete = true
        }

        transaction
    }

    // loop compute cycle until complete or an async call is made
    fn loop_compute(&mut self, grid_controller: &mut GridController) {
        loop {
            self.compute(grid_controller);
            if self.waiting_for_async.is_some() {
                break;
            }
            if self.cells_to_compute.is_empty() {
                self.finalize(grid_controller);
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
            if cfg!(feature = "show-operations") {
                crate::util::dbgjs(&format!("[Operation] {:?}", op.to_string()));
            }

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
    }

    /// gets cells for use in async calculations
    pub fn get_cells(
        &mut self,
        grid_controller: &mut GridController,
        get_cells: JsComputeGetCells,
    ) -> Option<CellsForArray> {
        let sheet_name = get_cells.sheet_name();

        // if sheet_name is None, use the sheet_id from the pos
        let sheet = sheet_name.clone().map_or_else(
            || {
                if self.current_cell_ref.is_none() {
                    panic!("Expected current_sheet_pos to be defined in transaction::get_cells");
                }
                Some(
                    grid_controller
                        .grid
                        .sheet_from_id(self.current_cell_ref.unwrap().sheet),
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
            self.code_cell_error(grid_controller, msg, get_cells.line_number());
            None
        }
    }

    // todo: this should propagate, actually save the error to the cell, and continue the compute loop
    fn code_cell_error(
        &mut self,
        grid_controller: &mut GridController,
        error_msg: String,
        line_number: Option<i64>,
    ) {
        let cell_ref = if let Some(cell_ref) = self.current_cell_ref {
            cell_ref
        } else {
            panic!("Expected current_sheet_pos to be defined in transaction::code_cell_error");
        };
        let mut updated_code_cell_value =
            if let Some(code_cell_value) = self.current_code_cell.clone() {
                code_cell_value
            } else {
                panic!("Expected current_code_cell to be defined in transaction::code_cell_error");
            };
        let msg = ErrorMsg::PythonError(error_msg.clone().into());
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

        updated_code_cell_value.output = Some(CodeCellRunOutput {
            std_out: None,
            std_err: Some(error_msg.into()),
            result,
        });
        crate::util::dbgjs(updated_code_cell_value.clone());
        update_code_cell_value(
            grid_controller,
            cell_ref,
            Some(updated_code_cell_value),
            &mut Some(&mut self.cells_to_compute),
            &mut self.reverse_operations,
            &mut self.summary,
        );
        self.loop_compute(grid_controller);
    }

    /// finalize the compute cycle
    pub fn finalize(&mut self, grid_controller: &mut GridController) {
        if self.cells_to_compute.is_empty() {
            self.complete = true;
            self.summary.save = true;
            let old_deps = if let Some(current_code_cell) = self.current_code_cell.as_ref() {
                current_code_cell.cells_accessed_copy()
            } else {
                None
            };
            let deps = if self.cells_accessed.len() > 0 {
                Some(self.cells_accessed.clone())
            } else {
                None
            };
            if deps != old_deps {
                grid_controller.update_dependent_cells(
                    self.current_cell_ref.unwrap(),
                    deps,
                    old_deps,
                );
            } else if cfg!(feature = "show-operations") {
                crate::util::dbgjs("[Dependent Cells] unchanged");
            }
        }
    }

    /// continues the calculate cycle after an async call
    pub fn calculation_complete(
        &mut self,
        grid_controller: &mut GridController,
        result: JsCodeResult,
    ) {
        if self.complete {
            panic!("Transaction is already complete");
        }
        if cfg!(feature = "show-operations") {
            if let Some(current_cell_ref) = self.current_cell_ref {
                let sheet = grid_controller.sheet(current_cell_ref.sheet);
                if let Some(pos) = sheet.cell_ref_to_pos(current_cell_ref) {
                    crate::util::dbgjs(&format!(
                        "[Compute] Async calculation returned for {:?}",
                        pos
                    ));
                }
                crate::util::dbgjs(format!(
                    "Cells to compute in claculation complete: {}",
                    self.cells_to_compute.len()
                ));
            }
        }
        let (language, code_string) =
            if let Some(old_code_cell_value) = self.current_code_cell.clone() {
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
                    let updated_code_cell_value = result.into_code_cell_value(language, code_string, &self.cells_accessed);
                    let cell_ref = if let Some(sheet_pos) = self.current_cell_ref {
                        sheet_pos
                    } else {
                        panic!("Expected current_sheet_pos to be defined in transaction::complete");
                    };
                    update_code_cell_value(grid_controller, cell_ref, Some(updated_code_cell_value), &mut Some(&mut self.cells_to_compute), &mut self.reverse_operations, &mut self.summary);
                    self.waiting_for_async = None;
                }
                _ => panic!("Transaction.complete called for an unhandled language"),
            }
          }
        }
        // continue the compute loop after a successful async call
        self.loop_compute(grid_controller);
    }

    /// checks the next cell in the cells_to_compute and computes it
    /// returns true if an async call is made or the compute cycle is completed
    fn compute(&mut self, grid_controller: &mut GridController) {
        if cfg!(feature = "show-operations") {
            crate::util::dbgjs(&format!(
                "[Compute] Cells to compute: {}",
                self.cells_to_compute.len()
            ));
        }
        if let Some(cell_ref) = self.cells_to_compute.pop() {
            // todo: this would be a good place to check for cycles
            // add all dependent cells to the cells_to_compute
            if let Some(dependent_cells) = grid_controller.get_dependent_cells(cell_ref) {
                if cfg!(feature = "show-operations") {
                    crate::util::dbgjs(&format!(
                        "[Compute] Add dependencies: {}",
                        Dependencies::to_debug(
                            cell_ref,
                            dependent_cells,
                            grid_controller.grid.sheet_from_id(cell_ref.sheet),
                        ),
                    ));
                }
                self.cells_to_compute.extend(dependent_cells);
            } else {
                crate::util::dbgjs("[Compute] No dependent cells");
            }

            let sheet = grid_controller.grid.sheet_mut_from_id(cell_ref.sheet);
            if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                if cfg!(feature = "show-operations") {
                    crate::util::dbgjs(&format!("[Compute] {:?}", pos));
                }
                // find which cells have code. Run the code and update the cells.
                // add the updated cells to the cells_to_compute

                if let Some(code_cell) = sheet.get_code_cell(pos) {
                    if cfg!(feature = "show-operations") {
                        crate::util::dbgjs("[Compute] Code cell found");
                    }
                    self.current_cell_ref = Some(cell_ref);
                    self.current_code_cell = Some(code_cell.clone());
                    let code_string = code_cell.code_string.clone();
                    let language = code_cell.language;
                    match language {
                        CodeCellLanguage::Python => {
                            // python is run async so we exit the compute cycle and wait for TS to restart the transaction
                            if !cfg!(test) {
                                runPython(code_string);
                            }
                            if cfg!(feature = "show-operations") {
                                crate::util::dbgjs("[Compute] Python code running")
                            }
                            self.waiting_for_async = Some(language);
                        }
                        _ => {
                            crate::util::dbgjs(&format!(
                                "Compute language {} not supported in compute.rs",
                                language
                            ));
                        }
                    }
                }
            }
        }
    }
}

impl Into<Transaction> for InProgressTransaction {
    fn into(self) -> Transaction {
        Transaction {
            ops: self.reverse_operations.into_iter().rev().collect(),
            cursor: self.cursor,
        }
    }
}

impl Into<Transaction> for &mut InProgressTransaction {
    fn into(self) -> Transaction {
        Transaction {
            ops: self.reverse_operations.clone().into_iter().rev().collect(),
            cursor: self.cursor.clone(),
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

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use bigdecimal::BigDecimal;

    use crate::{
        controller::{
            operation::Operation,
            transaction_types::{JsCodeResult, JsComputeGetCells},
            GridController,
        },
        grid::{CodeCellLanguage, CodeCellValue},
        wasm_bindings::controller::cells::CodeCell,
        CellValue, Pos,
    };

    #[test]
    fn test_execute_operation_set_cell_values() {
        let mut gc = GridController::new();
        let sheet_ids = gc.sheet_ids();
        let sheet = gc.grid.sheet_mut_from_id(sheet_ids[0]);
        let sheet_id = sheet.id.clone();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(BigDecimal::from(10)));
        let cell_ref = sheet.get_or_create_cell_ref(Pos { x: 1, y: 0 });
        gc.set_in_progress_transaction(
            vec![Operation::SetCellCode {
                cell_ref,
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Python,
                    code_string: "c(0, 0) + 1".to_string(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
            true,
            crate::controller::transactions::TransactionType::Normal,
        );

        assert_eq!(
            gc.js_get_code_string(sheet_ids[0].to_string(), &Pos { x: 1, y: 0 }),
            Some(CodeCell::new(
                "c(0, 0) + 1".to_string(),
                CodeCellLanguage::Python
            ))
        );
        assert_eq!(gc.in_progress_transaction.is_some(), true);
        if let Some(transaction) = gc.in_progress_transaction.clone() {
            assert_eq!(transaction.complete, false);
            assert_eq!(transaction.cells_to_compute.len(), 0);
        }
        gc.calculation_get_cells(JsComputeGetCells::new(
            crate::Rect::single_pos(Pos { x: 0, y: 0 }),
            None,
            None,
        ));

        let result = JsCodeResult::new(true, None, None, None, Some("10".to_string()), None, None);

        let summary = gc.calculation_complete(result);
        assert_eq!(summary.save, true);
        assert_eq!(summary.code_cells_modified, HashSet::from([sheet_id]));
    }
}
