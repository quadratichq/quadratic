use super::{operations::Operation, GridController};
use crate::{
    grid::{
        js_types::CellForArray, CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult,
        CodeCellValue, SheetId,
    },
    wasm_bindings::{
        js::{self, runPython},
        JsCodeResult,
    },
    Pos, Rect,
};
use serde::{Deserialize, Serialize};
use std::{fmt, ops::Range};
use wasm_bindgen::prelude::Closure;

impl GridController {
    /// Given `cell` and `dependencies` adds a new node to the graph.
    /// Returns the old dependencies of the node.
    pub async fn compute(&mut self, updated_cells: Vec<SheetRect>) -> Vec<Operation> {
        let reverse_operations = vec![];
        let mut cells_to_compute = updated_cells.clone(); // start with all updated cells

        while let Some(rect) = cells_to_compute.pop() {
            js::log(&format!("Computing cell - {} \n", rect));
            // find which cells have formulas. Run the formulas and update the cells.
            // add the updated cells to the cells_to_compute
            let grid = self.grid.clone();
            let sheet = self.grid.sheet_mut_from_id(rect.sheet_id);

            for y in rect.y_range() {
                for x in rect.x_range() {
                    let pos = Pos { x, y };
                    if let Some(code_cell) = sheet.get_code_cell(pos) {
                        match code_cell.language {
                            CodeCellLanguage::Python => {
                                // todo: remove this clone and move to a while of awaits to pass control back and forth to TS to avoid mem copies
                                let grid = grid.clone();
                                let current_sheet_id = sheet.id.to_string();

                                let get_cells =
                                    Closure::new(move |rect: Rect, sheet_name: Option<String>| {
                                        // convert sheet_name to id or use current code's sheet
                                        let sheet = if let Some(sheet_name) = sheet_name {
                                            if let Some(sheet_from_name) =
                                                grid.sheet_from_name(sheet_name)
                                            {
                                                sheet_from_name
                                            } else {
                                                grid.sheet_from_string(current_sheet_id.clone())
                                            }
                                        } else {
                                            grid.sheet_from_string(current_sheet_id.clone())
                                        };

                                        let array = sheet.cell_array(rect);
                                        Ok(serde_json::to_string::<[CellForArray]>(&array)
                                            .map_err(|e| e.to_string())?)
                                    });

                                let result =
                                    runPython(code_cell.code_string.clone(), &get_cells).await;
                                js::log(&format!("{:?}", result));
                                let code_cell_value =
                                    serde_wasm_bindgen::from_value::<JsCodeResult>(result);
                                match code_cell_value {
                                    Ok(code_cell_value) => {
                                        sheet.set_code_cell_value(
                                            pos,
                                            Some(CodeCellValue {
                                                language: code_cell.language,
                                                code_string: code_cell.code_string.clone(),
                                                formatted_code_string: code_cell_value
                                                    .formatted_code,
                                                output: Some(CodeCellRunOutput {
                                                    std_out: code_cell_value.input_python_std_out,
                                                    std_err: code_cell_value.error_msg,
                                                    result: CodeCellRunResult::Ok {
                                                        output_value: code_cell_value
                                                            .output_value
                                                            .into(),

                                                        // todo...
                                                        cells_accessed: vec![],
                                                    },
                                                }),
                                                last_modified: String::new(),
                                            }),
                                        );
                                    }
                                    Err(e) => js::log(&format!("Error: {:?}", e)),
                                }
                            }
                            _ => {
                                js::log(&format!(
                                    "Compute language {} not supported in compute.rs",
                                    code_cell.language
                                ));
                            }
                        }
                    }
                }
            }

            // add all dependent cells to the cells_to_compute
            let dependent_cells = self.grid.get_dependent_cells(rect);

            // loop through all dependent cells
            for dependent_cell in dependent_cells {
                // add to cells_to_compute
                cells_to_compute.push(SheetRect::single_pos(dependent_cell));
            }
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

    #[actix_rt::test]
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

        gc.compute(vec![SheetRect::single_pos(SheetPos {
            sheet_id,
            x: 0,
            y: 0,
        })])
        .await;
    }
}
