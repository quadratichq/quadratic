use std::ops::Range;

use super::Sheet;
use crate::{
    CellValue, MultiPos, MultiSheetPos, Pos, Rect, Value,
    cell_values::CellValues,
    grid::{
        CodeCellValue, DataTableKind,
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
                        .display_value_ref_at(
                            (pos.x - code_cell_pos.x,
                            pos.y - code_cell_pos.y).into(),
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
    /// TODO(ddimaria): move to DataTable code
    pub fn get_code_cell_value(&self, pos: Pos) -> Option<CellValue> {
        let (data_table_pos, data_table) = self.data_table_that_contains(pos)?;

        let cell_value = data_table
            .display_value_ref_at((pos.x - data_table_pos.x, pos.y - data_table_pos.y).into())?;

        // cell_value is a code cell (sub table)
        if cell_value.is_code() {
            let pos_relative_to_data_table = Pos::new(
                pos.x - data_table_pos.x,
                pos.y - data_table_pos.y - data_table.y_adjustment(true),
            );

            let column_index = data_table.get_column_index_from_display_index(
                u32::try_from(pos_relative_to_data_table.x).ok()?,
                true,
            );
            let row_index = data_table.get_row_index_from_display_index(
                u64::try_from(pos_relative_to_data_table.y).ok()?,
            );

            let sub_data_table = data_table.tables.as_ref().and_then(|tables| {
                tables.get_at(&MultiPos::new_pos(
                    (column_index as i64, row_index as i64).into(),
                ))
            })?;

            sub_data_table.display_value_at((0, 0).into())
        } else {
            Some(cell_value.to_owned())
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
                                    .display_value_at(
                                        (x - data_table_rect.min.x, y - data_table_rect.min.y)
                                            .into(),
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

    /// Returns the code cell at a Pos; also returns the code cell if the Pos is part of a code run.
    /// Used for double clicking a cell on the grid.
    pub fn edit_code_value(&self, pos: Pos) -> Option<JsCodeCell> {
        let (code_multi_pos,  code_cell_value) =
            // check for code cell on the sheet
            if let Some(cell_value) = self.cell_value_ref(pos) {
                (pos.to_multi_pos(), cell_value.code_cell_value()?)
            }
            // check for code cell within a table
            else if let Some((table_pos, Some(code_cell_value))) =
                self.display_pos_to_table_pos(pos).map(|table_pos| {
                    (
                        MultiPos::TablePos(table_pos),
                        self.table_pos_code_value(table_pos)
                            .map(|code_cell_value| code_cell_value.to_owned()),
                    )
                })
            {
                (table_pos, code_cell_value)
            }
            // return the code table that contains the pos
            else {
                let data_table_pos = self.data_table_pos_that_contains(pos)?;
                (
                    data_table_pos.to_multi_pos(),
                    self.cell_value_ref(data_table_pos)
                        .and_then(|cell_value| cell_value.code_cell_value())?,
                )
            };

        let code_pos = code_multi_pos.to_sheet_pos(self)?;

        if let Some(data_table) = self.data_table_at(&code_multi_pos) {
            let evaluation_result = serde_json::to_string(&data_table.value).unwrap_or("".into());
            let spill_error = if data_table.has_spill() {
                Some(self.find_spill_error_reasons(
                    &data_table.output_rect(code_pos.into(), true),
                    code_pos.into(),
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
                        last_modified: data_table.last_modified.timestamp_millis(),
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
                    last_modified: 0,
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
                last_modified: 0,
            })
        }
    }

    /// Returns the code cell value at the MultiPos.
    pub fn code_value(&self, multi_pos: MultiPos) -> Option<&CodeCellValue> {
        match multi_pos {
            MultiPos::Pos(pos) => match self.cell_value_ref(pos) {
                Some(CellValue::Code(code)) => Some(code),
                _ => None,
            },
            MultiPos::TablePos(table_pos) => self.table_pos_code_value(table_pos),
        }
    }

    /// Converts a Pos to a MultiPos, checking whether the Pos is a sheet pos or
    /// a table pos. Will return a MultiPos::SheetPos for all code tables and
    /// DataTable anchor cells.
    pub fn convert_to_multi_sheet_pos(&self, display_pos: Pos) -> MultiSheetPos {
        if let Some(table_pos) = self.display_pos_to_table_pos(display_pos) {
            MultiSheetPos::new(self.id, MultiPos::TablePos(table_pos))
        } else {
            MultiSheetPos::new(self.id, MultiPos::Pos(display_pos))
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        Array, SheetPos, Value,
        controller::GridController,
        grid::{CodeCellLanguage, CodeCellValue, CodeRun, js_types::JsRenderCellSpecial},
        test_util::*,
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
            language: CodeCellLanguage::Formula,
            code: "=".to_string(),
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
        let edit_code_value = sheet.edit_code_value(Pos { x: 1, y: 1 });
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
        let edit_code_value = sheet.edit_code_value(Pos { x: 2, y: 1 });
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
        assert_eq!(sheet.edit_code_value(Pos { x: 3, y: 3 }), None);
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
            SheetPos::new(sheet_id, 1, 1),
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
        let code = sheet.edit_code_value(Pos { x: 1, y: 1 }).unwrap();
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
        sheet.set_cell_value(
            pos,
            CellValue::Code(CodeCellValue {
                code: "".to_string(),
                language: CodeCellLanguage::Javascript,
            }),
        );
        sheet.set_data_table(pos, Some(dt.clone()));

        assert_eq!(sheet.chart_at(pos), Some((pos, &dt)));
        assert_eq!(sheet.chart_at(Pos { x: 2, y: 2 }), Some((pos, &dt)));
    }

    #[test]
    fn test_convert_to_multi_pos() {
        let (mut gc, sheet_id) = test_grid();

        test_create_data_table(&mut gc, sheet_id, Pos { x: 2, y: 2 }, 3, 3);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.convert_to_multi_sheet_pos(pos![A1]),
            MultiSheetPos::new(sheet_id, MultiPos::new_pos((1, 1).into()))
        );

        assert_eq!(
            sheet.convert_to_multi_sheet_pos(pos![B4]),
            MultiSheetPos::new(sheet_id, MultiPos::new_table_pos(pos![2, 2], pos![0, 0]))
        );
        assert_eq!(
            sheet.convert_to_multi_sheet_pos(pos![D6]),
            MultiSheetPos::new(sheet_id, MultiPos::new_table_pos(pos![2, 2], pos![2, 2]))
        );

        // anchor cell of data table
        assert_eq!(
            sheet.convert_to_multi_sheet_pos(pos![B2]),
            MultiSheetPos::new(sheet_id, MultiPos::new_pos((2, 2).into()))
        );

        // code table
        test_create_code_table(&mut gc, sheet_id, pos![E2], 2, 2);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.convert_to_multi_sheet_pos(pos![F3]),
            MultiSheetPos::new(sheet_id, MultiPos::new_pos((6, 3).into()))
        );
    }
}
