use super::{
    operations::Operation,
    transaction_summary::{OperationSummary, TransactionSummary},
    GridController,
};
use crate::{
    grid::{
        js_types::{CellForArray, JsRenderCellUpdate, JsRenderCellUpdateEnum},
        CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue,
    },
    wasm_bindings::{js::runPython, JsComputeResult},
    Pos, SheetPos, SheetRect, Value,
};

impl GridController {
    /// Given `cell` and `dependencies` adds a new node to the graph.
    /// Returns the old dependencies of the node.
    pub async fn compute(
        &mut self,
        cell_values_modified: Vec<SheetPos>,
        summary: &mut TransactionSummary,
    ) -> Vec<Operation> {
        let mut reverse_operations = vec![];
        let mut cells_to_compute = cell_values_modified.clone(); // start with all updated cells

        while let Some(pos) = cells_to_compute.pop() {
            // find which cells have formulas. Run the formulas and update the cells.
            // add the updated cells to the cells_to_compute

            let sheet = self.grid.sheet_mut_from_id(pos.sheet_id);

            let mut summary_set = vec![];

            if let Some(code_cell) = sheet.get_code_cell(pos.into()) {
                let code_string = code_cell.code_string.clone();
                let language = code_cell.language;

                let mut code_cell_result = None;
                let mut cells_accessed = vec![];
                let mut cells_accessed_code_cell = vec![];
                match language {
                    CodeCellLanguage::Python => {
                        let mut cells = None;
                        let mut complete = false;

                        // loop through runPython handling either get-cells or complete results
                        while !complete {
                            let result = runPython(code_string.clone(), cells.clone()).await;
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
                let old_code_cell_value = sheet.set_code_cell_value(pos.into(), code_cell.clone());
                if let Some(code_cell) = code_cell {
                    if let Some(output) = code_cell.output {
                        if let Some(output_value) = output.result.output_value() {
                            match output_value {
                                Value::Array(array) => {
                                    for y in 0..array.size().h.into() {
                                        for x in 0..array.size().w.into() {
                                            // add all but the first cell to the compute cycle
                                            if x != 0 && y != 0 {
                                                cells_to_compute.push(SheetPos {
                                                    x: pos.x + x as i64,
                                                    y: pos.y + y as i64,
                                                    sheet_id: sheet.id,
                                                });
                                            }
                                            if let Ok(value) = array.get(x, y) {
                                                let entry_pos = Pos {
                                                    x: pos.x + x as i64,
                                                    y: pos.y + y as i64,
                                                };
                                                let (numeric_format, numeric_decimals) =
                                                    sheet.cell_numeric_info(entry_pos);
                                                summary_set.push(JsRenderCellUpdate {
                                                    x: pos.x + x as i64,
                                                    y: pos.y + y as i64,
                                                    update: JsRenderCellUpdateEnum::Value(Some(
                                                        value.to_display(
                                                            numeric_format,
                                                            numeric_decimals,
                                                        ),
                                                    )),
                                                })
                                            }
                                        }
                                    }
                                }
                                Value::Single(value) => {
                                    let (numeric_format, numeric_decimals) =
                                        sheet.cell_numeric_info(pos.into());
                                    summary_set.push(JsRenderCellUpdate {
                                        x: pos.x,
                                        y: pos.y,
                                        update: JsRenderCellUpdateEnum::Value(Some(
                                            value.to_display(numeric_format, numeric_decimals),
                                        )),
                                    });
                                }
                            };
                        }
                    }
                }
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
                self.grid.set_dependencies(pos, Some(cells_accessed));
            }

            // add all dependent cells to the cells_to_compute
            let dependent_cells = self.grid.get_dependent_cells(pos);

            // add to cells_to_compute
            cells_to_compute.extend(dependent_cells);
        }
        reverse_operations
    }
}

#[cfg(test)]
mod test {
    use crate::controller::{transaction_summary::TransactionSummary, GridController};
    use crate::{SheetPos, SheetRect};

    #[tokio::test]
    async fn test_graph() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        gc.grid.set_dependencies(
            SheetPos {
                sheet_id,
                x: 0,
                y: 1,
            },
            Some(vec![SheetRect::single_pos(SheetPos {
                sheet_id,
                x: 0,
                y: 0,
            })]),
        );
        gc.grid.set_dependencies(
            SheetPos {
                sheet_id,
                x: 1,
                y: 1,
            },
            Some(vec![SheetRect::single_pos(SheetPos {
                sheet_id,
                x: 0,
                y: 0,
            })]),
        );
        gc.grid.set_dependencies(
            SheetPos {
                sheet_id,
                x: 0,
                y: 2,
            },
            Some(vec![
                SheetRect::single_pos(SheetPos {
                    sheet_id,
                    x: 0,
                    y: 1,
                }),
                SheetRect::single_pos(SheetPos {
                    sheet_id,
                    x: 1,
                    y: 1,
                }),
            ]),
        );
        gc.grid.set_dependencies(
            SheetPos {
                sheet_id,
                x: 1,
                y: 2,
            },
            Some(vec![
                SheetRect::single_pos(SheetPos {
                    sheet_id,
                    x: 0,
                    y: 0,
                }),
                SheetRect::single_pos(SheetPos {
                    sheet_id,
                    x: 1,
                    y: 1,
                }),
            ]),
        );

        // todo...
        // gc.compute(
        //     vec![SheetPos {
        //         sheet_id,
        //         x: 0,
        //         y: 0,
        //     }],
        //     TransactionSummary::default(),
        // )
        // .await;
    }
}
