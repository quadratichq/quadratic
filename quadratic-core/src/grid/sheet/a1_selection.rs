use crate::{
    grid::{
        js_types::{JsCellValuePosAIContext, JsCodeCell},
        GridBounds,
    },
    A1Selection, CellRefRange, CellValue, Pos, Rect,
};

use super::Sheet;

impl Sheet {
    /// Returns tabular data rects of JsCellValuePos in a1 selection
    pub fn get_ai_context_rects_in_selection(
        &self,
        selection: A1Selection,
        max_rects: Option<usize>,
    ) -> Vec<JsCellValuePosAIContext> {
        let mut ai_context_rects = Vec::new();
        let selection_rects = self.selection_to_rects(&selection);
        let tabular_data_rects =
            self.find_tabular_data_rects_in_selection_rects(selection_rects, max_rects);
        for tabular_data_rect in tabular_data_rects {
            let js_cell_value_pos_ai_context = JsCellValuePosAIContext {
                sheet_name: self.name.clone(),
                rect_origin: tabular_data_rect.min.a1_string(),
                rect_width: tabular_data_rect.width(),
                rect_height: tabular_data_rect.height(),
                starting_rect_values: self
                    .get_js_cell_value_pos_in_rect(tabular_data_rect, Some(3)),
            };
            ai_context_rects.push(js_cell_value_pos_ai_context);
        }
        ai_context_rects
    }

    /// Returns JsCodeCell for all code cells in selection rects that have errors
    pub fn get_errored_code_cells_in_selection(&self, selection: A1Selection) -> Vec<JsCodeCell> {
        let mut code_cells = Vec::new();
        let selection_rects = self.selection_to_rects(&selection);
        for selection_rect in selection_rects {
            for x in selection_rect.x_range() {
                if let Some(column) = self.get_column(x) {
                    for y in selection_rect.y_range() {
                        // check if there is a code cell
                        if let Some(CellValue::Code(_)) = column.values.get(&y) {
                            // if there is a code cell, then check if it has an error
                            if self
                                .code_run((x, y).into())
                                .map(|code_run| {
                                    code_run
                                        .std_err
                                        .as_ref()
                                        .map(|err| !err.is_empty())
                                        .unwrap_or(false)
                                })
                                .unwrap_or(false)
                            {
                                // if there is an error, then add the code cell to the vec
                                if let Some(code_cell) = self.edit_code_value((x, y).into()) {
                                    code_cells.push(code_cell);
                                }
                            }
                        }
                    }
                }
            }
        }
        code_cells
    }

    /// Converts a cell reference range to a minimal rectangle covering the data
    /// on the sheet.
    pub fn cell_ref_range_to_rect(&self, cell_ref_range: CellRefRange) -> Rect {
        let CellRefRange { start, end } = cell_ref_range;

        let start_col = start.col.map_or(1, |c| c.coord) as i64;
        let start_row = start.row.map_or(1, |r| r.coord) as i64;
        let start = Pos {
            x: start_col,
            y: start_row,
        };

        let ignore_bounds = false;
        let bounds = match self.bounds(ignore_bounds) {
            GridBounds::Empty => Rect::single_pos(start),
            GridBounds::NonEmpty(rect) => rect,
        };
        let end_col = end.and_then(|end| end.col).map(|r| r.coord as i64);
        let end_row = end.and_then(|end| end.row).map(|r| r.coord as i64);

        let end = Pos {
            x: end_col.unwrap_or_else(|| {
                let a = start_row;
                let b = end_row.unwrap_or(bounds.max.y);
                match self.rows_bounds(std::cmp::min(a, b), std::cmp::max(a, b), ignore_bounds) {
                    Some((_lo, hi)) => hi,
                    None => start_row,
                }
            }),
            y: end_col.unwrap_or_else(|| {
                let a = start_col;
                let b = end_col.unwrap_or(bounds.max.y);
                match self.columns_bounds(std::cmp::min(a, b), std::cmp::max(a, b), ignore_bounds) {
                    Some((_lo, hi)) => hi,
                    None => start_col,
                }
            }),
        };

        Rect::new_span(start, end)
    }

    /// Resolves a selection to a union of rectangles. This is important for
    /// ensuring that all clients agree on the exact rectangles a transaction
    /// applies to.
    pub fn selection_to_rects(&self, selection: &A1Selection) -> Vec<Rect> {
        selection
            .ranges
            .iter()
            .map(|&range| self.cell_ref_range_to_rect(range))
            .collect()
    }

