use std::collections::HashSet;

use crate::{
    a1::{A1Context, RefRangeBounds},
    grid::Sheet,
    Pos, Rect, SheetPos,
};

use super::{A1Selection, CellRefRange};

impl A1Selection {
    // Returns whether the selection is one cell or multiple cells (either a
    // rect, column, row, or all)
    pub fn is_multi_cursor(&self, context: &A1Context) -> bool {
        if self.ranges.len() > 1 {
            return true;
        }
        if let Some(last_range) = self.ranges.last() {
            match last_range {
                CellRefRange::Sheet { range } => range.is_multi_cursor(),
                CellRefRange::Table { range } => range.is_multi_cursor(context),
            }
        } else {
            false
        }
    }

    // Returns whether the selection includes a selected column or row.
    pub fn is_column_row(&self) -> bool {
        self.ranges
            .iter()
            .any(|range| range.is_col_range() || range.is_row_range())
    }

    /// Returns whether the selection contains the given position.
    pub fn might_contain_xy(&self, x: i64, y: i64, context: &A1Context) -> bool {
        self.ranges
            .iter()
            .any(|range| range.might_contain_pos(Pos::new(x, y), context))
    }

    /// Returns whether any range in `self` might contain `pos`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub fn might_contain_pos(&self, pos: Pos, context: &A1Context) -> bool {
        self.ranges
            .iter()
            .any(|range| range.might_contain_pos(pos, context))
    }

    /// Returns whether any range in `self` contains `pos` regardless of data
    /// bounds. (Use might_contains_pos for that.)
    pub fn contains_pos(&self, pos: Pos, context: &A1Context) -> bool {
        self.ranges
            .iter()
            .any(|range| range.contains_pos(pos, context))
    }

    /// Returns the largest rectangle that can be formed by the selection,
    /// ignoring any ranges that extend infinitely.
    pub fn largest_rect_finite(&self, context: &A1Context) -> Rect {
        let mut rect = Rect::single_pos(self.cursor);
        self.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                if !range.end.is_unbounded() {
                    rect = rect.union(&Rect::new(
                        range.start.col(),
                        range.start.row(),
                        range.end.col(),
                        range.end.row(),
                    ));
                }
            }
            CellRefRange::Table { range } => {
                if let Some(table_rect) = range.to_largest_rect(self.cursor.y, context) {
                    rect = rect.union(&table_rect);
                }
            }
        });
        rect
    }

    /// Returns rectangle in case of single finite range selection having more than one cell.
    pub fn single_rect(&self, context: &A1Context) -> Option<Rect> {
        if self.ranges.len() != 1 || !self.is_multi_cursor(context) {
            None
        } else {
            self.ranges.first().and_then(|range| range.to_rect())
        }
    }

    /// Returns rectangle in case of single finite range selection,
    /// otherwise returns a rectangle that contains the cursor.
    pub fn single_rect_or_cursor(&self, context: &A1Context) -> Option<Rect> {
        if !self.is_multi_cursor(context) {
            Some(Rect::single_pos(self.cursor))
        } else if self.ranges.len() != 1 {
            None
        } else {
            self.ranges.first().and_then(|range| range.to_rect())
        }
    }

    // Converts to a set of quadrant positions.
    pub fn rects_to_hashes(&self, sheet: &Sheet) -> HashSet<Pos> {
        let mut hashes = HashSet::new();
        let finite_selection = sheet.finitize_selection(self);
        finite_selection.ranges.iter().for_each(|range| {
            // handle finite ranges
            if let Some(rect) = range.to_rect() {
                for x in rect.min.x..=rect.max.x {
                    for y in rect.min.y..=rect.max.y {
                        let mut pos = Pos { x, y };
                        pos.to_quadrant();
                        hashes.insert(pos);
                    }
                }
            }
        });
        hashes
    }

    /// Returns the bottom-right cell for the selection. It defaults to the cursor if it's
    /// a non-finite range.
    pub fn bottom_right_cell(&self) -> Pos {
        if let Some(range) = self.ranges.last() {
            match range {
                CellRefRange::Sheet { range } => {
                    let x = if range.end.is_unbounded() {
                        self.cursor.x
                    } else {
                        range.end.col().max(range.start.col())
                    };
                    let y = if range.end.row.is_unbounded() {
                        self.cursor.y
                    } else {
                        range.end.row().max(range.start.row())
                    };
                    Pos { x, y }
                }
                // todo: not sure how autofill in tables will work
                CellRefRange::Table { .. } => self.cursor,
            }
        } else {
            self.cursor
        }
    }

    /// Returns the last selection's end. It defaults to the cursor if it's
    /// a non-finite range.
    pub fn last_selection_end(&self, context: &A1Context) -> Pos {
        if let Some(range) = self.ranges.last() {
            match range {
                CellRefRange::Sheet { range } => {
                    if range.end.is_unbounded() {
                        self.cursor
                    } else {
                        Pos {
                            x: range.end.col(),
                            y: range.end.row(),
                        }
                    }
                }
                CellRefRange::Table { range } => {
                    if let Some(range) = range.convert_to_ref_range_bounds(0, false, context) {
                        Pos {
                            x: range.end.col(),
                            y: range.end.row(),
                        }
                    } else {
                        self.cursor
                    }
                }
            }
        } else {
            self.cursor
        }
    }

    /// Returns true if the selection is the entire sheet.
    pub fn is_all_selected(&self) -> bool {
        self.ranges.contains(&CellRefRange::ALL)
    }

    /// Returns true if all the selected columns are finite.
    pub fn is_selected_columns_finite(&self, context: &A1Context) -> bool {
        self.ranges
            .iter()
            .all(|range| !range.selected_columns_finite(context).is_empty())
    }

    /// Returns the selected columns as a list of column numbers.
    pub fn selected_columns_finite(&self, context: &A1Context) -> Vec<i64> {
        let mut columns = HashSet::new();
        self.ranges.iter().for_each(|range| {
            columns.extend(range.selected_columns_finite(context));
        });
        columns.into_iter().collect::<Vec<_>>()
    }

    /// Returns the selected column ranges as a list of [start, end] pairs between two coordinates.
    pub fn selected_column_ranges(&self, from: i64, to: i64, context: &A1Context) -> Vec<i64> {
        let mut columns = HashSet::new();
        self.ranges.iter().for_each(|range| {
            columns.extend(
                range
                    .selected_columns(from, to, context)
                    .iter()
                    .filter(|c| c >= &&from && c <= &&to),
            );
        });

        let mut columns = columns.into_iter().collect::<Vec<_>>();
        columns.sort_unstable();
        let mut ranges = Vec::new();
        if !columns.is_empty() {
            let mut start = columns[0];
            let mut end = start;

            for &col in &columns[1..] {
                if col == end + 1 {
                    end = col;
                } else {
                    ranges.push(start);
                    ranges.push(end);
                    start = col;
                    end = start;
                }
            }

            ranges.push(start);
            ranges.push(end);
        }
        ranges
    }

    /// Returns true if all the selected rows are finite.
    pub fn is_selected_rows_finite(&self, context: &A1Context) -> bool {
        self.ranges
            .iter()
            .all(|range| !range.selected_rows_finite(context).is_empty())
    }

    /// Returns the selected rows as a list of row numbers.
    pub fn selected_rows_finite(&self, context: &A1Context) -> Vec<i64> {
        let mut rows = HashSet::new();
        self.ranges.iter().for_each(|range| {
            rows.extend(range.selected_rows_finite(context));
        });
        rows.into_iter().collect::<Vec<_>>()
    }

    /// Returns the selected row ranges as a list of [start, end] pairs between two coordinates.
    pub fn selected_row_ranges(&self, from: i64, to: i64, context: &A1Context) -> Vec<i64> {
        let mut rows = HashSet::new();
        self.ranges
            .iter()
            .for_each(|range| rows.extend(range.selected_rows(from, to, context).iter()));

        let mut rows = rows.into_iter().collect::<Vec<_>>();
        rows.sort_unstable();
        let mut ranges = Vec::new();
        if !rows.is_empty() {
            let mut start = rows[0];
            let mut end = start;

            for &row in &rows[1..] {
                if row == end + 1 {
                    end = row;
                } else {
                    ranges.push(start);
                    ranges.push(end);
                    start = row;
                    end = start;
                }
            }

            ranges.push(start);
            ranges.push(end);
        }
        ranges
    }

    /// Returns true if the selection is a single column or row range or
    /// one_cell is true and the selection is only a single cell.
    pub fn has_one_column_row_selection(&self, one_cell: bool) -> bool {
        if self.ranges.len() != 1 {
            return false;
        }
        let Some(range) = self.ranges.first() else {
            return false;
        };
        range.is_col_range() || range.is_row_range() || (one_cell && range.is_single_cell())
    }

    /// Returns true if the selection is a single cell.
    pub fn is_single_selection(&self) -> bool {
        if self.ranges.len() != 1 {
            return false;
        }

        if let Some(range) = self.ranges.first() {
            range.is_single_cell()
        } else {
            false
        }
    }

    pub fn to_cursor_sheet_pos(&self) -> SheetPos {
        self.cursor.to_sheet_pos(self.sheet_id)
    }

    /// Tries to convert the selection to a single position. This works only if
    /// there is one range, and the range is a single cell.
    pub fn try_to_pos(&self, context: &A1Context) -> Option<Pos> {
        if self.ranges.len() == 1 {
            if let Some(range) = self.ranges.first() {
                return range.try_to_pos(context);
            }
        }
        None
    }

    /// Returns the position from the last range (either the end, or if not defined,
    /// the start).
    pub(crate) fn cursor_pos_from_last_range(
        last_range: &CellRefRange,
        context: &A1Context,
    ) -> Pos {
        match last_range {
            CellRefRange::Sheet { range } => range.cursor_pos_from_last_range(),
            CellRefRange::Table { range } => range.cursor_pos_from_last_range(context),
        }
    }

    /// Returns all finite RefRangeBounds for the selection, converting table selections to
    /// RefRangeBounds.
    pub fn finite_ref_range_bounds(&self, context: &A1Context) -> Vec<RefRangeBounds> {
        self.ranges
            .iter()
            .filter_map(|range| match range {
                CellRefRange::Sheet { range } => {
                    if range.is_finite() {
                        Some(*range)
                    } else {
                        None
                    }
                }
                CellRefRange::Table { range } => {
                    range.convert_to_ref_range_bounds(0, false, context)
                }
            })
            .collect()
    }

    /// Returns true if the selection is on an image.
    pub fn cursor_is_on_html_image(&self, context: &A1Context) -> bool {
        let table = context
            .tables()
            .find(|table| table.contains(self.cursor.to_sheet_pos(self.sheet_id)));
        table.is_some_and(|table| table.is_html_image)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::grid::SheetId;

    use super::*;

    #[test]
    fn test_contains() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.might_contain_xy(1, 1, &context));
        assert!(!selection.might_contain_xy(4, 1, &context));
    }

    #[test]
    fn test_contains_pos() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("B7:G7");
        assert!(selection.contains_pos(pos![B7], &context));
        assert!(!selection.contains_pos(pos![A1], &context));
    }

    #[test]
    fn test_might_contain_pos() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.might_contain_pos(pos![A1], &context));
        assert!(!selection.might_contain_pos(pos![D1], &context));
    }

    #[test]
    fn test_largest_rect() {
        let selection = A1Selection::test_a1("A1,B1:D2,E:G,2:3,5:7,F6:G8,4");
        let context = A1Context::default();
        assert_eq!(
            selection.largest_rect_finite(&context),
            Rect::new(1, 1, 7, 8)
        );
    }

    #[test]
    fn test_largest_rect_finite() {
        let selection = A1Selection::test_a1("A1,B1:D2,E:G,2:3,5:7,F6:G8,4");
        let context = A1Context::default();
        assert_eq!(
            selection.largest_rect_finite(&context),
            Rect::new(1, 1, 7, 8)
        );
    }

    #[test]
    fn test_is_multi_cursor() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(selection.is_multi_cursor(&context));

        let selection = A1Selection::test_a1("A1,B1:C2");
        assert!(selection.is_multi_cursor(&context));

        let selection = A1Selection::test_a1("A");
        assert!(selection.is_multi_cursor(&context));

        let selection = A1Selection::test_a1("1");
        assert!(selection.is_multi_cursor(&context));

        let selection = A1Selection::test_a1("A1");
        assert!(!selection.is_multi_cursor(&context));
    }

    #[test]
    fn test_is_column_row() {
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert!(!selection.is_column_row());

        let selection = A1Selection::test_a1("D");
        assert!(selection.is_column_row());

        let selection = A1Selection::test_a1("A:C");
        assert!(selection.is_column_row());

        let selection = A1Selection::test_a1("10");
        assert!(selection.is_column_row());

        let selection = A1Selection::test_a1("1:3");
        assert!(selection.is_column_row());

        let selection = A1Selection::test_a1("A1:3");
        assert!(selection.is_column_row());
        let selection = A1Selection::test_a1("1:C3");
        assert!(!selection.is_column_row());
    }

    #[test]
    fn test_selection_end() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert_eq!(selection.last_selection_end(&context), pos![C3]);

        let selection = A1Selection::test_a1("A1,B1:C2");
        assert_eq!(selection.last_selection_end(&context), pos![C2]);

        let selection = A1Selection::test_a1("C2:B1");
        assert_eq!(selection.last_selection_end(&context), pos![B1]);
    }

    #[test]
    fn test_bottom_right_cell() {
        let selection = A1Selection::test_a1("A1,B2,C3");
        assert_eq!(selection.bottom_right_cell(), pos![C3]);

        let selection = A1Selection::test_a1("A1,B1:C2");
        assert_eq!(selection.bottom_right_cell(), pos![C2]);

        let selection = A1Selection::test_a1("C2:B1");
        assert_eq!(selection.bottom_right_cell(), pos![C2]);
    }

    #[test]
    fn test_selected_column_ranges() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_column_ranges(1, 10, &context),
            vec![1, 8]
        );

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_column_ranges(1, 10, &context),
            vec![1, 2, 4, 8]
        );

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_column_ranges(2, 5, &context),
            vec![2, 2, 4, 5]
        );

        let selection = A1Selection::test_a1("C:A");
        assert_eq!(
            selection.selected_column_ranges(1, 10, &context),
            vec![1, 3]
        );
    }

    #[test]
    fn test_selected_row_ranges() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1,B2,C3,D4:E5,F6:G7,H8");
        assert_eq!(selection.selected_row_ranges(1, 10, &context), vec![1, 8]);

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_row_ranges(1, 10, &context),
            vec![1, 2, 4, 8]
        );

        let selection = A1Selection::test_a1("A1,B2,D4:E5,F6:G7,H8");
        assert_eq!(
            selection.selected_row_ranges(2, 5, &context),
            vec![2, 2, 4, 5]
        );
    }

    #[test]
    fn has_one_column_row_selection() {
        assert!(A1Selection::test_a1("A").has_one_column_row_selection(false));
        assert!(A1Selection::test_a1("1").has_one_column_row_selection(false));
        assert!(!A1Selection::test_a1("A,B").has_one_column_row_selection(false));
        assert!(!A1Selection::test_a1("A1").has_one_column_row_selection(false));
        assert!(!A1Selection::test_a1("A1:B2").has_one_column_row_selection(false));

        assert!(A1Selection::test_a1("A").has_one_column_row_selection(true));
        assert!(A1Selection::test_a1("1").has_one_column_row_selection(true));
        assert!(A1Selection::test_a1("A1").has_one_column_row_selection(true));
        assert!(!A1Selection::test_a1("A,B").has_one_column_row_selection(true));
        assert!(!A1Selection::test_a1("A1:B2").has_one_column_row_selection(true));
    }

    #[test]
    fn is_single_selection() {
        assert!(A1Selection::test_a1("A1").is_single_selection());
        assert!(!A1Selection::test_a1("A1:B4").is_single_selection());
        assert!(!A1Selection::test_a1("A").is_single_selection());
        assert!(!A1Selection::test_a1("3").is_single_selection());
        assert!(!A1Selection::test_a1("A1,B2").is_single_selection());
    }

    #[test]
    fn test_is_selected_columns_finite() {
        let context = A1Context::default();
        assert!(A1Selection::test_a1("A1,B2,C3").is_selected_columns_finite(&context));
        assert!(A1Selection::test_a1("A1,B2,C3,D:E").is_selected_columns_finite(&context));
        assert!(A1Selection::test_a1("A:B").is_selected_columns_finite(&context));
        assert!(!A1Selection::test_a1("*").is_selected_columns_finite(&context));
        assert!(!A1Selection::test_a1("1:2").is_selected_columns_finite(&context));
        assert!(!A1Selection::test_a1("A1:2").is_selected_columns_finite(&context));
    }

    #[test]
    fn test_is_selected_rows_finite() {
        let context = A1Context::default();
        assert!(A1Selection::test_a1("A1,B2,C3").is_selected_rows_finite(&context));
        assert!(A1Selection::test_a1("1:2").is_selected_rows_finite(&context));
        assert!(!A1Selection::test_a1("A1,B2,C3,D:E").is_selected_rows_finite(&context));
        assert!(!A1Selection::test_a1("A:B").is_selected_rows_finite(&context));
        assert!(!A1Selection::test_a1("*").is_selected_rows_finite(&context));
    }

    #[test]
    fn test_single_rect_or_cursor() {
        let context = A1Context::default();
        assert_eq!(
            A1Selection::test_a1("A1,B2,C3").single_rect_or_cursor(&context),
            None
        );
        assert_eq!(
            A1Selection::test_a1("A1:D5").single_rect_or_cursor(&context),
            Some(Rect::new(1, 1, 4, 5))
        );
        assert_eq!(
            A1Selection::test_a1("A1:D5, A1").single_rect_or_cursor(&context),
            None
        );
        assert_eq!(
            A1Selection::test_a1("A").single_rect_or_cursor(&context),
            None
        );
        assert_eq!(
            A1Selection::test_a1("2:5").single_rect_or_cursor(&context),
            None
        );
    }

    #[test]
    fn test_is_all_selected() {
        assert!(A1Selection::test_a1("*").is_all_selected());
        assert!(A1Selection::test_a1("A1:D5, A1:").is_all_selected());
        assert!(!A1Selection::test_a1("A1:A").is_all_selected());
        assert!(!A1Selection::test_a1("A1:1").is_all_selected());
    }

    #[test]
    fn test_cursor_pos_from_last_range() {
        let context = A1Context::default();
        assert_eq!(
            A1Selection::cursor_pos_from_last_range(&CellRefRange::test_a1("A1"), &context),
            pos![A1]
        );
        assert_eq!(
            A1Selection::cursor_pos_from_last_range(&CellRefRange::test_a1("A1:C3"), &context),
            pos![A1]
        );
    }

    #[test]
    fn test_cursor_sheet_pos() {
        // Test basic cursor position
        let selection = A1Selection::test_a1("A1");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 1, 1),
            "Basic cursor sheet pos failed"
        );

        // Test cursor at different positions
        let selection = A1Selection::test_a1("B2");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 2, 2),
            "B2 cursor sheet pos failed"
        );

        // Test cursor with large coordinates
        let selection = A1Selection::test_a1("Z100");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 26, 100),
            "Large coordinate cursor sheet pos failed"
        );

        // Test cursor with multi-letter column
        let selection = A1Selection::test_a1("AA1");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 27, 1),
            "Multi-letter column cursor sheet pos failed"
        );

        // Test cursor position in a range selection
        let selection = A1Selection::test_a1("A1:C3");
        assert_eq!(
            selection.to_cursor_sheet_pos(),
            SheetPos::new(selection.sheet_id, 1, 1),
            "Range selection cursor sheet pos failed"
        );
    }

    #[test]
    fn test_try_to_pos() {
        let context = A1Context::default();
        let selection = A1Selection::test_a1("A1");
        assert_eq!(selection.try_to_pos(&context), Some(pos![A1]));

        let selection = A1Selection::test_a1("A1:B2");
        assert_eq!(selection.try_to_pos(&context), None);

        let selection = A1Selection::test_a1("A");
        assert_eq!(selection.try_to_pos(&context), None);

        let selection = A1Selection::test_a1("*");
        assert_eq!(selection.try_to_pos(&context), None);

        let selection = A1Selection::test_a1("1:4");
        assert_eq!(selection.try_to_pos(&context), None);
    }

    #[test]
    fn test_get_ref_range_bounds() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["A", "B", "C"], Rect::test_a1("A1:C3"))],
        );
        // note we do not return the D5: range as it is infinite
        let selection = A1Selection::test_a1_context("A1,B2,D5:,C3,Table1", &context);
        let ref_range_bounds = selection.finite_ref_range_bounds(&context);
        assert_eq!(
            ref_range_bounds,
            vec![
                RefRangeBounds::test_a1("A1"),
                RefRangeBounds::test_a1("B2"),
                RefRangeBounds::test_a1("C3"),
                RefRangeBounds::test_a1("A2:C3")
            ]
        );
    }

    #[test]
    fn test_is_on_html_image() {
        // Create a context with a table that has an HTML image
        let mut context = A1Context::test(
            &[("Sheet1", SheetId::test()), ("Sheet2", SheetId::new())],
            &[("Table1", &["A"], Rect::test_a1("B2:D4"))],
        );
        context.table_map.tables.first_mut().unwrap().is_html_image = true;

        // Test position inside the table
        assert!(A1Selection::test_a1("B2").cursor_is_on_html_image(&context));
        assert!(A1Selection::test_a1("C3").cursor_is_on_html_image(&context));
        assert!(A1Selection::test_a1("D4").cursor_is_on_html_image(&context));

        // Test positions outside the table
        assert!(!A1Selection::test_a1("A2").cursor_is_on_html_image(&context));
        assert!(!A1Selection::test_a1("B5").cursor_is_on_html_image(&context));
        assert!(!A1Selection::test_a1("E3").cursor_is_on_html_image(&context));

        // Test with wrong sheet_id
        assert!(
            !A1Selection::test_a1_context("Sheet2!B2", &context).cursor_is_on_html_image(&context)
        );
    }
}
