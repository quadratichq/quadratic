use std::collections::HashSet;

use anyhow::{Result, anyhow};

use crate::{
    Array, CellValue, Pos, Rect, controller::execution::run_code::get_cells::JsCellsA1Value,
};

use super::Sheet;

impl Sheet {
    pub fn set_cell_values(&mut self, rect: Rect, values: Array) -> Array {
        let mut old_values = Array::new_empty(values.size());
        for x in rect.x_range() {
            for y in rect.y_range() {
                let new_value = values
                    .get((x - rect.min.x) as u32, (y - rect.min.y) as u32)
                    .unwrap_or(&CellValue::Blank);
                let old_value = self.set_value((x, y).into(), new_value.to_owned());
                if let Some(old_value) = old_value {
                    match old_values.set(
                        (x - rect.min.x) as u32,
                        (y - rect.min.y) as u32,
                        old_value,
                        false,
                    ) {
                        Ok(_) => (),
                        Err(e) => {
                            dbgjs!(format!("Error setting cell value: {:?}", e));
                        }
                    }
                }
            }
        }
        old_values
    }

    pub fn get_cells_response(&self, rect: Rect) -> Vec<JsCellsA1Value> {
        let mut response = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                if let Some(cell) = self.display_value(Pos { x, y }) {
                    response.push(JsCellsA1Value {
                        x: x as i32,
                        y: y as i32,
                        v: cell.to_get_cells(),
                        t: cell.type_u8(),
                    });
                } else {
                    response.push(JsCellsA1Value {
                        x: x as i32,
                        y: y as i32,
                        v: "".into(),
                        t: CellValue::Blank.type_u8(),
                    });
                }
            }
        }

        response
    }

    // todo: the following two functions are probably in the wrong place

    /// In a given rect, collect all cell values into an array.
    ///
    /// TODO(ddimaria): is this necessary as it's more performant to just pluck the data from the sheet directly
    /// davidfig: regrettably, the Array::new_row_major requires the ordering to be row-based and not column based.
    /// we would need to rework how Array works for this to be more performant.
    pub fn cell_values_in_rect(&self, &selection: &Rect, include_code: bool) -> Result<Array> {
        let values = selection
            .y_range()
            .flat_map(|y| {
                selection
                    .x_range()
                    .map(|x| {
                        let pos = Pos { x, y };
                        let cell_value = self.cell_value_ref(pos).unwrap_or(&CellValue::Blank);

                        match (include_code, cell_value) {
                            (true, CellValue::Image(_) | CellValue::Html(_)) => {
                                cell_value.to_owned()
                            }
                            (_, _) => self.display_value(pos).unwrap_or(CellValue::Blank),
                        }
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

    /// Returns all cell values in a rect.
    pub fn cell_values_pos_in_rect(&self, &selection: &Rect) -> Vec<CellValue> {
        selection
            .y_range()
            .flat_map(|y| {
                selection
                    .x_range()
                    .map(|x| {
                        self.display_value((x, y).into())
                            .unwrap_or(CellValue::Blank)
                    })
                    .collect::<Vec<CellValue>>()
            })
            .collect()
    }

    /// Returns all positions that caused a spill error in the rect.
    /// Note this assumes there is a spill error with the output = spill_rect, and position in code_pos
    pub fn find_spill_error_reasons(&self, spill_rect: &Rect, code_pos: Pos) -> Vec<Pos> {
        let mut results = HashSet::new();

        // first check cell values
        for (rect, _) in self.columns.get_nondefault_rects_in_rect(*spill_rect) {
            for x in rect.x_range() {
                for y in rect.y_range() {
                    let cell_pos = Pos { x, y };
                    if cell_pos != code_pos {
                        results.insert(cell_pos);
                    }
                }
            }
        }

        // check data tables - iterate each position to identify specific cells causing spill
        for x in spill_rect.x_range() {
            for y in spill_rect.y_range() {
                let cell_pos = Pos { x, y };
                if self
                    .data_table_pos_that_contains_result(cell_pos)
                    .is_ok_and(|data_table_pos| code_pos != data_table_pos)
                {
                    results.insert(cell_pos);
                }
            }
        }

        // check merged cells
        let merged_cells = self.merge_cells.get_merge_cells(*spill_rect);
        for merged_rect in merged_cells {
            // Only add the anchor (top-left) position of each merged cell
            // The client can look up the full merged rect from this anchor position
            let anchor_pos = merged_rect.min;
            if anchor_pos != code_pos {
                results.insert(anchor_pos);
            }
        }

        results.into_iter().collect()
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use super::*;
    use crate::{
        CellValue, Pos, Rect, SheetPos,
        controller::GridController,
        grid::{CodeCellLanguage, Sheet},
    };
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};

    #[test]
    fn get_cells_response() {
        let mut sheet = Sheet::test();
        sheet.set_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_value(Pos { x: 1, y: 0 }, CellValue::Number(2.into()));
        sheet.set_value(Pos { x: 0, y: 1 }, CellValue::Number(3.into()));
        sheet.set_value(Pos { x: 1, y: 1 }, CellValue::Number(4.into()));
        sheet.set_value(Pos { x: 2, y: 0 }, CellValue::Text("test".into()));
        sheet.set_value(
            Pos { x: 3, y: 1 },
            CellValue::DateTime(NaiveDateTime::from_str("2024-08-15T01:20:00").unwrap()),
        );
        sheet.set_value(Pos { x: 2, y: 1 }, CellValue::Logical(true));
        sheet.set_value(
            Pos { x: 2, y: 2 },
            CellValue::Date(NaiveDate::from_str("2024-08-15").unwrap()),
        );
        sheet.set_value(
            Pos { x: 3, y: 0 },
            CellValue::Time(NaiveTime::from_str("01:20:00").unwrap()),
        );
        let response = sheet.get_cells_response(Rect::new(0, 0, 3, 3));
        assert_eq!(response.len(), 16);
        assert!(response.contains(&JsCellsA1Value {
            x: 0,
            y: 0,
            v: "1".into(),
            t: 2,
        }));
        assert!(response.contains(&JsCellsA1Value {
            x: 1,
            y: 0,
            v: "2".into(),
            t: 2,
        }));
        assert!(response.contains(&JsCellsA1Value {
            x: 0,
            y: 1,
            v: "3".into(),
            t: 2,
        }));
        assert!(response.contains(&JsCellsA1Value {
            x: 1,
            y: 1,
            v: "4".into(),
            t: 2,
        }));
        assert!(response.contains(&JsCellsA1Value {
            x: 2,
            y: 0,
            v: "test".into(),
            t: 1,
        }));
        assert!(response.contains(&JsCellsA1Value {
            x: 3,
            y: 1,
            v: "2024-08-15T01:20:00.000".into(),
            t: 11,
        }));
        assert!(response.contains(&JsCellsA1Value {
            x: 2,
            y: 1,
            v: "true".into(),
            t: 3,
        }));
        assert!(response.contains(&JsCellsA1Value {
            x: 2,
            y: 2,
            v: "2024-08-15".into(),
            t: 9,
        }));
        assert!(response.contains(&JsCellsA1Value {
            x: 3,
            y: 0,
            v: "01:20:00.000".into(),
            t: 10,
        }));
    }

    #[test]
    fn test_find_spill_error_reasons() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            "causes spill error".into(),
            None,
            false,
        );
        gc.set_code_cell(
            SheetPos {
                x: 3,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "1 + 1".into(),
            None,
            None,
            false,
        );
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3}".into(),
            None,
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let run = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();
        assert!(run.has_spill());
        let reasons = sheet.find_spill_error_reasons(
            &run.output_rect(Pos { x: 1, y: 1 }, true),
            Pos { x: 1, y: 1 },
        );
        assert_eq!(reasons.len(), 2);
        assert!(reasons.contains(&Pos { x: 2, y: 1 }));
        assert!(reasons.contains(&Pos { x: 3, y: 1 }));
    }

    /// Test that find_spill_error_reasons returns all individual cell positions
    /// from a data table output, not just the anchor position.
    #[test]
    fn test_find_spill_error_reasons_returns_all_data_table_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table at E1 that outputs a 2x2 array (E1:F2)
        gc.set_code_cell(
            SheetPos {
                x: 5,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2; 3, 4}".into(),
            None,
            None,
            false,
        );

        // Verify the data table was created and outputs 2x2
        let sheet = gc.sheet(sheet_id);
        let data_table = sheet.data_table_at(&Pos { x: 5, y: 1 }).unwrap();
        assert_eq!(
            data_table.output_rect(Pos { x: 5, y: 1 }, true),
            Rect::new(5, 1, 6, 2)
        );

        // Create a data table at A1 that would spill to A1:F2 (overlapping with E1:F2)
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3, 4, 5, 6; 7, 8, 9, 10, 11, 12}".into(),
            None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let spilling_table = sheet.data_table_at(&Pos { x: 1, y: 1 }).unwrap();

        // The table at A1 should have a spill error
        assert!(spilling_table.has_spill());

        // Get the spill error reasons - should include ALL cells from E1:F2, not just E1
        let reasons = sheet.find_spill_error_reasons(
            &spilling_table.output_rect(Pos { x: 1, y: 1 }, true),
            Pos { x: 1, y: 1 },
        );

        // Should contain all 4 cells from the blocking data table's output: E1, F1, E2, F2
        assert_eq!(reasons.len(), 4);
        assert!(reasons.contains(&Pos { x: 5, y: 1 })); // E1
        assert!(reasons.contains(&Pos { x: 6, y: 1 })); // F1
        assert!(reasons.contains(&Pos { x: 5, y: 2 })); // E2
        assert!(reasons.contains(&Pos { x: 6, y: 2 })); // F2
    }

    #[test]
    fn set_cell_values() {
        let mut sheet = Sheet::test();
        let rect = Rect::from_numbers(1, 1, 2, 2);
        let values = Array::from(vec![vec!["1.0", "2.0"], vec!["3.0", "4.0"]]);
        let old_values = sheet.set_cell_values(rect, values.clone());
        for y in rect.y_range() {
            for x in rect.x_range() {
                assert_eq!(
                    sheet.cell_value(Pos { x, y }).unwrap(),
                    *values
                        .get((x - rect.min.x) as u32, (y - rect.min.y) as u32)
                        .unwrap()
                );
                assert_eq!(
                    *old_values
                        .get((x - rect.min.x) as u32, (y - rect.min.y) as u32)
                        .unwrap(),
                    CellValue::Blank
                );
            }
        }

        // replace old values with new values
        let values_2 = Array::from(vec![vec!["11.0", "12.0"], vec!["13.0", "14.0"]]);
        let old_values = sheet.set_cell_values(rect, values_2.clone());
        for y in rect.y_range() {
            for x in rect.x_range() {
                assert_eq!(
                    sheet.cell_value(Pos { x, y }).unwrap(),
                    *values_2
                        .get((x - rect.min.x) as u32, (y - rect.min.y) as u32)
                        .unwrap()
                );
                assert_eq!(
                    *old_values
                        .get((x - rect.min.x) as u32, (y - rect.min.y) as u32)
                        .unwrap(),
                    *values
                        .get((x - rect.min.x) as u32, (y - rect.min.y) as u32)
                        .unwrap()
                );
            }
        }
    }
}