    /// Converts an unbounded cell reference range to a finite rectangle via
    /// [`Self::cell_ref_range_to_rect()`]. Bounded ranges are returned
    /// unmodified.
    pub fn finitize_cell_ref_range(&self, cell_ref_range: CellRefRange) -> CellRefRange {
        CellRefRange::new_relative_rect(self.cell_ref_range_to_rect(cell_ref_range))
    }

    /// Converts unbounded regions in a selection to finite rectangular regions.
    /// Bounded regions are unmodified.
    pub fn finitize_selection(&self, selection: &A1Selection) -> A1Selection {
        A1Selection {
            sheet_id: selection.sheet_id,
            cursor: selection.cursor,
            ranges: selection
                .ranges
                .iter()
                .map(|&range| self.finitize_cell_ref_range(range))
                .collect(),
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use chrono::Utc;

    use crate::{
        grid::{
            js_types::{JsCellValuePosAIContext, JsCodeCell, JsReturnInfo},
            CodeCellLanguage, CodeRun, CodeRunResult,
        },
        A1Selection, Array, CellRefRange, CellValue, CodeCellValue, Pos, Rect, RunError,
        RunErrorMsg, SheetRect, Value,
    };

    use super::Sheet;

    #[test]
    fn js_ai_context_rects_in_sheet_rect() {
        let mut sheet = Sheet::test();
        sheet.set_cell_values(
            Rect {
                min: Pos { x: 1, y: 1 },
                max: Pos { x: 10, y: 1000 },
            },
            &Array::from(
                (1..=1000)
                    .map(|row| {
                        (1..=10)
                            .map(|_| {
                                if row == 1 {
                                    "heading1".to_string()
                                } else {
                                    "value1".to_string()
                                }
                            })
                            .collect::<Vec<String>>()
                    })
                    .collect::<Vec<Vec<String>>>(),
            ),
        );

        sheet.set_cell_values(
            Rect {
                min: Pos { x: 31, y: 101 },
                max: Pos { x: 40, y: 1100 },
            },
            &Array::from(
                (1..=1000)
                    .map(|row| {
                        (1..=10)
                            .map(|_| {
                                if row == 1 {
                                    "heading2".to_string()
                                } else {
                                    "value3".to_string()
                                }
                            })
                            .collect::<Vec<String>>()
                    })
                    .collect::<Vec<Vec<String>>>(),
            ),
        );

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 10000, 10000, sheet.id));
        let ai_context_rects_in_selection =
            sheet.get_ai_context_rects_in_selection(selection, None);

        let max_rows = 3;

        let expected_ai_context_rects_in_selection = vec![
            JsCellValuePosAIContext {
                sheet_name: sheet.name.clone(),
                rect_origin: Pos { x: 1, y: 1 }.a1_string(),
                rect_width: 10,
                rect_height: 1000,
                starting_rect_values: sheet.get_js_cell_value_pos_in_rect(
                    Rect {
                        min: Pos { x: 1, y: 1 },
                        max: Pos { x: 10, y: 1000 },
                    },
                    Some(max_rows),
                ),
            },
            JsCellValuePosAIContext {
                sheet_name: sheet.name.clone(),
                rect_origin: Pos { x: 31, y: 101 }.a1_string(),
                rect_width: 10,
                rect_height: 1000,
                starting_rect_values: sheet.get_js_cell_value_pos_in_rect(
                    Rect {
                        min: Pos { x: 31, y: 101 },
                        max: Pos { x: 40, y: 1100 },
                    },
                    Some(max_rows),
                ),
            },
        ];

        assert_eq!(
            ai_context_rects_in_selection,
            expected_ai_context_rects_in_selection
        );
    }

