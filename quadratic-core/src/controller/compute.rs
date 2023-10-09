use super::{operations::Operation, GridController};
use crate::{
    grid::{
        js_types::CellForArray, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult,
        CodeCellValue, SheetId,
    },
    wasm_bindings::{js::runPython, JsComputeResult},
    Pos, Value,
};
use serde::{Deserialize, Serialize};
use std::{fmt, ops::Range};

impl GridController {
    /// Given `cell` and `dependencies` adds a new node to the graph.
    /// Returns the old dependencies of the node.
    pub async fn compute(&mut self, cell_values_modified: Vec<SheetPos>) -> Vec<Operation> {
        let reverse_operations = vec![];
        let mut cells_to_compute = cell_values_modified.clone(); // start with all updated cells

        while let Some(pos) = cells_to_compute.pop() {
            // find which cells have formulas. Run the formulas and update the cells.
            // add the updated cells to the cells_to_compute

            let sheet = self.grid.sheet_mut_from_id(pos.sheet_id);

            if let Some(code_cell) = sheet.get_code_cell(pos.into()) {
                let code_string = code_cell.code_string.clone();
                let language = code_cell.language;

                let mut code_cell_result = None;
                let mut cells_accessed = vec![];
                let mut cells_accessed_code_cell = vec![];
                match language {
                    CodeCellLanguage::Python => {
                        crate::util::dbgjs(&format!("running {:?}, {:?}", pos.x, pos.y));
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
                if let Some(code_cell_value) = code_cell_result {
                    let sheet = self.grid.sheet_mut_from_id(pos.sheet_id);
                    sheet.set_code_cell_value(
                        pos.into(),
                        Some(CodeCellValue {
                            language,
                            code_string,
                            formatted_code_string: code_cell_value.formatted_code,
                            output: Some(CodeCellRunOutput {
                                std_out: code_cell_value.input_python_std_out,
                                std_err: code_cell_value.error_msg,
                                result: CodeCellRunResult::Ok {
                                    output_value: if let Some(array_output) =
                                        code_cell_value.array_output
                                    {
                                        Value::Array(array_output.into())
                                    } else {
                                        code_cell_value.output_value.into()
                                    },
                                    cells_accessed: cells_accessed_code_cell,
                                },
                            }),
                            last_modified: String::new(),
                        }),
                    );
                    self.grid.set_dependencies(pos, Some(cells_accessed));
                }
            }

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

        gc.compute(vec![SheetPos {
            sheet_id,
            x: 0,
            y: 0,
        }])
        .await;
    }
}
