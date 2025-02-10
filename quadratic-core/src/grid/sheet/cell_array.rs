use std::collections::HashSet;

use anyhow::{anyhow, Result};

use crate::{
    controller::execution::run_code::get_cells::JsGetCellResponse, Array, CellValue, Pos, Rect,
};

use super::Sheet;

impl Sheet {
    pub fn set_cell_values(&mut self, rect: Rect, values: &Array) -> Array {
        let mut old_values = Array::new_empty(values.size());

        for x in rect.x_range() {
            let column = self.get_or_create_column(x);

            for y in rect.y_range() {
                let old_value;
                if let Ok(value) = values.get((x - rect.min.x) as u32, (y - rect.min.y) as u32) {
                    old_value = column.values.insert(y, value.clone());
                } else {
                    old_value = column.values.remove(&y);
                }
                if let Some(old_value) = old_value {
                    let _ =
                        old_values.set((x - rect.min.x) as u32, (y - rect.min.y) as u32, old_value);
                }
            }
        }

        old_values
    }

    pub fn get_cells_response(&self, rect: Rect) -> Vec<JsGetCellResponse> {
        let mut response = vec![];
        for y in rect.y_range() {
            for x in rect.x_range() {
                if let Some(cell) = self.display_value(Pos { x, y }) {
                    response.push(JsGetCellResponse {
                        x,
                        y,
                        value: cell.to_get_cells(),
                        type_name: cell.type_name().into(),
                    });
                } else {
                    response.push(JsGetCellResponse {
                        x,
                        y,
                        value: "".into(),
                        type_name: "blank".into(),
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
                        let cell_value = self.cell_value(pos).unwrap_or(CellValue::Blank);

                        match (include_code, &cell_value) {
                            (
                                true,
                                CellValue::Code(_)
                                | CellValue::Import(_)
                                | CellValue::Image(_)
                                | CellValue::Html(_),
                            ) => cell_value,
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

    /// Returns all cell values and their positions in a rect.
    pub fn cell_values_pos_in_rect(
        &self,
        &selection: &Rect,
        include_code: bool,
    ) -> Vec<(CellValue, Option<Pos>)> {
        selection
            .y_range()
            .flat_map(|y| {
                selection
                    .x_range()
                    .map(|x| {
                        let pos = Pos { x, y };
                        let cell_value = self.cell_value(pos).unwrap_or(CellValue::Blank);

                        match (include_code, &cell_value) {
                            (true, CellValue::Code(_)) => (cell_value, Some(pos)),
                            (_, _) => (self.display_value(pos).unwrap_or(CellValue::Blank), None),
                        }
                    })
                    .collect::<Vec<(CellValue, Option<Pos>)>>()
            })
            .collect()
    }

    /// Returns whether a rect has any CellValue within it.
    pub fn has_cell_value_in_rect(&self, rect: &Rect, skip: Option<Pos>) -> bool {
        for x in rect.x_range() {
            if let Some(column) = self.get_column(x) {
                for y in rect.y_range() {
                    let cell_pos = Pos { x, y };
                    if column.values.get(&y).is_some_and(|cell| {
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
                    if column.values.get(&y).is_some_and(|cell| {
                        cell_pos != code_pos && !cell.is_blank_or_empty_string()
                    }) {
                        results.insert(cell_pos);
                    }
                }
            }
        }

        // then check code runs
        for (pos, code_run) in &self.data_tables {
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
    use std::str::FromStr;

    use super::*;
    use crate::{
        controller::GridController,
        grid::{CodeCellLanguage, Sheet},
        CellValue, Pos, Rect, SheetPos,
    };
    use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn test_has_cell_values_in_rect() {
        let mut sheet = Sheet::test();
        let rect = Rect::from_numbers(0, 0, 10, 10);
        assert!(!sheet.has_cell_value_in_rect(&rect, None));
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        assert!(sheet.has_cell_value_in_rect(&rect, None));
        assert!(!sheet.has_cell_value_in_rect(&rect, Some(Pos { x: 0, y: 0 })));
    }

    #[test]
    #[parallel]
    fn get_cells_response() {
        let mut sheet = Sheet::test();
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(1.into()));
        sheet.set_cell_value(Pos { x: 1, y: 0 }, CellValue::Number(2.into()));
        sheet.set_cell_value(Pos { x: 0, y: 1 }, CellValue::Number(3.into()));
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(4.into()));
        sheet.set_cell_value(Pos { x: 2, y: 0 }, CellValue::Text("test".into()));
        sheet.set_cell_value(
            Pos { x: 3, y: 1 },
            CellValue::DateTime(NaiveDateTime::from_str("2024-08-15T01:20:00").unwrap()),
        );
        sheet.set_cell_value(Pos { x: 2, y: 1 }, CellValue::Logical(true));
        sheet.set_cell_value(
            Pos { x: 2, y: 2 },
            CellValue::Date(NaiveDate::from_str("2024-08-15").unwrap()),
        );
        sheet.set_cell_value(
            Pos { x: 3, y: 0 },
            CellValue::Time(NaiveTime::from_str("01:20:00").unwrap()),
        );
        let response = sheet.get_cells_response(Rect::new(0, 0, 3, 3));
        assert_eq!(response.len(), 16);
        assert!(response.contains(&JsGetCellResponse {
            x: 0,
            y: 0,
            value: "1".into(),
            type_name: "number".into(),
        }));
        assert!(response.contains(&JsGetCellResponse {
            x: 1,
            y: 0,
            value: "2".into(),
            type_name: "number".into(),
        }));
        assert!(response.contains(&JsGetCellResponse {
            x: 0,
            y: 1,
            value: "3".into(),
            type_name: "number".into(),
        }));
        assert!(response.contains(&JsGetCellResponse {
            x: 1,
            y: 1,
            value: "4".into(),
            type_name: "number".into(),
        }));
        assert!(response.contains(&JsGetCellResponse {
            x: 2,
            y: 0,
            value: "test".into(),
            type_name: "text".into(),
        }));
        assert!(response.contains(&JsGetCellResponse {
            x: 3,
            y: 1,
            value: "2024-08-15T01:20:00.000".into(),
            type_name: "date time".into(),
        }));
        assert!(response.contains(&JsGetCellResponse {
            x: 2,
            y: 1,
            value: "true".into(),
            type_name: "logical".into(),
        }));
        assert!(response.contains(&JsGetCellResponse {
            x: 2,
            y: 2,
            value: "2024-08-15".into(),
            type_name: "date".into(),
        }));
        assert!(response.contains(&JsGetCellResponse {
            x: 3,
            y: 0,
            value: "01:20:00.000".into(),
            type_name: "time".into(),
        }));
    }

    #[test]
    #[parallel]
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
        let run = sheet.data_table(Pos { x: 0, y: 0 }).unwrap();
        assert!(run.spill_error);
        let reasons = sheet.find_spill_error_reasons(
            &run.output_rect(Pos { x: 0, y: 0 }, true),
            Pos { x: 0, y: 0 },
        );
        assert_eq!(reasons.len(), 2);
        assert!(reasons.iter().any(|p| *p == Pos { x: 1, y: 0 }));
        assert!(reasons.iter().any(|p| *p == Pos { x: 2, y: 0 }));
    }

    #[test]
    #[parallel]
    fn set_cell_values() {
        let mut sheet = Sheet::test();
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let values = Array::from_random_floats(rect.size());
        let old_values = sheet.set_cell_values(rect, &values);
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
        let values_2 = Array::from_random_floats(rect.size());
        let old_values = sheet.set_cell_values(rect, &values_2);
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
