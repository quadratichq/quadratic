use super::{
    code_cell_value::update_code_cell_value,
    operations::Operation,
    transaction_summary::{OperationSummary, TransactionSummary},
    GridController,
};
use crate::{
    grid::{
        js_types::CellForArray, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult,
        CodeCellValue, SheetId,
    },
    wasm_bindings::{js::runPython, JsCodeResult, JsComputeResult},
    Error, ErrorMsg, Pos, Span, Value,
};

use serde::{Deserialize, Serialize};
use std::{fmt, ops::Range};

impl GridController {
    /// Given `cell` and `dependencies` adds a new node to the graph.
    /// Returns the old dependencies of the node.
    pub async fn compute(
        &mut self,
        cell_values_modified: Vec<SheetPos>,
        summary: &mut TransactionSummary,
    ) -> Vec<Operation> {
        let mut reverse_operations = vec![];
        let mut cells_to_compute = cell_values_modified.clone();

        // start with all updated cells
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

                let to_error = |error_msg: &str| {
                    Some(JsCodeResult {
                        error_msg: Some(error_msg.into()),
                        ..Default::default()
                    })
                };

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

                                        // if sheet_name is None, use the sheet_id from the pos
                                        let sheet = sheet_name.clone().map_or_else(
                                            || Some(self.grid.sheet_from_id(pos.sheet_id)),
                                            |sheet_name| self.grid.sheet_from_name(sheet_name),
                                        );

                                        // unable to find sheet by name, generate error
                                        if sheet.is_none() {
                                            let msg = if let (Some(sheet_name), Some(line_number)) =
                                                (sheet_name, compute_result.line_number)
                                            {
                                                format!(
                                                    "Sheet '{}' not found at line {}",
                                                    sheet_name, line_number
                                                )
                                            } else {
                                                "Sheet not found".to_string()
                                            };
                                            code_cell_result = to_error(&msg);
                                            complete = true;
                                        }

                                        if let Some(sheet) = sheet {
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

                                                cells = to_string.ok();
                                            } else {
                                                cells = None;
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    code_cell_result =
                                        to_error(&format!("compute_result error, {}", e));
                                    complete = true;
                                }
                            }
                        }
                    }
                    _ => {
                        code_cell_result =
                            to_error(&format!("Compute language {} not supported", language));
                    }
                }

                let sheet = self.grid.sheet_mut_from_id(pos.sheet_id);
                let code_cell = match code_cell_result {
                    Some(code_cell_result) => {
                        let result = if code_cell_result.success {
                            CodeCellRunResult::Ok {
                                output_value: if let Some(array_output) =
                                    code_cell_result.array_output.clone()
                                {
                                    Value::Array(array_output.into())
                                } else {
                                    code_cell_result.output_value.clone().into()
                                },
                                cells_accessed: cells_accessed_code_cell.clone(),
                            }
                        } else {
                            let span = code_cell_result
                                .error_span
                                .to_owned().map(|span| Span::from(span));
                            let error_msg = code_cell_result
                                .error_msg
                                .to_owned()
                                .unwrap_or_else(|| "Unknown Python Error".into());
                            let msg = ErrorMsg::PythonError(error_msg.into());
                            let error = Error { span, msg };

                            CodeCellRunResult::Err { error }
                        };

                        Some(CodeCellValue {
                            language,
                            code_string,
                            formatted_code_string: code_cell_result.formatted_code,
                            output: Some(CodeCellRunOutput {
                                std_out: code_cell_result.input_python_std_out,
                                std_err: code_cell_result.error_msg,
                                result,
                            }),

                            // todo: figure out how to handle modified dates in cells
                            last_modified: String::new(),
                        })
                    }
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
            };

            // add all dependent cells to the cells_to_compute
            let dependent_cells = self.grid.get_dependent_cells(pos);

            // add to cells_to_compute
            cells_to_compute.extend(dependent_cells);
        }
        reverse_operations
    }
}

/// Used for referencing a range during computation.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct SheetRect {
    /// Upper-left corner.
    pub min: Pos,
    /// Lower-right corner.
    pub max: Pos,
    /// The sheet that this region is on.
    pub sheet_id: SheetId,
}

impl SheetRect {
    /// Constructs a new rectangle containing only a single cell.
    pub fn single_pos(pos: SheetPos) -> SheetRect {
        SheetRect {
            sheet_id: pos.sheet_id,
            min: Pos { x: pos.x, y: pos.y },
            max: Pos { x: pos.x, y: pos.y },
        }
    }
    /// Returns whether a position is contained within the rectangle.
    pub fn contains(self, pos: SheetPos) -> bool {
        self.sheet_id == pos.sheet_id
            && self.x_range().contains(&pos.x)
            && self.y_range().contains(&pos.y)
    }
    /// Returns whether a rectangle intersects with the rectangle.
    pub fn intersects(self, other: SheetRect) -> bool {
        // https://en.wikipedia.org/wiki/Hyperplane_separation_theorem#:~:text=the%20following%20form%3A-,Separating%20axis%20theorem,-%E2%80%94%C2%A0Two%20closed
        self.sheet_id == other.sheet_id
            && !(other.max.x < self.min.x
                || other.min.x > self.max.x
                || other.max.y < self.min.y
                || other.min.y > self.max.y)
    }
    /// Returns the range of X values in the rectangle.
    pub fn x_range(self) -> Range<i64> {
        self.min.x..self.max.x + 1
    }
    /// Returns the range of Y values in the rectangle.
    pub fn y_range(self) -> Range<i64> {
        self.min.y..self.max.y + 1
    }
}
impl fmt::Display for SheetRect {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Sheet: {}, Min: {}, Max: {}",
            self.sheet_id, self.min, self.max,
        )
    }
}

/// Used for referencing a pos during computation.
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct SheetPos {
    pub x: i64,
    pub y: i64,
    pub sheet_id: SheetId,
}
impl fmt::Display for SheetPos {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ({}, {})", self.sheet_id, self.x, self.y)
    }
}

#[cfg(test)]
mod test {
    use crate::controller::GridController;

    use super::{SheetPos, SheetRect};

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
