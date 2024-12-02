use indexmap::IndexMap;

use crate::{
    grid::{
        js_types::{JsCellValuePosAIContext, JsCodeCell},
        CodeRunResult, GridBounds,
    },
    A1Selection, CellRefRange, CellValue, Pos, Rect, RefRangeBounds, Value,
};

use super::Sheet;

impl Sheet {
    /// Returns a HashMap<Pos, &CellValue> for a Selection in the Sheet. Note:
    /// there's an order of precedence in enumerating the selection:
    /// 1. All
    /// 2. Columns
    /// 3. Rows
    /// 4. Rects
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
        dbgjs!("todo(ayush): add more tests for A1Selection");

        let subspaces = selection.subspaces();

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

        if let Some(all_pos) = subspaces.all {
            for (&x, column) in self.columns.range(all_pos.x..) {
                count += column.values.range(all_pos.x..).count() as u64;
                if count >= max_count {
                    return None;
                }
                cells.extend(column.values.range(all_pos.y..).filter_map(|(&y, entry)| {
                    if !matches!(entry, &CellValue::Blank) && check_code(entry) {
                        Some((Pos { x, y }, entry))
                    } else {
                        None
                    }
                }));
            }
            if !skip_code_runs {
                for (pos, code_run) in self.code_runs.iter() {
                    match code_run.result {
                        CodeRunResult::Ok(ref value) => match value {
                            Value::Single(v) => {
                                if pos.x < all_pos.x || pos.y < all_pos.y {
                                    continue;
                                }
                                count += 1;
                                if count >= max_count {
                                    return None;
                                }
                                cells.insert(*pos, v);
                            }
                            Value::Array(a) => {
                                for x in 0..a.width() {
                                    for y in 0..a.height() {
                                        let pos = Pos {
                                            x: pos.x + x as i64,
                                            y: pos.y + y as i64,
                                        };

                                        if pos.x < all_pos.x || pos.y < all_pos.y {
                                            continue;
                                        }

                                        if let Ok(entry) = a.get(x, y) {
                                            if include_blanks || !matches!(entry, &CellValue::Blank)
                                            {
                                                count += 1;
                                                if count >= max_count {
                                                    return None;
                                                }
                                                cells.insert(pos, entry);
                                            }
                                        } else if include_blanks {
                                            count += 1;
                                            if count >= max_count {
                                                return None;
                                            }
                                            cells.insert(pos, &CellValue::Blank);
                                        }
                                    }
                                }
                            }
                            Value::Tuple(_) => {} // Tuples are not spilled onto the grid
                        },
                        CodeRunResult::Err(_) => {}
                    }
                }
            }

            // if selection.all, then we don't need to check the other selections
            return Some(cells.into_iter().collect());
        }

