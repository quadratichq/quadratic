use indexmap::IndexMap;

use crate::{
    a1::{A1Selection, CellRefRange, RefRangeBounds, TableRef},
    grid::{
        js_types::{JsCellValuePosAIContext, JsCodeCell},
        GridBounds,
    },
    CellValue, Pos, Rect,
};

use super::Sheet;

impl Sheet {
    /// Returns a IndexMap<Pos, &CellValue> for a Selection in the Sheet.
    /// Values are in order of selection made.
    ///
    /// If the selection is empty or the count > max_count then it returns None.
    /// It ignores CellValue::Blank (except below), and CellValue::Code (since
    /// it uses the CodeRun instead).
    ///
    /// include_blanks will include CellValue::Blank when gathering cells within
    /// rects. Note: it will not place blanks for all, columns, or rows. (That
    /// has to happen within the client (todo), similar to how we show
    /// checkboxes or dropdown arrows for validations in rows, columns, and
    /// all.)
    ///
    /// Note: if the Code has an error, then it will not be part of the result
    /// (for now).
    pub fn selection_values(
        &self,
        selection: &A1Selection,
        max_count: Option<i64>,
        skip_code_runs: bool,
        include_blanks: bool,
    ) -> Option<IndexMap<Pos, &CellValue>> {
        let mut count = 0u64;
        let max_count = max_count.unwrap_or(i64::MAX) as u64;

        // we use a IndexMap to maintain the order of the cells
        let mut cells = IndexMap::new();

        // This checks whether we should skip a CellValue::Code. We skip the
        // code cell if `skip_code_runs`` is true. For example, when running
        // summarize, we want the values of the code run, not the actual code
        // cell. Conversely, when we're deleting a cell, we want the code cell,
        // not the code run.
        let check_code =
            |entry: &CellValue| skip_code_runs || !matches!(entry, &CellValue::Code(_));

        for range in selection.ranges.iter() {
            let rect = match range {
                CellRefRange::Sheet { range } => Some(self.ref_range_bounds_to_rect(range)),
                CellRefRange::Table { range } => self.table_ref_to_rect(range, false),
            };
            if let Some(rect) = rect {
                for x in rect.x_range() {
                    for y in rect.y_range() {
                        if let Some(entry) = self.cell_value_ref(Pos { x, y }) {
                            if (include_blanks || !matches!(entry, &CellValue::Blank))
                                && check_code(entry)
                            {
                                count += 1;
                                if count >= max_count {
                                    return None;
                                }
                                cells.insert(Pos { x, y }, entry);
                            }
                        } else if include_blanks {
                            count += 1;
                            if count >= max_count {
                                return None;
                            }
                            cells.insert(Pos { x, y }, &CellValue::Blank);
                        }
                    }
                }
            };

            if !skip_code_runs {
                for (pos, code_run) in self.data_tables.iter() {
                    let code_rect = code_run.output_rect(*pos, false, true);
                    for x in code_rect.x_range() {
                        for y in code_rect.y_range() {
                            if rect.is_some_and(|rect| rect.contains(Pos { x, y })) {
                                if let Some(entry) = code_run
                                    .cell_value_ref_at((x - pos.x) as u32, (y - pos.y) as u32)
                                {
                                    if !matches!(entry, &CellValue::Blank) {
                                        count += 1;
                                        if count >= max_count {
                                            return None;
                                        }
                                        cells.insert(Pos { x, y }, entry);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if cells.is_empty() {
            None
        } else {
            Some(cells)
        }
    }

    ///   Gets a selection of CellValues. This is useful for dealing with a
    ///   rectangular selection. It sorts the results by y and then x.
    pub fn selection_sorted_vec(
        &self,
        selection: &A1Selection,
        skip_code_runs: bool,
    ) -> Vec<(Pos, &CellValue)> {
        if let Some(map) = self.selection_values(selection, None, skip_code_runs, false) {
            let mut vec: Vec<_> = map.iter().map(|(pos, value)| (*pos, *value)).collect();
            vec.sort_by(|(a, _), (b, _)| {
                if a.y < b.y {
                    return std::cmp::Ordering::Less;
                }
                if a.y > b.y {
                    return std::cmp::Ordering::Greater;
                }
                a.x.cmp(&b.x)
            });
            vec
        } else {
            vec![]
        }
    }

    /// Returns tabular data rects of JsCellValuePos in a1 selection
    pub fn get_ai_context_rects_in_selection(
        &self,
        selection: A1Selection,
        max_rects: Option<usize>,
        max_rows: Option<u32>,
    ) -> Vec<JsCellValuePosAIContext> {
        let mut ai_context_rects = Vec::new();
        let selection_rects = self.selection_to_rects(&selection, false);
        let tabular_data_rects =
            self.find_tabular_data_rects_in_selection_rects(selection_rects, max_rects);
        for tabular_data_rect in tabular_data_rects {
            let js_cell_value_pos_ai_context = JsCellValuePosAIContext {
                sheet_name: self.name.clone(),
                rect_origin: tabular_data_rect.min.a1_string(),
                rect_width: tabular_data_rect.width(),
                rect_height: tabular_data_rect.height(),
                starting_rect_values: self
                    .get_js_cell_value_pos_in_rect(tabular_data_rect, max_rows),
            };
            ai_context_rects.push(js_cell_value_pos_ai_context);
        }
        ai_context_rects
    }

    /// Returns JsCodeCell for all code cells in selection rects that have errors
    pub fn get_errored_code_cells_in_selection(&self, selection: A1Selection) -> Vec<JsCodeCell> {
        let mut code_cells = Vec::new();
        let selection_rects = self.selection_to_rects(&selection, false);
        for selection_rect in selection_rects {
            for x in selection_rect.x_range() {
                if let Some(column) = self.get_column(x) {
                    for y in selection_rect.y_range() {
                        // check if there is a code cell
                        if let Some(CellValue::Code(_)) = column.values.get(&y) {
                            // if there is a code cell, then check if it has an error
                            if self
                                .data_table((x, y).into())
                                .map(|code_run| code_run.has_error())
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

    /// Converts a table ref to a rect.
    pub fn table_ref_to_rect(&self, range: &TableRef, force_headers: bool) -> Option<Rect> {
        range
            .convert_to_ref_range_bounds(false, &self.a1_context(), force_headers)
            .and_then(|range| range.to_rect())
    }

    /// Converts a cell reference range to a minimal rectangle covering the data
    /// on the sheet.
    pub fn ref_range_bounds_to_rect(&self, range: &RefRangeBounds) -> Rect {
        let start = range.start;
        let end = range.end;
        // ensure start is not unbounded (it shouldn't be)
        let rect_start: Pos = Pos {
            x: if start.col.is_unbounded() {
                1
            } else {
                start.col()
            },
            y: if start.row.is_unbounded() {
                1
            } else {
                start.row()
            },
        };

        let ignore_formatting = false;
        let rect_end = if end.is_unbounded() {
            if end.col.is_unbounded() && end.row.is_unbounded() {
                match self.bounds(ignore_formatting) {
                    GridBounds::NonEmpty(bounds) => Pos {
                        x: bounds.max.x,
                        y: bounds.max.y,
                    },
                    GridBounds::Empty => rect_start,
                }
            } else {
                // if there is an end, then calculate the end, goes up to bounds.max if infinite
                Pos {
                    x: if end.col.is_unbounded() {
                        // get max column for the range of rows
                        self.rows_bounds(start.row(), end.row(), ignore_formatting)
                            .map_or(rect_start.x, |(_, hi)| hi.max(rect_start.x))
                    } else {
                        end.col()
                    },
                    y: if end.row.is_unbounded() {
                        // get max row for the range of columns
                        self.columns_bounds(start.col(), end.col(), ignore_formatting)
                            .map_or(rect_start.y, |(_, hi)| hi.max(rect_start.y))
                    } else {
                        end.row()
                    },
                }
            }
        } else {
            Pos {
                x: end.col(),
                y: end.row(),
            }
        };

        Rect::new_span(rect_start, rect_end)
    }

    /// Resolves a selection to a union of rectangles. This is important for
    /// ensuring that all clients agree on the exact rectangles a transaction
    /// applies to.
    pub fn selection_to_rects(&self, selection: &A1Selection, force_headers: bool) -> Vec<Rect> {
        let mut rects = Vec::new();
        for range in selection.ranges.iter() {
            match range {
                CellRefRange::Sheet { range } => rects.push(self.ref_range_bounds_to_rect(range)),
                CellRefRange::Table { range } => {
                    if let Some(rect) = self.table_ref_to_rect(range, force_headers) {
                        rects.push(rect);
                    }
                }
            }
        }
        rects
    }

    /// Returns the smallest rect that contains all the ranges in the selection.
    /// Infinite selections are clamped at sheet data bounds.
    pub fn selection_bounds(&self, selection: &A1Selection) -> Option<Rect> {
        let rects = self.selection_to_rects(selection, false);
        if rects.is_empty() {
            None
        } else {
            rects.into_iter().reduce(|a, b| a.union(&b))
        }
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
                .filter_map(|range| match range {
                    CellRefRange::Sheet { range } => Some(CellRefRange::new_relative_rect(
                        self.ref_range_bounds_to_rect(range),
                    )),
                    CellRefRange::Table { range } => self
                        .table_ref_to_rect(range, false)
                        .map(CellRefRange::new_relative_rect),
                })
                .collect(),
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {

    use crate::{
        a1::{A1Selection, CellRefRange, RefRangeBounds, TableRef},
        grid::{
            js_types::{JsCellValuePosAIContext, JsCodeCell, JsReturnInfo},
            CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind,
        },
        Array, CellValue, Pos, Rect, RunError, RunErrorMsg, SheetRect, Value,
    };

    use super::Sheet;

    #[test]
    fn get_ai_context_rects_in_selection() {
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

        let selection = A1Selection::from_rect(SheetRect::new(1, 1, 50, 1300, sheet.id));
        let ai_context_rects_in_selection =
            sheet.get_ai_context_rects_in_selection(selection, None, Some(3));

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
    fn test_get_errored_code_cells_in_selection() {
        let mut sheet = Sheet::test();

        let code_run_1 = CodeRun {
            std_out: None,
            std_err: Some("error".to_string()),
            cells_accessed: Default::default(),
            error: Some(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("error".into()),
            }),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        sheet.set_cell_value(
            Pos { x: 1, y: 1 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "abcd".to_string(),
            }),
        );
        sheet.set_data_table(
            Pos { x: 1, y: 1 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run_1),
                "test",
                Default::default(),
                false,
                true,
                false,
                None,
            )),
        );

        let code_run_2 = CodeRun {
            std_out: None,
            std_err: Some("error".to_string()),
            cells_accessed: Default::default(),
            error: Some(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("error".into()),
            }),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        sheet.set_cell_value(
            Pos { x: 9, y: 31 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "abcd".to_string(),
            }),
        );
        sheet.set_data_table(
            Pos { x: 9, y: 31 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run_2),
                "test",
                Default::default(),
                false,
                true,
                false,
                None,
            )),
        );

        let code_run_3 = CodeRun {
            std_out: None,
            std_err: None,
            cells_accessed: Default::default(),
            error: None,
            // result: CodeRunResult::Ok(Value::Array(Array::from(vec![
            //     vec!["1".to_string(), "2".to_string()],
            //     vec!["3".to_string(), "4".to_string()],
            // ]))),
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
        };
        sheet.set_cell_value(
            Pos { x: 19, y: 15 },
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "[[1, 2], [3, 4]]".to_string(),
            }),
        );
        sheet.set_data_table(
            Pos { x: 19, y: 15 },
            Some(DataTable::new(
                DataTableKind::CodeRun(code_run_3),
                "test",
                Value::Array(Array::from(vec![
                    vec!["1".to_string(), "2".to_string()],
                    vec!["3".to_string(), "4".to_string()],
                ])),
                true,
                true,
                false,
                None,
            )),
        );

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
        sheet.set_cell_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_cell_value(pos![E5], CellValue::Text("E5".into()));
        sheet.recalculate_bounds();

        // Test fully specified range
        let range = RefRangeBounds::test_a1("A1:E5");
        let rect = sheet.ref_range_bounds_to_rect(&range);
        assert_eq!(rect, Rect::new(1, 1, 5, 5));

        // Test unbounded end
        let range = RefRangeBounds::test_a1("B2:");
        let rect = sheet.ref_range_bounds_to_rect(&range);
        assert_eq!(rect, Rect::new(2, 2, 5, 5)); // Should extend to sheet bounds
    }

    #[test]
    fn test_selection_to_rects() {
        let sheet = Sheet::test();
        let selection = A1Selection::test_a1("A1:C3,E5:G7");

        let rects = sheet.selection_to_rects(&selection, false);
        assert_eq!(rects, vec![Rect::new(1, 1, 3, 3), Rect::new(5, 5, 7, 7)]);
    }

    #[test]
    fn test_finitize_ref_range_bounds() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_cell_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_cell_value(pos![J10], CellValue::Text("J10".into()));
        sheet.recalculate_bounds();

        // Test unbounded range
        let range = RefRangeBounds::test_a1("B2:");
        let finite_range = sheet.ref_range_bounds_to_rect(&range);
        assert_eq!(finite_range, Rect::test_a1("B2:J10"));

        // Test already bounded range (should remain unchanged)
        let range = RefRangeBounds::test_a1("C3:E5");
        let finite_range = sheet.ref_range_bounds_to_rect(&range);
        assert_eq!(finite_range, Rect::test_a1("C3:E5"));

        // Test select all
        let range = RefRangeBounds::test_a1("*");
        let finite_range = sheet.ref_range_bounds_to_rect(&range);
        assert_eq!(finite_range, Rect::test_a1("A1:J10"));
    }

    #[test]
    fn test_finitize_selection() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_cell_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_cell_value(pos![J10], CellValue::Text("J10".into()));
        sheet.recalculate_bounds();

        let selection = A1Selection::test_a1("A1:C3,E5:");
        let finite_selection = sheet.finitize_selection(&selection);
        assert_eq!(
            finite_selection.ranges,
            vec![
                CellRefRange::test_a1("A1:C3"),
                CellRefRange::test_a1("E5:J10"),
            ]
        );

        // Test select all
        let selection = A1Selection::test_a1("*");
        let finite_selection = sheet.finitize_selection(&selection);
        assert_eq!(
            finite_selection.ranges,
            vec![CellRefRange::test_a1("A1:J10")]
        );
    }

    #[test]
    fn test_selection_bounds() {
        let mut sheet = Sheet::test();

        // Setup some data to establish sheet bounds
        sheet.set_cell_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_cell_value(pos![E5], CellValue::Text("E5".into()));
        sheet.recalculate_bounds();

        // Single cell selection
        let single_cell = A1Selection::test_a1("B2");
        assert_eq!(
            sheet.selection_bounds(&single_cell),
            Some(Rect::new(2, 2, 2, 2))
        );

        // Regular rectangular selection
        let rect_selection = A1Selection::test_a1("B2:D4");
        assert_eq!(
            sheet.selection_bounds(&rect_selection),
            Some(Rect::new(2, 2, 4, 4))
        );

        // Multiple disjoint rectangles
        let multi_rect = A1Selection::test_a1("A1:B2,D4:E5");
        assert_eq!(
            sheet.selection_bounds(&multi_rect),
            Some(Rect::new(1, 1, 5, 5))
        );

        // Overlapping rectangles
        let overlapping = A1Selection::test_a1("B2:D4,C3:E5");
        assert_eq!(
            sheet.selection_bounds(&overlapping),
            Some(Rect::new(2, 2, 5, 5))
        );

        // Infinite column selection (should be clamped to sheet bounds)
        let infinite_col = A1Selection::test_a1("C:C");
        assert_eq!(
            sheet.selection_bounds(&infinite_col),
            Some(Rect::new(3, 1, 3, 1))
        );

        // Infinite row selection (should be clamped to sheet bounds)
        let infinite_row = A1Selection::test_a1("3:3");
        assert_eq!(
            sheet.selection_bounds(&infinite_row),
            Some(Rect::new(1, 3, 1, 3))
        );

        // Select all (should be clamped to sheet bounds)
        let select_all = A1Selection::test_a1("*");
        assert_eq!(
            sheet.selection_bounds(&select_all),
            Some(Rect::new(1, 1, 5, 5))
        );

        // Multiple infinite selections (should be clamped to sheet bounds)
        let multi_infinite = A1Selection::test_a1("A:B,2:3");
        assert_eq!(
            sheet.selection_bounds(&multi_infinite),
            Some(Rect::new(1, 1, 2, 3))
        );

        // Mixed finite and infinite selections
        let mixed = A1Selection::test_a1("B2:C3,D:D,4:4");
        assert_eq!(sheet.selection_bounds(&mixed), Some(Rect::new(1, 1, 4, 4)));
    }

    #[test]
    fn test_table_ref_to_rect() {
        let mut sheet = Sheet::test();
        sheet.test_set_code_run_array_2d(1, 1, 2, 2, vec!["1", "2", "3", "4"]);
        let dt = sheet.data_table_mut(pos![A1]).unwrap();
        dt.show_header = true;

        let table_ref = TableRef::parse("Table1", &sheet.a1_context()).unwrap();
        assert_eq!(
            sheet.table_ref_to_rect(&table_ref, false),
            Some(Rect::test_a1("A2:B3"))
        );

        let table_ref = TableRef::parse("Table1[#HEADERS]", &sheet.a1_context()).unwrap();
        assert_eq!(
            sheet.table_ref_to_rect(&table_ref, false),
            Some(Rect::test_a1("A1:B1"))
        );

        let table_ref = TableRef::parse("Table1[#All]", &sheet.a1_context()).unwrap();
        assert_eq!(
            sheet.table_ref_to_rect(&table_ref, false),
            Some(Rect::test_a1("A1:B3"))
        );
        let table_ref = TableRef::parse("Table1", &sheet.a1_context()).unwrap();
        assert_eq!(
            sheet.table_ref_to_rect(&table_ref, true),
            Some(Rect::test_a1("A1:B3"))
        );
    }
}
