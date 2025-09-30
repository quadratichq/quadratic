use indexmap::IndexMap;

use crate::{
    CellValue, Pos, Rect,
    a1::{A1Context, A1Selection, CellRefRange, ColRange, RefRangeBounds, TableRef},
    grid::GridBounds,
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
    pub(crate) fn selection_values(
        &self,
        selection: &A1Selection,
        max_count: Option<i64>,
        skip_code_runs: bool,
        include_blanks: bool,
        ignore_formatting: bool,
        a1_context: &A1Context,
    ) -> Option<IndexMap<Pos, &CellValue>> {
        let mut count = 0u64;
        let max_count = max_count.unwrap_or(i64::MAX) as u64;

        // we use a IndexMap to maintain the order of the cells
        let mut cells = IndexMap::new();

        for range in selection.ranges.iter() {
            let rect = match range {
                CellRefRange::Sheet { range } => {
                    Some(self.ref_range_bounds_to_rect(range, ignore_formatting))
                }
                CellRefRange::Table { range } => {
                    self.table_ref_to_rect(range, false, false, a1_context)
                }
            };
            if let Some(rect) = rect {
                for x in rect.x_range() {
                    for y in rect.y_range() {
                        if let Some(entry) = self.cell_value_ref(Pos { x, y }) {
                            if include_blanks || !matches!(entry, &CellValue::Blank) {
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

                if !skip_code_runs {
                    for (_, pos, data_table) in self.data_tables.get_in_rect(rect, false) {
                        let data_table_rect = data_table.output_rect(pos, false);
                        if let Some(intersection) = data_table_rect.intersection(&rect) {
                            for x in intersection.x_range() {
                                for y in intersection.y_range() {
                                    if let Some(entry) = data_table
                                        .cell_value_ref_at((x - pos.x) as u32, (y - pos.y) as u32)
                                        && !matches!(entry, &CellValue::Blank)
                                    {
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
            };
        }

        if cells.is_empty() { None } else { Some(cells) }
    }

    ///   Gets a selection of CellValues. This is useful for dealing with a
    ///   rectangular selection. It sorts the results by y and then x.
    pub(crate) fn selection_sorted_vec(
        &self,
        selection: &A1Selection,
        skip_code_runs: bool,
        ignore_formatting: bool,
        a1_context: &A1Context,
    ) -> Vec<(Pos, &CellValue)> {
        if let Some(map) = self.selection_values(
            selection,
            None,
            skip_code_runs,
            false,
            ignore_formatting,
            a1_context,
        ) {
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

    /// Converts a table ref to a rect.
    ///
    /// See `convert_to_ref_range_bounds()` for a description of the boolean
    /// parameters.
    pub(crate) fn table_ref_to_rect(
        &self,
        range: &TableRef,
        force_columns: bool,
        auto_detect_table_bounds: bool,
        a1_context: &A1Context,
    ) -> Option<Rect> {
        let force_table_bounds = auto_detect_table_bounds && range.col_range == ColRange::All;

        range
            .convert_to_ref_range_bounds(false, a1_context, force_columns, force_table_bounds)
            .and_then(|range| range.as_rect())
    }

    /// Converts a cell reference range to a minimal rectangle covering the data
    /// on the sheet.
    pub(crate) fn ref_range_bounds_to_rect(
        &self,
        range: &RefRangeBounds,
        ignore_formatting: bool,
    ) -> Rect {
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
    pub(crate) fn selection_to_rects(
        &self,
        selection: &A1Selection,
        force_columns: bool,
        auto_detect_table_bounds: bool,
        ignore_formatting: bool,
        a1_context: &A1Context,
    ) -> Vec<Rect> {
        let mut rects = Vec::new();
        for range in selection.ranges.iter() {
            match range {
                CellRefRange::Sheet { range } => {
                    rects.push(self.ref_range_bounds_to_rect(range, ignore_formatting));
                }
                CellRefRange::Table { range } => {
                    if let Some(rect) = self.table_ref_to_rect(
                        range,
                        force_columns,
                        auto_detect_table_bounds,
                        a1_context,
                    ) {
                        rects.push(rect);
                    }
                }
            }
        }
        rects
    }

    /// Returns the smallest rect that contains all the ranges in the selection.
    /// Infinite selections are clamped at sheet data bounds.
    pub(crate) fn selection_bounds(
        &self,
        selection: &A1Selection,
        force_columns: bool,
        auto_detect_table_bounds: bool,
        ignore_formatting: bool,
        a1_context: &A1Context,
    ) -> Option<Rect> {
        let rects = self.selection_to_rects(
            selection,
            force_columns,
            auto_detect_table_bounds,
            ignore_formatting,
            a1_context,
        );
        if rects.is_empty() {
            None
        } else {
            rects.into_iter().reduce(|a, b| a.union(&b))
        }
    }

    /// Converts unbounded regions in a selection to finite rectangular regions.
    /// Bounded regions are unmodified.
    pub(crate) fn finitize_selection(
        &self,
        selection: &A1Selection,
        force_columns: bool,
        force_table_bounds: bool,
        ignore_formatting: bool,
        a1_context: &A1Context,
    ) -> A1Selection {
        A1Selection {
            sheet_id: selection.sheet_id,
            cursor: selection.cursor,
            ranges: selection
                .ranges
                .iter()
                .filter_map(|range| match range {
                    CellRefRange::Sheet { range } => Some(CellRefRange::new_relative_rect(
                        self.ref_range_bounds_to_rect(range, ignore_formatting),
                    )),
                    CellRefRange::Table { range } => self
                        .table_ref_to_rect(range, force_columns, force_table_bounds, a1_context)
                        .map(CellRefRange::new_relative_rect),
                })
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {

    use crate::{
        CellValue, Rect,
        a1::{A1Selection, CellRefRange, RefRangeBounds, TableRef},
        controller::GridController,
    };

    use super::Sheet;

    #[test]
    fn test_cell_ref_range_to_rect() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_value(pos![E5], CellValue::Text("E5".into()));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Test fully specified range
        let range = RefRangeBounds::test_a1("A1:E5");
        let rect = sheet.ref_range_bounds_to_rect(&range, false);
        assert_eq!(rect, Rect::new(1, 1, 5, 5));

        // Test unbounded end
        let range = RefRangeBounds::test_a1("B2:");
        let rect = sheet.ref_range_bounds_to_rect(&range, false);
        assert_eq!(rect, Rect::new(2, 2, 5, 5)); // Should extend to sheet bounds
    }

    #[test]
    fn test_selection_to_rects() {
        let sheet = Sheet::test();
        let selection = A1Selection::test_a1("A1:C3,E5:G7");

        let a1_context = sheet.expensive_make_a1_context();
        let rects = sheet.selection_to_rects(&selection, false, false, false, &a1_context);
        assert_eq!(rects, vec![Rect::new(1, 1, 3, 3), Rect::new(5, 5, 7, 7)]);
    }

    #[test]
    fn test_finitize_ref_range_bounds() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_value(pos![J10], CellValue::Text("J10".into()));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Test unbounded range
        let range = RefRangeBounds::test_a1("B2:");
        let finite_range = sheet.ref_range_bounds_to_rect(&range, false);
        assert_eq!(finite_range, Rect::test_a1("B2:J10"));

        // Test already bounded range (should remain unchanged)
        let range = RefRangeBounds::test_a1("C3:E5");
        let finite_range = sheet.ref_range_bounds_to_rect(&range, false);
        assert_eq!(finite_range, Rect::test_a1("C3:E5"));

        // Test select all
        let range = RefRangeBounds::test_a1("*");
        let finite_range = sheet.ref_range_bounds_to_rect(&range, false);
        assert_eq!(finite_range, Rect::test_a1("A1:J10"));
    }

    #[test]
    fn test_finitize_selection() {
        let mut sheet = Sheet::test();
        // Add some data to create bounds
        sheet.set_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_value(pos![J10], CellValue::Text("J10".into()));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let selection = A1Selection::test_a1("A1:C3,E5:");
        let finite_selection =
            sheet.finitize_selection(&selection, false, false, false, &a1_context);
        assert_eq!(
            finite_selection.ranges,
            vec![
                CellRefRange::test_a1("A1:C3"),
                CellRefRange::test_a1("E5:J10"),
            ]
        );

        // Test select all
        let selection = A1Selection::test_a1("*");
        let finite_selection =
            sheet.finitize_selection(&selection, false, false, false, &a1_context);
        assert_eq!(
            finite_selection.ranges,
            vec![CellRefRange::test_a1("A1:J10")]
        );
    }

    #[test]
    fn test_selection_bounds() {
        let mut sheet = Sheet::test();

        // Setup some data to establish sheet bounds
        sheet.set_value(pos![A1], CellValue::Text("A1".into()));
        sheet.set_value(pos![E5], CellValue::Text("E5".into()));
        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        // Single cell selection
        let single_cell = A1Selection::test_a1("B2");
        assert_eq!(
            sheet.selection_bounds(&single_cell, false, false, false, &a1_context),
            Some(Rect::new(2, 2, 2, 2))
        );

        // Regular rectangular selection
        let rect_selection = A1Selection::test_a1("B2:D4");
        assert_eq!(
            sheet.selection_bounds(&rect_selection, false, false, false, &a1_context),
            Some(Rect::new(2, 2, 4, 4))
        );

        // Multiple disjoint rectangles
        let multi_rect = A1Selection::test_a1("A1:B2,D4:E5");
        assert_eq!(
            sheet.selection_bounds(&multi_rect, false, false, false, &a1_context),
            Some(Rect::new(1, 1, 5, 5))
        );

        // Overlapping rectangles
        let overlapping = A1Selection::test_a1("B2:D4,C3:E5");
        assert_eq!(
            sheet.selection_bounds(&overlapping, false, false, false, &a1_context),
            Some(Rect::new(2, 2, 5, 5))
        );

        // Infinite column selection (should be clamped to sheet bounds)
        let infinite_col = A1Selection::test_a1("C:C");
        assert_eq!(
            sheet.selection_bounds(&infinite_col, false, false, false, &a1_context),
            Some(Rect::new(3, 1, 3, 1))
        );

        // Infinite row selection (should be clamped to sheet bounds)
        let infinite_row = A1Selection::test_a1("3:3");
        assert_eq!(
            sheet.selection_bounds(&infinite_row, false, false, false, &a1_context),
            Some(Rect::new(1, 3, 1, 3))
        );

        // Select all (should be clamped to sheet bounds)
        let select_all = A1Selection::test_a1("*");
        assert_eq!(
            sheet.selection_bounds(&select_all, false, false, false, &a1_context),
            Some(Rect::new(1, 1, 5, 5))
        );

        // Multiple infinite selections (should be clamped to sheet bounds)
        let multi_infinite = A1Selection::test_a1("A:B,2:3");
        assert_eq!(
            sheet.selection_bounds(&multi_infinite, false, false, false, &a1_context),
            Some(Rect::new(1, 1, 2, 3))
        );

        // Mixed finite and infinite selections
        let mixed = A1Selection::test_a1("B2:C3,D:D,4:4");
        assert_eq!(
            sheet.selection_bounds(&mixed, false, false, false, &a1_context),
            Some(Rect::new(1, 1, 4, 4))
        );
    }

    #[test]
    fn test_table_ref_to_rect() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.test_set_code_run_array_2d(sheet_id, 1, 1, 2, 2, vec!["1", "2", "3", "4"]);
        gc.test_data_table_update_meta(
            pos![A1].as_sheet_pos(sheet_id),
            None,
            Some(true),
            Some(true),
        );
        let sheet = gc.sheet(sheet_id);
        let table_ref = TableRef::parse("Table1", gc.a1_context()).unwrap();
        assert_eq!(
            sheet.table_ref_to_rect(&table_ref, false, false, gc.a1_context()),
            Some(Rect::test_a1("A3:B4"))
        );

        let table_ref = TableRef::parse("Table1[#HEADERS]", gc.a1_context()).unwrap();
        assert_eq!(
            sheet.table_ref_to_rect(&table_ref, false, false, gc.a1_context()),
            Some(Rect::test_a1("A2:B2"))
        );

        let table_ref = TableRef::parse("Table1[#All]", gc.a1_context()).unwrap();
        assert_eq!(
            sheet.table_ref_to_rect(&table_ref, false, false, gc.a1_context()),
            Some(Rect::test_a1("A2:B4"))
        );
        let table_ref = TableRef::parse("Table1", gc.a1_context()).unwrap();
        assert_eq!(
            sheet.table_ref_to_rect(&table_ref, true, false, gc.a1_context()),
            Some(Rect::test_a1("A2:B4"))
        );
    }
}
