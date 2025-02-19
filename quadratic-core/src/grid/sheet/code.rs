use std::ops::Range;

use super::Sheet;
use crate::{
    cell_values::CellValues,
    formulas::replace_internal_cell_references,
    grid::{
        data_table::DataTable,
        js_types::{JsCodeCell, JsReturnInfo},
        CodeCellLanguage, DataTableKind,
    },
    CellValue, Pos, Rect, Value,
};

impl Sheet {
    /// Gets column bounds (ie, a range of rows) for data_tables that output to the columns
    pub fn code_columns_bounds(&self, column_start: i64, column_end: i64) -> Option<Range<i64>> {
        let mut min: Option<i64> = None;
        let mut max: Option<i64> = None;
        for (pos, data_table) in &self.data_tables {
            let output_rect = data_table.output_rect(*pos, false);
            if output_rect.min.x <= column_end && output_rect.max.x >= column_start {
                min = min
                    .map(|min| Some(min.min(output_rect.min.y)))
                    .unwrap_or(Some(output_rect.min.y));
                max = max
                    .map(|max| Some(max.max(output_rect.max.y)))
                    .unwrap_or(Some(output_rect.max.y));
            }
        }
        if let (Some(min), Some(max)) = (min, max) {
            Some(min..max + 1)
        } else {
            None
        }
    }

    /// Gets the row bounds for data_tables that output to the rows
    pub fn code_rows_bounds(&self, row_start: i64, row_end: i64) -> Option<Range<i64>> {
        let mut min: Option<i64> = None;
        let mut max: Option<i64> = None;
        for (pos, data_table) in &self.data_tables {
            let output_rect = data_table.output_rect(*pos, false);
            if output_rect.min.y <= row_end && output_rect.max.y >= row_start {
                min = min
                    .map(|min| Some(min.min(output_rect.min.x)))
                    .unwrap_or(Some(output_rect.min.x));
                max = max
                    .map(|max| Some(max.max(output_rect.max.x)))
                    .unwrap_or(Some(output_rect.max.x));
            }
        }
        if let (Some(min), Some(max)) = (min, max) {
            Some(min..max + 1)
        } else {
            None
        }
    }

    // TODO(ddimaria): move to DataTable code
    /// Returns the DataTable that overlaps the Pos if it is an HTML or image chart.
    pub fn chart_at(&self, pos: Pos) -> Option<(&Pos, &DataTable)> {
        self.data_tables.iter().find(|(code_cell_pos, data_table)| {
            data_table.is_html_or_image()
                && data_table.output_rect(**code_cell_pos, false).contains(pos)
        })
    }

    /// Returns the DataTable if the pos intersects with the table header.
    pub fn table_header_at(&self, pos: Pos) -> Option<(Pos, Rect)> {
        for (code_cell_pos, data_table) in &self.data_tables {
            let output_rect = data_table.output_rect(*code_cell_pos, false);
            if data_table.show_ui
                && data_table.show_name
                && pos.y == output_rect.min.y
                && pos.x >= output_rect.min.x
                && pos.x <= output_rect.max.x
            {
                return Some((*code_cell_pos, output_rect));
            }
        }
        None
    }

    /// Returns true if the tables contain any cell at Pos (ie, not blank). Uses
    /// the DataTable's output_rect for the check to ensure that charts are
    /// included.
    pub fn has_table_content(&self, pos: Pos) -> bool {
        self.data_tables.iter().any(|(code_cell_pos, data_table)| {
            data_table.output_rect(*code_cell_pos, false).contains(pos)
        })
    }