    #[test]
    fn js_errored_code_cell_rect() {
        let mut sheet = Sheet::test();

        let code_run_1 = CodeRun {
            std_out: None,
            std_err: Some("error".to_string()),
            formatted_code_string: None,
            last_modified: Utc::now(),
            cells_accessed: Default::default(),
            result: CodeRunResult::Err(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("error".into()),
            }),
            return_type: None,
            line_number: None,
            output_type: None,
            spill_error: false,
        };
        sheet.set_cell_value(
            Pos { x: 1, y: 1 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "abcd".to_string(),
            }),
        );
        sheet.set_code_run(Pos { x: 1, y: 1 }, Some(code_run_1));

        let code_run_2 = CodeRun {
            std_out: None,
            std_err: Some("error".to_string()),
            formatted_code_string: None,
            last_modified: Utc::now(),
            cells_accessed: Default::default(),
            result: CodeRunResult::Err(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("error".into()),
            }),
            return_type: None,
            line_number: None,
            output_type: None,
            spill_error: false,
        };
        sheet.set_cell_value(
            Pos { x: 9, y: 31 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "abcd".to_string(),
            }),
        );
        sheet.set_code_run(Pos { x: 9, y: 31 }, Some(code_run_2));

        let code_run_3 = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            last_modified: Utc::now(),
            cells_accessed: Default::default(),
            result: CodeRunResult::Ok(Value::Array(Array::from(vec![
                vec!["1".to_string(), "2".to_string()],
                vec!["3".to_string(), "4".to_string()],
            ]))),
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            spill_error: true,
        };
        sheet.set_cell_value(
            Pos { x: 19, y: 15 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "[[1, 2], [3, 4]]".to_string(),
            }),
        );
        sheet.set_code_run(Pos { x: 19, y: 15 }, Some(code_run_3));

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 1000, 1000, sheet.id));
        let js_errored_code_cells = sheet.get_errored_code_cells_in_selection(selection);

        assert_eq!(js_errored_code_cells.len(), 2);

        let expected_js_errored_code_cells = vec![
            JsCodeCell {
                x: 1,
                y: 1,
                code_string: "abcd".to_string(),
                language: CodeCellLanguage::Python,
                std_err: Some("error".to_string()),
                std_out: None,
                evaluation_result: Some(
                    "{\"span\":null,\"msg\":{\"CodeRunError\":\"error\"}}".to_string(),
                ),
                spill_error: None,
                return_info: Some(JsReturnInfo {
                    line_number: None,
                    output_type: None,
                }),
                cells_accessed: Some(Default::default()),
            },
            JsCodeCell {
                x: 9,
                y: 31,
                code_string: "abcd".to_string(),
                language: CodeCellLanguage::Python,
                std_err: Some("error".to_string()),
                std_out: None,
                evaluation_result: Some(
                    "{\"span\":null,\"msg\":{\"CodeRunError\":\"error\"}}".to_string(),
                ),
                spill_error: None,
                return_info: Some(JsReturnInfo {
                    line_number: None,
                    output_type: None,
                }),
                cells_accessed: Some(Default::default()),
            },
        ];

        assert_eq!(js_errored_code_cells, expected_js_errored_code_cells);
    }

    #[test]
    fn test_cell_ref_range_to_rect() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("A1".into()));
        sheet.set_cell_value(Pos { x: 5, y: 5 }, CellValue::Text("E5".into()));
        sheet.recalculate_bounds();

        // Test fully specified range
        let range = CellRefRange::test("A1:E5");
        let rect = sheet.cell_ref_range_to_rect(range);
        assert_eq!(rect, Rect::new(1, 1, 5, 5));

        // Test unbounded end
        let range = CellRefRange::test("B2:");
        let rect = sheet.cell_ref_range_to_rect(range);
        assert_eq!(rect, Rect::new(2, 2, 5, 5)); // Should extend to sheet bounds
    }

    #[test]
    fn test_selection_to_rects() {
        let sheet = Sheet::test();
        let selection = A1Selection {
            sheet_id: sheet.id,
            cursor: Pos { x: 1, y: 1 },
            ranges: vec![CellRefRange::test("A1:C3"), CellRefRange::test("E5:G7")],
        };

        let rects = sheet.selection_to_rects(&selection);
        assert_eq!(rects, vec![Rect::new(1, 1, 3, 3), Rect::new(5, 5, 7, 7)]);
    }

    #[test]
    fn test_finitize_cell_ref_range() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("A1".into()));
        sheet.set_cell_value(Pos { x: 10, y: 10 }, CellValue::Text("J10".into()));
        sheet.recalculate_bounds();

        // Test unbounded range
        let range = CellRefRange::test("B2:");
        let finite_range = sheet.finitize_cell_ref_range(range);
        assert_eq!(finite_range, CellRefRange::test("B2:J10"));

        // Test already bounded range (should remain unchanged)
        let range = CellRefRange::test("C3:E5");
        let finite_range = sheet.finitize_cell_ref_range(range);
        assert_eq!(finite_range, CellRefRange::test("C3:E5"));
    }

    #[test]
    fn test_finitize_selection() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Text("A1".into()));
        sheet.set_cell_value(Pos { x: 10, y: 10 }, CellValue::Text("J10".into()));
        sheet.recalculate_bounds();

        let selection = A1Selection {
            sheet_id: sheet.id,
            cursor: Pos { x: 1, y: 1 },
            ranges: vec![
                CellRefRange::test("A1:C3"), // bounded
                CellRefRange::test("E5:"),   // unbounded
            ],
        };

        let finite_selection = sheet.finitize_selection(&selection);
        assert_eq!(
            finite_selection.ranges,
            vec![CellRefRange::test("A1:C3"), CellRefRange::test("E5:J10"),]
        );
    }
}
