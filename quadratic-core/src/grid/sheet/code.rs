use std::ops::Range;

use super::Sheet;
use crate::{
    CellValue, Pos, Rect, Value,
    a1::A1Context,
    cell_values::CellValues,
    formulas::convert_rc_to_a1,
    grid::{
        CodeCellLanguage, DataTableKind,
        data_table::DataTable,
        js_types::{JsCodeCell, JsReturnInfo},
    },
};

impl Sheet {
    /// Gets column bounds (ie, a range of rows) for data_tables that output to the columns
    pub fn code_columns_bounds(&self, column_start: i64, column_end: i64) -> Option<Range<i64>> {
        let mut min: Option<i64> = None;
        let mut max: Option<i64> = None;
        for col in column_start..=column_end {
            if let Some((bound_start, bound_end)) = self.data_tables.column_bounds(col) {
                min = min
                    .map(|min| Some(min.min(bound_start)))
                    .unwrap_or(Some(bound_start));
                max = max
                    .map(|max| Some(max.max(bound_end)))
                    .unwrap_or(Some(bound_end));
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
        for row in row_start..=row_end {
            if let Some((bound_start, bound_end)) = self.data_tables.row_bounds(row) {
                min = min
                    .map(|min| Some(min.min(bound_start)))
                    .unwrap_or(Some(bound_start));
                max = max
                    .map(|max| Some(max.max(bound_end)))
                    .unwrap_or(Some(bound_end));
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
    pub fn chart_at(&self, pos: Pos) -> Option<(Pos, &DataTable)> {
        let (data_table_pos, data_table) = self.data_table_that_contains(pos)?;
        if data_table.is_html_or_image() {
            Some((data_table_pos, data_table))
        } else {
            None
        }
    }

    /// Returns the DataTable if the pos intersects with the table header.
    pub fn table_header_at(&self, pos: Pos) -> Option<(Pos, Rect)> {
        let (data_table_pos, data_table) = self.data_table_that_contains(pos)?;
        let output_rect = data_table.output_rect(data_table_pos, false);
        if data_table.get_show_name() && pos.y == output_rect.min.y {
            Some((data_table_pos, output_rect))
        } else {
            None
        }
    }

    /// Returns true if the tables contain any cell at Pos (ie, not blank). Uses
    /// the DataTable's output_rect for the check to ensure that charts are
    /// included.
    /// If ignore_readonly is true, it will ignore readonly tables.
    pub fn has_table_content(&self, pos: Pos, ignore_readonly: bool) -> bool {
        self.data_table_that_contains(pos)
            .is_some_and(|(_, data_table)| !ignore_readonly || !data_table.is_code())
    }

    /// Returns true if the tables contain any cell at Pos (ie, not blank). Uses
    /// the DataTable's output_rect for the check to ensure that charts are
    /// included. Ignores Blanks.
    pub fn has_table_content_ignore_blanks(&self, pos: Pos) -> bool {
        self.data_table_that_contains(pos)
            .is_some_and(|(code_cell_pos, data_table)| {
                data_table
                        .cell_value_ref_at(
                            (pos.x - code_cell_pos.x) as u32,
                            (pos.y - code_cell_pos.y) as u32,
                        )
                        .is_some_and(|cell_value| {
                            !cell_value.is_blank_or_empty_string()
                        })
                        || data_table.is_html_or_image()
                        // also check if its the table name (the entire width of the table is valid for content)
                        || (data_table.get_show_name() && pos.y == code_cell_pos.y)
            })
    }

    /// Returns the CellValue for a CodeRun (if it exists) at the Pos.
    ///
    /// Note: spill error will return a CellValue::Blank to ensure calculations can continue.
    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        // First check for CellValue::Code in columns
        if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(pos) {
            return Some((*code_cell.output).clone());
        }

        // Otherwise check data_tables
        let (data_table_pos, data_table) = self.data_table_that_contains(pos)?;
        data_table.cell_value_at(
            (pos.x - data_table_pos.x) as u32,
            (pos.y - data_table_pos.y) as u32,
        )
    }

    /// Iterates over all CellValue::Code positions in the sheet
    pub fn iter_code_cells_positions(&self) -> Vec<Pos> {
        let mut positions = Vec::new();
        // Get the bounds of the columns
        if let Some(bounds) = self.columns.finite_bounds() {
            for y in bounds.y_range() {
                for x in bounds.x_range() {
                    let pos = Pos { x, y };
                    if matches!(self.cell_value_ref(pos), Some(CellValue::Code(_))) {
                        positions.push(pos);
                    }
                }
            }
        }
        positions
    }

    /// Returns true if there's any CellValue::Code in the given rect.
    /// TODO: Remove this once we support code cells inside tables.
    pub fn has_code_cell_in_rect(&self, rect: Rect) -> bool {
        for y in rect.y_range() {
            for x in rect.x_range() {
                let pos = Pos { x, y };
                if matches!(self.cell_value_ref(pos), Some(CellValue::Code(_))) {
                    return true;
                }
            }
        }
        false
    }

    /// Replaces table name references in CellValue::Code cells
    pub fn replace_table_name_in_code_value_cells(
        &mut self,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        let positions = self.iter_code_cells_positions();
        for pos in positions {
            if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(pos) {
                let mut new_code_run = code_cell.code_run.clone();
                let sheet_pos = pos.to_sheet_pos(self.id);
                new_code_run.replace_table_name_in_cell_references(
                    a1_context, sheet_pos, old_name, new_name,
                );
                if new_code_run.code != code_cell.code_run.code {
                    let new_code_cell = crate::CodeCell {
                        code_run: new_code_run,
                        output: code_cell.output.clone(),
                        last_modified: code_cell.last_modified,
                    };
                    self.set_value(pos, CellValue::Code(Box::new(new_code_cell)));
                }
            }
        }
    }

    /// Replaces column name references in CellValue::Code cells
    pub fn replace_column_name_in_code_value_cells(
        &mut self,
        table_name: &str,
        old_name: &str,
        new_name: &str,
        a1_context: &A1Context,
    ) {
        let positions = self.iter_code_cells_positions();
        for pos in positions {
            if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(pos) {
                let mut new_code_run = code_cell.code_run.clone();
                let sheet_pos = pos.to_sheet_pos(self.id);
                new_code_run.replace_column_name_in_cell_references(
                    a1_context, sheet_pos, table_name, old_name, new_name,
                );
                if new_code_run.code != code_cell.code_run.code {
                    let new_code_cell = crate::CodeCell {
                        code_run: new_code_run,
                        output: code_cell.output.clone(),
                        last_modified: code_cell.last_modified,
                    };
                    self.set_value(pos, CellValue::Code(Box::new(new_code_cell)));
                }
            }
        }
    }

    /// TODO(ddimaria): move to DataTable code
    pub fn get_code_cell_values(&self, rect: Rect) -> CellValues {
        self.iter_data_tables_in_rect(rect)
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
                Value::Tuple(_) | Value::Lambda(_) => vec![vec![]],
            })
            .collect::<Vec<Vec<CellValue>>>()
            .into()
    }

    /// Returns the code cell at a Pos; also returns the code cell if the Pos is part of a code run.
    /// Used for double clicking a cell on the grid.
    pub fn edit_code_value(&self, pos: Pos, a1_context: &A1Context) -> Option<JsCodeCell> {
        // First check for CellValue::Code in columns
        if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(pos) {
            let code_run = &code_cell.code_run;
            let mut code: String = code_run.code.clone();

            // replace internal cell references with a1 notation
            if matches!(code_run.language, CodeCellLanguage::Formula) {
                let replaced = convert_rc_to_a1(&code, a1_context, pos.to_sheet_pos(self.id));
                code = replaced;
            }

            let evaluation_result = match &code_run.error {
                Some(error) => Some(serde_json::to_string(error).unwrap_or("".into())),
                None => Some(serde_json::to_string(&*code_cell.output).unwrap_or("".into())),
            };

            let return_info = Some(JsReturnInfo {
                line_number: code_run.line_number,
                output_type: code_run.output_type.clone(),
            });

            return Some(JsCodeCell {
                x: pos.x,
                y: pos.y,
                code_string: code,
                language: code_run.language.clone(),
                std_err: code_run.std_err.clone(),
                std_out: code_run.std_out.clone(),
                evaluation_result,
                spill_error: None, // CellValue::Code never spills
                return_info,
                cells_accessed: Some(code_run.cells_accessed.clone().into()),
                last_modified: code_cell.last_modified.timestamp_millis(),
            });
        }

        // Otherwise check data_tables
        if let Some((code_pos, data_table)) = self.data_table_that_contains(pos)
            && let DataTableKind::CodeRun(code_run) = &data_table.kind
        {
            let mut code: String = code_run.code.clone();

            // replace internal cell references with a1 notation
            if matches!(code_run.language, CodeCellLanguage::Formula) {
                let replaced = convert_rc_to_a1(&code, a1_context, code_pos.to_sheet_pos(self.id));
                code = replaced;
            }

            let evaluation_result = match &code_run.error {
                Some(error) => Some(serde_json::to_string(error).unwrap_or("".into())),
                None => Some(serde_json::to_string(&data_table.value).unwrap_or("".into())),
            };

            let spill_error =
                match data_table.has_spill() {
                    true => Some(self.find_spill_error_reasons(
                        &data_table.output_rect(code_pos, true),
                        code_pos,
                    )),
                    false => None,
                };

            let return_info = Some(JsReturnInfo {
                line_number: code_run.line_number,
                output_type: code_run.output_type.clone(),
            });

            Some(JsCodeCell {
                x: code_pos.x,
                y: code_pos.y,
                code_string: code,
                language: code_run.language.clone(),
                std_err: code_run.std_err.clone(),
                std_out: code_run.std_out.clone(),
                evaluation_result,
                spill_error,
                return_info,
                cells_accessed: Some(code_run.cells_accessed.clone().into()),
                last_modified: data_table.last_modified.timestamp_millis(),
            })
        } else {
            None
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        Array, SheetPos, Value,
        controller::GridController,
        grid::{CodeCellLanguage, CodeRun, js_types::JsRenderCellSpecial},
    };
    use std::vec;

    #[test]
    fn test_edit_code_value() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "=".to_string(),
            formula_ast: None,
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
            Some(false),
            Some(false),
            None,
        );
        sheet.set_data_table(Pos { x: 1, y: 1 }, Some(data_table.clone()));
        let sheet = gc.sheet(sheet_id);
        let edit_code_value = sheet.edit_code_value(Pos { x: 1, y: 1 }, gc.a1_context());
        let last_modified = edit_code_value.as_ref().unwrap().last_modified;
        assert_eq!(
            edit_code_value,
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
                cells_accessed: Some(Default::default()),
                last_modified,
            })
        );
        let edit_code_value = sheet.edit_code_value(Pos { x: 2, y: 1 }, gc.a1_context());
        let last_modified = edit_code_value.as_ref().unwrap().last_modified;
        assert_eq!(
            edit_code_value,
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
                cells_accessed: Some(Default::default()),
                last_modified,
            })
        );
        assert_eq!(
            sheet.edit_code_value(Pos { x: 3, y: 3 }, gc.a1_context()),
            None
        );
    }

    #[test]
    fn edit_code_value_spill() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            "should cause spill".into(),
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
            "{1, 2, 3}".to_string(),
            None,
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(Pos { x: 2, y: 1 }),
            Some("should cause spill".into())
        );
        let render = sheet.get_render_cells(Rect::from_numbers(1, 1, 1, 1), gc.a1_context());
        assert_eq!(render[0].special, Some(JsRenderCellSpecial::SpillError));
        let code = sheet
            .edit_code_value(Pos { x: 1, y: 1 }, gc.a1_context())
            .unwrap();
        assert_eq!(code.spill_error, Some(vec![Pos { x: 2, y: 1 }]));
    }

    #[test]
    fn code_columns_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "".to_string(),
            formula_ast: None,
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
            Some(false),
            Some(false),
            None,
        );
        sheet.set_data_table(Pos { x: 1, y: 1 }, Some(data_table.clone()));
        sheet.set_data_table(Pos { x: 2, y: 2 }, Some(data_table.clone()));
        sheet.set_data_table(Pos { x: 3, y: 4 }, Some(data_table.clone()));

        assert_eq!(sheet.code_columns_bounds(1, 1), Some(1..4));
        assert_eq!(sheet.code_columns_bounds(2, 2), Some(2..5));
        assert_eq!(sheet.code_columns_bounds(2, 3), Some(2..7));
        assert_eq!(sheet.code_columns_bounds(1, 3), Some(1..7));
        assert_eq!(sheet.code_columns_bounds(-9, 1), Some(1..4));
        assert_eq!(sheet.code_columns_bounds(3, 6), Some(4..7));
        assert_eq!(sheet.code_columns_bounds(11, 11), None);
    }

    #[test]
    fn code_row_bounds() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: "".to_string(),
            formula_ast: None,
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
            Some(false),
            Some(false),
            None,
        );
        sheet.set_data_table(Pos { x: 1, y: 1 }, Some(data_table.clone()));
        sheet.set_data_table(Pos { x: 2, y: 2 }, Some(data_table.clone()));
        sheet.set_data_table(Pos { x: 4, y: 3 }, Some(data_table.clone()));

        assert_eq!(sheet.code_rows_bounds(1, 1), Some(1..4));
        assert_eq!(sheet.code_rows_bounds(2, 2), Some(2..5));
        assert_eq!(sheet.code_rows_bounds(2, 3), Some(2..7));
        assert_eq!(sheet.code_rows_bounds(1, 3), Some(1..7));
        assert_eq!(sheet.code_rows_bounds(-9, 1), Some(1..4));
        assert_eq!(sheet.code_rows_bounds(3, 6), Some(4..7));
        assert_eq!(sheet.code_rows_bounds(11, 11), None);
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
            Some(false),
            Some(false),
            None,
        );
        dt.chart_output = Some((2, 2));

        let pos = Pos { x: 1, y: 1 };
        sheet.set_data_table(pos, Some(dt.clone()));

        assert_eq!(sheet.chart_at(pos), Some((pos, &dt)));
        assert_eq!(sheet.chart_at(Pos { x: 2, y: 2 }), Some((pos, &dt)));
    }
}