    /// Returns the CellValue for a CodeRun (if it exists) at the Pos.
    ///
    /// Note: spill error will return a CellValue::Blank to ensure calculations can continue.
    /// TODO(ddimaria): move to DataTable code
    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        self.data_tables
            .iter()
            .find_map(|(code_cell_pos, data_table)| {
                if data_table.output_rect(*code_cell_pos, false).contains(pos) {
                    data_table.cell_value_at(
                        (pos.x - code_cell_pos.x) as u32,
                        (pos.y - code_cell_pos.y) as u32,
                    )
                } else {
                    None
                }
            })
    }

    /// TODO(ddimaria): move to DataTable code
    pub fn get_code_cell_values(&self, rect: Rect) -> CellValues {
        self.iter_code_output_in_rect(rect)
            .flat_map(|(data_table_rect, data_table)| match &data_table.value {
                Value::Single(v) => vec![vec![v.to_owned()]],
                Value::Array(_) => rect
                    .y_range()
                    .map(|y| {
                        rect.x_range()
                            .map(|x| {
                                data_table
                                    .cell_value_at(
                                        (x - data_table_rect.min.x) as u32,
                                        (y - data_table_rect.min.y) as u32,
                                    )
                                    .unwrap_or(CellValue::Blank)
                            })
                            .collect::<Vec<CellValue>>()
                    })
                    .collect::<Vec<Vec<CellValue>>>(),
                Value::Tuple(_) => vec![vec![]],
            })
            .collect::<Vec<Vec<CellValue>>>()
            .into()
    }

    /// Sets the CellValue for a DataTable at the Pos.
    /// Returns true if the value was set.
    /// TODO(ddimaria): move to DataTable code
    pub fn set_code_cell_value(&mut self, pos: Pos, value: CellValue) -> bool {
        self.data_tables
            .iter_mut()
            .find(|(code_cell_pos, data_table)| {
                data_table.output_rect(**code_cell_pos, false).contains(pos)
            })
            .map(|(code_cell_pos, data_table)| {
                let x = (pos.x - code_cell_pos.x) as u32;
                let y = (pos.y - code_cell_pos.y) as u32;
                data_table.set_cell_value_at(x, y, value).then_some(|| true)
            })
            .is_some()
    }

    /// TODO(ddimaria): move to DataTable code
    pub fn set_code_cell_values(&mut self, pos: Pos, mut values: CellValues) {
        if let Some((code_cell_pos, data_table)) =
            self.data_tables
                .iter_mut()
                .find(|(code_cell_pos, data_table)| {
                    data_table.output_rect(**code_cell_pos, false).contains(pos)
                })
        {
            let rect = Rect::from(&values);
            for y in rect.y_range() {
                for x in rect.x_range() {
                    let new_x = u32::try_from(pos.x - code_cell_pos.x + x).unwrap_or(0);
                    let new_y = u32::try_from(pos.y - code_cell_pos.y + y).unwrap_or(0);
                    if let Some(value) = values.remove(x as u32, y as u32) {
                        data_table.set_cell_value_at(new_x, new_y, value);
                    }
                }
            }
        }
    }

    pub fn iter_code_output_in_rect(&self, rect: Rect) -> impl Iterator<Item = (Rect, &DataTable)> {
        self.data_tables
            .iter()
            .filter_map(move |(pos, data_table)| {
                let output_rect = data_table.output_rect(*pos, false);
                output_rect
                    .intersects(rect)
                    .then_some((output_rect, data_table))
            })
    }

    pub fn iter_code_output_intersects_rect(
        &mut self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Rect, &DataTable)> {
        self.data_tables
            .iter()
            .filter_map(move |(pos, data_table)| {
                let output_rect = data_table.output_rect(*pos, false);
                output_rect
                    .intersection(&rect)
                    .map(|intersection_rect| (output_rect, intersection_rect, data_table))
            })
    }

    /// Returns whether a rect overlaps the output of a code cell.
    /// It will only check code_cells until it finds the data_table at code_pos (since later data_tables do not cause spills in earlier ones)
    pub fn has_code_cell_in_rect(&self, rect: &Rect, code_pos: Pos) -> bool {
        for (pos, data_table) in &self.data_tables {
            if pos == &code_pos {
                // once we reach the code_cell, we can stop checking
                return false;
            }
            if data_table.output_rect(*pos, false).intersects(*rect) {
                return true;
            }
        }
        false
    }

    /// Returns the code cell at a Pos; also returns the code cell if the Pos is part of a code run.
    /// Used for double clicking a cell on the grid.
    pub fn edit_code_value(&self, pos: Pos) -> Option<JsCodeCell> {
        let mut code_pos = pos;
        let cell_value = if let Some(cell_value) = self.cell_value(pos) {
            Some(cell_value)
        } else {
            self.data_tables
                .iter()
                .find_map(|(data_table_pos, data_table)| {
                    if data_table.output_rect(*data_table_pos, false).contains(pos) {
                        if let Some(code_value) = self.cell_value(*data_table_pos) {
                            code_pos = *data_table_pos;
                            Some(code_value)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
        };

        match cell_value?.code_cell_value() {
            Some(mut code_cell_value) => {
                // replace internal cell references with a1 notation
                if matches!(code_cell_value.language, CodeCellLanguage::Formula) {
                    // `self.a1_context()` is unaware of other sheets, which might cause issues?
                    let parse_ctx = self.a1_context();
                    let replaced = replace_internal_cell_references(
                        &code_cell_value.code,
                        &parse_ctx,
                        code_pos.to_sheet_pos(self.id),
                    );
                    code_cell_value.code = replaced;
                }

                if let Some(data_table) = self.data_table(code_pos) {
                    let evaluation_result =
                        serde_json::to_string(&data_table.value).unwrap_or("".into());
                    let spill_error = if data_table.spill_error {
                        Some(self.find_spill_error_reasons(
                            &data_table.output_rect(code_pos, true),
                            code_pos,
                        ))
                    } else {
                        None
                    };

                    match &data_table.kind {
                        DataTableKind::CodeRun(code_run) => {
                            let evaluation_result = if let Some(error) = &code_run.error {
                                Some(serde_json::to_string(error).unwrap_or("".into()))
                            } else {
                                Some(evaluation_result)
                            };

                            Some(JsCodeCell {
                                x: code_pos.x,
                                y: code_pos.y,
                                code_string: code_cell_value.code,
                                language: code_cell_value.language,
                                std_err: code_run.std_err.clone(),
                                std_out: code_run.std_out.clone(),
                                evaluation_result,
                                spill_error,
                                return_info: Some(JsReturnInfo {
                                    line_number: code_run.line_number,
                                    output_type: code_run.output_type.clone(),
                                }),
                                cells_accessed: Some(code_run.cells_accessed.clone().into()),
                            })
                        }
                        DataTableKind::Import(_) => Some(JsCodeCell {
                            x: code_pos.x,
                            y: code_pos.y,
                            code_string: code_cell_value.code,
                            language: code_cell_value.language,
                            std_err: None,
                            std_out: None,
                            evaluation_result: Some(evaluation_result),
                            spill_error,
                            return_info: None,
                            cells_accessed: None,
                        }),
                    }
                } else {
                    Some(JsCodeCell {
                        x: code_pos.x,
                        y: code_pos.y,
                        code_string: code_cell_value.code,
                        language: code_cell_value.language,
                        std_err: None,
                        std_out: None,
                        evaluation_result: None,
                        spill_error: None,
                        return_info: None,
                        cells_accessed: None,
                    })
                }
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        controller::GridController,
        grid::{js_types::JsRenderCellSpecial, CodeCellLanguage, CodeCellValue, CodeRun},
        Array, SheetPos, Value,
    };
    use std::vec;

    #[test]
    fn test_edit_code_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(
            Pos { x: 1, y: 1 },
            CellValue::Code(CodeCellValue {
                code: "=".to_string(),
                language: CodeCellLanguage::Formula,
            }),
        );
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1", "2", "3"]])),
            false,
            false,
            false,
            None,
        );
        sheet.set_data_table(Pos { x: 1, y: 1 }, Some(data_table.clone()));
        assert_eq!(
            sheet.edit_code_value(Pos { x: 1, y: 1 }),
            Some(JsCodeCell {
                x: 1,
                y: 1,
                code_string: "=".to_string(),
                language: CodeCellLanguage::Formula,
                std_err: None,
                std_out: None,
                evaluation_result: Some("{\"size\":{\"w\":3,\"h\":1},\"values\":[{\"type\":\"text\",\"value\":\"1\"},{\"type\":\"text\",\"value\":\"2\"},{\"type\":\"text\",\"value\":\"3\"}]}".to_string()),
                spill_error: None,
                return_info: Some(JsReturnInfo { line_number: None, output_type: None }),
                cells_accessed: Some(Default::default())
            })
        );
        assert_eq!(
            sheet.edit_code_value(Pos { x: 2, y: 1 }),
            Some(JsCodeCell {
                x: 1,
                y: 1,
                code_string: "=".to_string(),
                language: CodeCellLanguage::Formula,
                std_err: None,
                std_out: None,
                evaluation_result: Some("{\"size\":{\"w\":3,\"h\":1},\"values\":[{\"type\":\"text\",\"value\":\"1\"},{\"type\":\"text\",\"value\":\"2\"},{\"type\":\"text\",\"value\":\"3\"}]}".to_string()),
                spill_error: None,
                return_info: Some(JsReturnInfo { line_number: None, output_type: None }),
                cells_accessed: Some(Default::default())
            })
        );
        assert_eq!(sheet.edit_code_value(Pos { x: 3, y: 3 }), None);
    }

    #[test]
    fn edit_code_value_spill() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            "should cause spill".into(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "{1, 2, 3}".to_string(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 0 }),
            Some("should cause spill".into())
        );
        let render = sheet.get_render_cells(Rect::from_numbers(0, 0, 1, 1));
        assert_eq!(render[0].special, Some(JsRenderCellSpecial::SpillError));
        let code = sheet.edit_code_value(Pos { x: 0, y: 0 }).unwrap();
        assert_eq!(code.spill_error, Some(vec![Pos { x: 1, y: 0 }]));
    }

    #[test]
    fn code_columns_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1"], vec!["2"], vec!["3"]])),
            false,
            false,
            false,
            None,
        );
        sheet.set_data_table(Pos { x: 0, y: 0 }, Some(data_table.clone()));
        sheet.set_data_table(Pos { x: 1, y: 1 }, Some(data_table.clone()));
        sheet.set_data_table(Pos { x: 2, y: 3 }, Some(data_table.clone()));

        assert_eq!(sheet.code_columns_bounds(0, 0), Some(0..3));
        assert_eq!(sheet.code_columns_bounds(1, 1), Some(1..4));
        assert_eq!(sheet.code_columns_bounds(1, 2), Some(1..6));
        assert_eq!(sheet.code_columns_bounds(0, 2), Some(0..6));
        assert_eq!(sheet.code_columns_bounds(-10, 0), Some(0..3));
        assert_eq!(sheet.code_columns_bounds(2, 5), Some(3..6));
        assert_eq!(sheet.code_columns_bounds(10, 10), None);
    }

    #[test]
    fn code_row_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            cells_accessed: Default::default(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1", "2", "3'"]])),
            false,
            false,
            false,
            None,
        );
        sheet.set_data_table(Pos { x: 0, y: 0 }, Some(data_table.clone()));
        sheet.set_data_table(Pos { x: 1, y: 1 }, Some(data_table.clone()));
        sheet.set_data_table(Pos { x: 3, y: 2 }, Some(data_table.clone()));

        assert_eq!(sheet.code_rows_bounds(0, 0), Some(0..3));
        assert_eq!(sheet.code_rows_bounds(1, 1), Some(1..4));
        assert_eq!(sheet.code_rows_bounds(1, 2), Some(1..6));
        assert_eq!(sheet.code_rows_bounds(0, 2), Some(0..6));
        assert_eq!(sheet.code_rows_bounds(-10, 0), Some(0..3));
        assert_eq!(sheet.code_rows_bounds(2, 5), Some(3..6));
        assert_eq!(sheet.code_rows_bounds(10, 10), None);
    }

    #[test]
    fn chart_at() {
        let mut sheet = Sheet::test();
        assert_eq!(sheet.chart_at(Pos { x: 1, y: 1 }), None);

        let mut dt = DataTable::new(
            DataTableKind::CodeRun(CodeRun::default()),
            "Table 1",
            CellValue::Html("<html></html>".to_string()).into(),
            false,
            false,
            false,
            None,
        );
        dt.chart_output = Some((2, 2));

        let pos = Pos { x: 1, y: 1 };
        sheet.set_cell_value(
            pos,
            CellValue::Code(CodeCellValue {
                code: "".to_string(),
                language: CodeCellLanguage::Javascript,
            }),
        );
        sheet.set_data_table(pos, Some(dt.clone()));

        assert_eq!(sheet.chart_at(pos), Some((&pos, &dt)));
        assert_eq!(sheet.chart_at(Pos { x: 2, y: 2 }), Some((&pos, &dt)));
    }
}
