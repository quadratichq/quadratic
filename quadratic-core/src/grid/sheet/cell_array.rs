use std::collections::HashSet;

use anyhow::{anyhow, Result};

use crate::{
    controller::execution::run_code::get_cells::{GetCellResponse, GetCellsResponse},
    Array, CellValue, Pos, Rect,
};

use super::Sheet;

impl Sheet {
    pub fn get_cells_response(&self, rect: Rect) -> GetCellsResponse {
        let mut response = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                if let Some(cell) = self.display_value(Pos { x, y }) {
                    response.push(GetCellResponse {
                        x,
                        y,
                        value: cell.to_edit(),
                    });
                } else {
                    response.push(GetCellResponse {
                        x,
                        y,
                        value: "".into(),
                    });
                }
            }
        }
        GetCellsResponse { response }
    }

    // todo: the following two functions are probably in the wrong place

    /// In a given rect, collect all cell values into an array.
    ///
    /// TODO(ddimaria): is this necessary as it's more performant to just pluck the data from the sheet directly
    /// davidfig: regrettably, the Array::new_row_major requires the ordering to be row-based and not column based.
    /// we would need to rework how Array works for this to be more performant.
    pub fn cell_values_in_rect(&self, &selection: &Rect) -> Result<Array> {
        let values = selection
            .y_range()
            .flat_map(|y| {
                selection
                    .x_range()
                    .map(|x| {
                        self.display_value(Pos { x, y })
                            .unwrap_or_else(|| CellValue::Blank)
                    })
                    .collect::<Vec<CellValue>>()
            })
            .collect();

        Array::new_row_major(selection.size(), values).map_err(|e| {
            anyhow!(
                "Could not create array of size {:?}: {:?}",
                selection.size(),
                e
            )
        })
    }

    /// Returns whether a rect has any CellValue within it.
    pub fn has_cell_value_in_rect(&self, rect: &Rect, skip: Option<Pos>) -> bool {
        for x in rect.x_range() {
            if let Some(column) = self.get_column(x) {
                for y in rect.y_range() {
                    let cell_pos = Pos { x, y };
                    if column.values.get(y).is_some_and(|cell| {
                        Some(cell_pos) != skip && !cell.is_blank_or_empty_string()
                    }) {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Returns all positions that caused a spill error in the rect.
    /// Note this assumes there is a spill error with the output = spill_rect, and position in code_pos
    pub fn find_spill_error_reasons(&self, spill_rect: &Rect, code_pos: Pos) -> Vec<Pos> {
        let mut results = HashSet::new();

        // first check cell values
        for x in spill_rect.x_range() {
            if let Some(column) = self.get_column(x) {
                for y in spill_rect.y_range() {
                    let cell_pos = Pos { x, y };
                    if column.values.get(y).is_some_and(|cell| {
                        cell_pos != code_pos && !cell.is_blank_or_empty_string()
                    }) {
                        results.insert(cell_pos);
                    }
                }
            }
        }

        // then check code runs
        for (pos, code_run) in &self.code_runs {
            // once we reach the code_pos, no later code runs can be the cause of the spill error
            if pos == &code_pos {
                break;
            }
            if code_run.output_rect(*pos, true).intersects(*spill_rect) {
                results.insert(*pos);
            }
        }

        results.into_iter().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        controller::GridController,
        grid::{CodeCellLanguage, Sheet},
        CellValue, Pos, Rect, SheetPos,
    };

    #[test]
    fn test_has_cell_values_in_rect() {
        let mut sheet = Sheet::test();
        let rect = Rect::from_numbers(0, 0, 10, 10);
        assert!(!sheet.has_cell_value_in_rect(&rect, None));
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        assert!(sheet.has_cell_value_in_rect(&rect, None));
        assert!(!sheet.has_cell_value_in_rect(&rect, Some(Pos { x: 0, y: 0 })));
    }

    #[test]
    fn test_get_cells_response() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 1, y: 0 }, CellValue::Number(2.into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(3.into()));
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(4.into()));
        let response = sheet.get_cells_response(Rect::from_numbers(0, 0, 2, 2));
        assert_eq!(
            response,
            GetCellsResponse {
                response: vec![
                    GetCellResponse {
                        x: 0,
                        y: 0,
                        value: "1".into(),
                    },
                    GetCellResponse {
                        x: 1,
                        y: 0,
                        value: "2".into(),
                    },
                    GetCellResponse {
                        x: 0,
                        y: 1,
                        value: "3".into(),
                    },
                    GetCellResponse {
                        x: 1,
                        y: 1,
                        value: "4".into(),
                    },
                ],
            }
        );
    }

    #[test]
    fn test_find_spill_error_reasons() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "causes spill error".into(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "1 + 1".into(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3}".into(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let run = sheet.code_run(Pos { x: 0, y: 0 }).unwrap();
        assert!(run.spill_error);
        let reasons = sheet.find_spill_error_reasons(
            &run.output_rect(Pos { x: 0, y: 0 }, true),
            Pos { x: 0, y: 0 },
        );
        assert_eq!(reasons.len(), 2);
        assert!(reasons.iter().any(|p| *p == Pos { x: 1, y: 0 }));
        assert!(reasons.iter().any(|p| *p == Pos { x: 2, y: 0 }));
    }
}
