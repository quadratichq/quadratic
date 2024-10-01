use std::ops::Range;

use super::Sheet;
use crate::{
    formulas::replace_internal_cell_references,
    grid::{
        data_table::DataTable,
        js_types::{JsCodeCell, JsReturnInfo},
        CodeCellLanguage, DataTableKind, RenderSize,
    },
    CellValue, Pos, Rect,
};

impl Sheet {
    /// Sets or deletes a code run.
    ///
    /// Returns the old value if it was set.
    pub fn set_data_table(&mut self, pos: Pos, data_table: Option<DataTable>) -> Option<DataTable> {
        if let Some(data_table) = data_table {
            self.data_tables.insert(pos, data_table)
        } else {
            self.data_tables.shift_remove(&pos)
        }
    }

    /// Returns a DatatTable at a Pos
    pub fn data_table(&self, pos: Pos) -> Option<&DataTable> {
        self.data_tables.get(&pos)
    }

    /// Gets column bounds for data_tables that output to the columns
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

    /// Returns the CellValue for a CodeRun (if it exists) at the Pos.
    ///
    /// Note: spill error will return a CellValue::Blank to ensure calculations can continue.
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

    /// returns the render-size for a html-like cell
    pub fn render_size(&self, pos: Pos) -> Option<RenderSize> {
        let column = self.get_column(pos.x)?;
        column.render_size.get(pos.y)
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
                    let replaced =
                        replace_internal_cell_references(&code_cell_value.code, code_pos);
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
                        DataTableKind::CodeRun(code_run) => Some(JsCodeCell {
                            x: code_pos.x,
                            y: code_pos.y,
                            code_string: code_cell_value.code,
                            language: code_cell_value.language,
                            std_err: code_run.std_err.clone(),
                            std_out: code_run.std_out.clone(),
                            evaluation_result: Some(evaluation_result),
                            spill_error,
                            return_info: Some(JsReturnInfo {
                                line_number: code_run.line_number,
                                output_type: code_run.output_type.clone(),
                            }),
                            cells_accessed: Some(code_run.cells_accessed.iter().copied().collect()),
                        }),
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
        grid::{js_types::JsRenderCellSpecial, CodeCellLanguage, CodeRun, RenderSize},
        Array, CodeCellValue, SheetPos, Value,
    };
    use bigdecimal::BigDecimal;
    use chrono::Utc;
    use serial_test::parallel;
    use std::{collections::HashSet, vec};

    #[test]
    #[parallel]
    fn test_render_size() {
        use crate::Pos;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_render_size(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            }
            .into(),
            Some(crate::grid::RenderSize {
                w: "10".to_string(),
                h: "20".to_string(),
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.render_size(Pos { x: 0, y: 0 }),
            Some(RenderSize {
                w: "10".to_string(),
                h: "20".to_string()
            })
        );
        assert_eq!(sheet.render_size(Pos { x: 1, y: 1 }), None);
    }

    #[test]
    #[parallel]
    fn test_set_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
        let code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable {
            kind: DataTableKind::CodeRun(code_run),
            value: Value::Single(CellValue::Number(BigDecimal::from(2))),
            spill_error: false,
            last_modified: Utc::now(),
        };
        let old = sheet.set_data_table(Pos { x: 0, y: 0 }, Some(data_table.clone()));
        assert_eq!(old, None);
        assert_eq!(sheet.data_table(Pos { x: 0, y: 0 }), Some(&data_table));
        assert_eq!(sheet.data_table(Pos { x: 0, y: 0 }), Some(&data_table));
        assert_eq!(sheet.data_table(Pos { x: 1, y: 0 }), None);
    }

    #[test]
    #[parallel]
    fn test_get_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable {
            kind: DataTableKind::CodeRun(code_run),
            value: Value::Single(CellValue::Number(BigDecimal::from(2))),
            spill_error: false,
            last_modified: Utc::now(),
        };
        sheet.set_data_table(Pos { x: 0, y: 0 }, Some(data_table.clone()));
        assert_eq!(
            sheet.get_code_cell_value(Pos { x: 0, y: 0 }),
            Some(CellValue::Number(BigDecimal::from(2)))
        );
        assert_eq!(sheet.data_table(Pos { x: 0, y: 0 }), Some(&data_table));
        assert_eq!(sheet.data_table(Pos { x: 1, y: 1 }), None);
    }

    #[test]
    #[parallel]
    fn test_edit_code_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(
            Pos { x: 0, y: 0 },
            CellValue::Code(CodeCellValue {
                code: "=".to_string(),
                language: CodeCellLanguage::Formula,
            }),
        );
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable {
            kind: DataTableKind::CodeRun(code_run),
            value: Value::Array(Array::from(vec![vec!["1", "2", "3"]])),
            spill_error: false,
            last_modified: Utc::now(),
        };
        sheet.set_data_table(Pos { x: 0, y: 0 }, Some(data_table.clone()));
        assert_eq!(
            sheet.edit_code_value(Pos { x: 0, y: 0 }),
            Some(JsCodeCell {
                x: 0,
                y: 0,
                code_string: "=".to_string(),
                language: CodeCellLanguage::Formula,
                std_err: None,
                std_out: None,
                evaluation_result: Some("{\"size\":{\"w\":3,\"h\":1},\"values\":[{\"type\":\"text\",\"value\":\"1\"},{\"type\":\"text\",\"value\":\"2\"},{\"type\":\"text\",\"value\":\"3\"}]}".to_string()),
                spill_error: None,
                return_info: Some(JsReturnInfo { line_number: None, output_type: None }),
                cells_accessed: Some(vec![])
            })
        );
        assert_eq!(
            sheet.edit_code_value(Pos { x: 1, y: 0 }),
            Some(JsCodeCell {
                x: 0,
                y: 0,
                code_string: "=".to_string(),
                language: CodeCellLanguage::Formula,
                std_err: None,
                std_out: None,
                evaluation_result: Some("{\"size\":{\"w\":3,\"h\":1},\"values\":[{\"type\":\"text\",\"value\":\"1\"},{\"type\":\"text\",\"value\":\"2\"},{\"type\":\"text\",\"value\":\"3\"}]}".to_string()),
                spill_error: None,
                return_info: Some(JsReturnInfo { line_number: None, output_type: None }),
                cells_accessed: Some(vec![])
            })
        );
        assert_eq!(sheet.edit_code_value(Pos { x: 2, y: 2 }), None);
    }

    #[test]
    #[parallel]
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
    #[parallel]
    fn code_columns_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable {
            kind: DataTableKind::CodeRun(code_run),
            value: Value::Array(Array::from(vec![vec!["1"], vec!["2"], vec!["3"]])),
            spill_error: false,
            last_modified: Utc::now(),
        };
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
    #[parallel]
    fn code_row_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            formatted_code_string: None,
            cells_accessed: HashSet::new(),
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        let data_table = DataTable {
            kind: DataTableKind::CodeRun(code_run),
            value: Value::Array(Array::from(vec![vec!["1", "2", "3'"]])),
            spill_error: false,
            last_modified: Utc::now(),
        };
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
}
