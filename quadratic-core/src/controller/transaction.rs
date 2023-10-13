use crate::{grid::{CodeCellLanguage, Grid}, wasm_bindings::js::runPython};

use super::{
    compute::SheetPos, operations::Operation, transaction_summary::TransactionSummary,
    GridController,
};

// only one Transaction can exist at a time (or no Transaction)
pub struct Transaction {
    pub reverse_operations: Vec<Operation>,
    pub cells_to_compute: Vec<SheetPos>,
    pub summary: TransactionSummary,
    pub cursor: Option<String>,
    pub waiting_for_async: CodeCellLanguage,
    pub complete: bool,
}

impl Transaction {
    pub fn new(
        grid_controller: &mut GridController,
        operations: Vec<Operation>,
        cursor: Option<String>,
    ) -> Self {
        let mut summary = TransactionSummary::default();
        let mut cells_to_compute: Vec<SheetPos> = vec![];

        let mut reverse_operations =
            grid_controller.transact(operations, &mut cells_to_compute, &mut summary);

        let transaction = Self {
            reverse_operations,
            summary,
            cells_to_compute,
            complete: false,
            cursor,
        };

        transaction
    }

    /// starts the compute cycle and ends when either there are no more cells to compute or an async call was made
    pub fn start(&self, grid_controller: &mut GridController) {
        // loop compute cycle until an async call is made
        loop {
            if self.compute(grid_controller) {
                break;
            }
        }
    }

    /// restarts the compute cycle after an async call is completed
    pub fn restart(&self, grid_controller: &mut GridController, cells: String) {
        if self.complete {
            panic!("Transaction is already complete");
        }
        match self.waiting_for_async {
            CodeCellLanguage::Python => {}
            _ => {
                panic!("Transaction is restarting from an unknown language")
            }
        }
    }

    fn finish(&mut self, grid_controller: &mut GridController) {

    }

    fn

    /// checks the next cell in the cells_to_compute and computes it
    /// returns true if an async call is made or the compute cycle is completed
    fn compute(&mut self, grid_controller: &mut GridController) -> bool {
        if let Some(pos) = self.cells_to_compute.pop() {
            // find which cells have formulas. Run the formulas and update the cells.
            // add the updated cells to the cells_to_compute

            let sheet = grid_controller.grid.sheet_mut_from_id(pos.sheet_id);

            let mut summary_set = vec![];

            if let Some(code_cell) = sheet.get_code_cell(pos.into()) {
                let code_string = code_cell.code_string.clone();
                let language = code_cell.language;

                match language {
                    CodeCellLanguage::Python => {
                        runPython(code_string);
                        return true;
                    }
                        let compute_result =
                            serde_wasm_bindgen::from_value::<JsComputeResult>(result);

                        match compute_result {
                            Ok(compute_result) => {
                                if compute_result.complete {
                                    if let Some(result) = compute_result.result {
                                        code_cell_result = Some(result);
                                    }
                                    complete = true;
                                } else {
                                    // set cells to the requested get-cells for the next while loop
                                    let sheet_name = compute_result.sheet_id;
                                    let sheet = if let Some(sheet_name) = sheet_name {
                                        if let Some(sheet_from_name) =
                                            self.grid.sheet_from_name(sheet_name)
                                        {
                                            sheet_from_name
                                        } else {
                                            // TODO: handle if sheet doesn't exist
                                            self.grid.sheet_mut_from_id(pos.sheet_id)
                                        }
                                    } else {
                                        self.grid.sheet_mut_from_id(pos.sheet_id)
                                    };
                                    if let Some(rect) = compute_result.rect {
                                        let array = sheet.cell_array(rect);
                                        cells_accessed.push(SheetRect {
                                            min: rect.min,
                                            max: rect.max,
                                            sheet_id: sheet.id,
                                        });
                                        for y in rect.y_range() {
                                            for x in rect.x_range() {
                                                if let Some(cell_ref) =
                                                    sheet.try_get_cell_ref(Pos { x, y })
                                                {
                                                    cells_accessed_code_cell.push(cell_ref);
                                                }
                                            }
                                        }
                                        // place results of get-cells into cells for next runPython call
                                        let to_string =
                                            serde_json::to_string::<[CellForArray]>(&array);
                                        match to_string {
                                            Ok(cell_for_array) => {
                                                cells = Some(cell_for_array);
                                            }
                                            Err(_) => cells = None,
                                        }
                                    } else {
                                        cells = None;
                                    }
                                }
                            }
                            Err(e) => {
                                // todo: better handling of error to ensure grid is not locked
                                crate::util::dbgjs(&format!("compute_result error, {}", e));
                                complete = true;
                            }
                        }
                    }
                    _ => {
                        crate::util::dbgjs(&format!(
                            "Compute language {} not supported in compute.rs",
                            language
                        ));
                    }
                }
                let sheet = self.grid.sheet_mut_from_id(pos.sheet_id);
                let code_cell = match code_cell_result {
                    Some(code_cell_result) => Some(CodeCellValue {
                        language,
                        code_string,
                        formatted_code_string: code_cell_result.formatted_code,
                        output: Some(CodeCellRunOutput {
                            std_out: code_cell_result.input_python_std_out,
                            std_err: code_cell_result.error_msg,
                            result: CodeCellRunResult::Ok {
                                output_value: if let Some(array_output) =
                                    code_cell_result.array_output
                                {
                                    Value::Array(array_output.into())
                                } else {
                                    code_cell_result.output_value.into()
                                },
                                cells_accessed: cells_accessed_code_cell,
                            },
                        }),

                        // todo: figure out how to handle modified dates in cells
                        last_modified: String::new(),
                    }),
                    None => None,
                };
                let old_code_cell_value = update_code_cell_value(
                    sheet,
                    pos,
                    code_cell,
                    &mut summary_set,
                    &mut cells_to_compute,
                );
                reverse_operations.push(Operation::SetCellCode {
                    cell_ref: sheet.get_or_create_cell_ref(pos.into()),
                    code_cell_value: old_code_cell_value,
                });
                if !summary_set.is_empty() {
                    summary.operations.push(OperationSummary::SetCellValues(
                        sheet.id.to_string(),
                        summary_set,
                    ));
                }
                summary.code_cells_modified.insert(sheet.id);
                self.grid.set_dependencies(pos, Some(cells_accessed));
            }

            // add all dependent cells to the cells_to_compute
            let dependent_cells = self.grid.get_dependent_cells(pos);

            // add to cells_to_compute
            cells_to_compute.extend(dependent_cells);
            true
        } else {
            self.finish(grid_controller);
            false
        }
    }
}