        if !subspaces.cols.is_empty() {
            for (col, min_row) in subspaces.cols.iter() {
                if let Some(column) = self.columns.get(col) {
                    count += column.values.range(min_row..).count() as u64;
                    if count >= max_count {
                        return None;
                    }
                    cells.extend(column.values.range(min_row..).filter_map(|(y, entry)| {
                        if !matches!(entry, &CellValue::Blank) && check_code(entry) {
                            Some((Pos { x: *col, y: *y }, entry))
                        } else {
                            None
                        }
                    }));
                }
            }
            if !skip_code_runs {
                for (pos, code_run) in self.code_runs.iter() {
                    let rect = code_run.output_rect(*pos, false);
                    for (col, min_row) in subspaces.cols.iter() {
                        if *col >= rect.min.x && *col <= rect.max.x && *min_row <= rect.max.y {
                            let min_row = *min_row;
                            for x in rect.min.x..=rect.max.x {
                                if subspaces.cols.contains_key(&x) {
                                    for y in rect.min.y..=rect.max.y {
                                        if y < min_row {
                                            continue;
                                        }
                                        if let Some(entry) = code_run.cell_value_ref_at(
                                            (x - pos.x) as u32,
                                            (y - pos.y) as u32,
                                        ) {
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
            }
        }

        if !subspaces.rows.is_empty() {
            for (&x, column) in self.columns.iter() {
                for (&y, entry) in column.values.iter() {
                    if let Some(min_col) = subspaces.rows.get(&y) {
                        if x < *min_col {
                            continue;
                        }
                        if !matches!(entry, &CellValue::Blank) && check_code(entry) {
                            count += 1;
                            if count >= max_count {
                                return None;
                            }
                            cells.insert(Pos { x, y }, entry);
                        }
                    }
                }
            }
            if !skip_code_runs {
                for (pos, code_run) in self.code_runs.iter() {
                    let rect = code_run.output_rect(*pos, false);
                    for y in rect.min.y..=rect.max.y {
                        if let Some(min_col) = subspaces.rows.get(&y) {
                            for x in rect.min.x..=rect.max.x {
                                if x < *min_col {
                                    continue;
                                }
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

        if !subspaces.rects.is_empty() {
            for rect in subspaces.rects.iter() {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
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
            }
            if !skip_code_runs {
                for (pos, code_run) in self.code_runs.iter() {
                    let rect = code_run.output_rect(*pos, false);
                    for x in rect.min.x..=rect.max.x {
                        for y in rect.min.y..=rect.max.y {
                            if subspaces
                                .rects
                                .iter()
                                .any(|rect| rect.contains(Pos { x, y }))
                            {
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
        match cell_ref_range {
            CellRefRange::Sheet { range } => {
                let RefRangeBounds { start, end } = range;

                let rect_start = Pos {
                    x: start.col.map_or(1, |c| c.coord),
                    y: start.row.map_or(1, |r| r.coord),
                };

                let ignore_formatting = false;
                let bounds = match self.bounds(ignore_formatting) {
                    GridBounds::Empty => Rect::single_pos(rect_start),
                    GridBounds::NonEmpty(rect) => rect,
                };

                let rect_end = match end {
                    // if there is an end, then calculate the end, goes up to bounds.max if infinite
                    Some(end) => {
                        let end_col = end.col.map(|c| c.coord);
                        let end_row = end.row.map(|r| r.coord);
                        Pos {
                            x: end_col.unwrap_or_else(|| {
                                let a = start.row.map_or(bounds.min.y, |c| c.coord);
                                let b = end_row.unwrap_or(bounds.max.y);
                                // get max column for the range of rows
                                self.rows_bounds(
                                    std::cmp::min(a, b),
                                    std::cmp::max(a, b),
                                    ignore_formatting,
                                )
                                .map_or(rect_start.x, |(_, hi)| hi)
                            }),
                            y: end_row.unwrap_or_else(|| {
                                let a = start.col.map_or(bounds.min.x, |c| c.coord);
                                let b = end_col.unwrap_or(bounds.max.x);
                                // get max row for the range of columns
                                self.columns_bounds(
                                    std::cmp::min(a, b),
                                    std::cmp::max(a, b),
                                    ignore_formatting,
                                )
                                .map_or(rect_start.y, |(_, hi)| hi)
                            }),
                        }
                    }
                    // if no end, build end same as start, if start is infinite then end is infinite
                    None => match (start.col, start.row) {
                        (None, None) => bounds.max,
                        (Some(_), None) => Pos {
                            x: rect_start.x,
                            // get max column for the row
                            y: self
                                .column_bounds(rect_start.x, ignore_formatting)
                                .map_or(rect_start.y, |(_, hi)| hi),
                        },
                        (None, Some(_)) => Pos {
                            // get max row for the column
                            x: self
                                .row_bounds(rect_start.y, ignore_formatting)
                                .map_or(rect_start.x, |(_, hi)| hi),
                            y: rect_start.y,
                        },
                        (Some(_), Some(_)) => rect_start,
                    },
                };

                Rect::new_span(rect_start, rect_end)
            }
        }
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

    /// Returns the content and formatting bounds for a Selection.
    ///
    /// * For all, it returns the data+formatting bounds for the sheet.
    /// * For rects, it returns the largest bounds around the rects.
    /// * For columns or rows, it returns the data+formatting bounds around the
    ///   columns and/or rows.
    pub fn selection_bounds(&self, selection: &A1Selection) -> Option<Rect> {
        dbgjs!("todo(ayush): add tests for this and update description");
        let rects = self.selection_to_rects(selection);
        if rects.is_empty() {
            None
        } else {
            rects.into_iter().reduce(|a, b| a.union(&b))
        }
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
        sheet.set_cell_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_cell_value(pos![E5], CellValue::Text("E5".into()));
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
        let selection = A1Selection::test_a1("A1:C3,E5:G7");

        let rects = sheet.selection_to_rects(&selection);
        assert_eq!(rects, vec![Rect::new(1, 1, 3, 3), Rect::new(5, 5, 7, 7)]);
    }

    #[test]
    fn test_finitize_cell_ref_range() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_cell_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_cell_value(pos![J10], CellValue::Text("J10".into()));
        sheet.recalculate_bounds();

        // Test unbounded range
        let range = CellRefRange::test("B2:");
        let finite_range = sheet.finitize_cell_ref_range(range);
        assert_eq!(finite_range, CellRefRange::test("B2:J10"));

        // Test already bounded range (should remain unchanged)
        let range = CellRefRange::test("C3:E5");
        let finite_range = sheet.finitize_cell_ref_range(range);
        assert_eq!(finite_range, CellRefRange::test("C3:E5"));

        // Test select all
        let range = CellRefRange::test("*");
        let finite_range = sheet.finitize_cell_ref_range(range);
        assert_eq!(finite_range, CellRefRange::test("A1:J10"));
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
            vec![CellRefRange::test("A1:C3"), CellRefRange::test("E5:J10"),]
        );

        // Test select all
        let selection = A1Selection::test_a1("*");
        let finite_selection = sheet.finitize_selection(&selection);
        assert_eq!(finite_selection.ranges, vec![CellRefRange::test("A1:J10")]);
    }
}
