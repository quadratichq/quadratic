use crate::a1::{A1Context, CellRefCoord, CellRefRangeEnd, RefRangeBounds, UNBOUNDED};
use crate::Pos;

use super::{A1Selection, CellRefRange};

impl A1Selection {
    /// Checks if the last range is a table reference and converts it to a table
    /// reference.
    pub(crate) fn check_for_table_ref(&mut self, context: &A1Context) {
        if let Some(last) = self.ranges.last_mut() {
            if let Some(table_ref) = last.check_for_table_ref(self.sheet_id, context) {
                *last = table_ref;
            }
        }
    }

    /// Selects the entire sheet.
    pub fn select_all(&mut self, append: bool) {
        if append {
            if let Some(CellRefRange::Sheet { range: last }) = self.ranges.last_mut() {
                last.end = RefRangeBounds::ALL.end;
            }
        } else {
            self.ranges.clear();
            self.ranges.push(CellRefRange::ALL);
        }
    }

    /// Removes a column if it is in any column ranges, or adds it if it is not.
    fn add_or_remove_column(&mut self, col: i64, top: i64, context: &A1Context) {
        // If the full column is in any range, then we'll remove it from all
        // ranges. Otherwise we'll add it.
        if self.ranges.iter().any(|range| range.has_col_range(col)) {
            let mut ranges = vec![];
            self.ranges.iter().for_each(|range| {
                if !range.has_col_range(col) {
                    ranges.push(range.clone());
                } else {
                    match range {
                        CellRefRange::Table { .. } => (),
                        CellRefRange::Sheet { mut range } => {
                            if range.start.col() == range.end.col() {
                                // if the range is a single column, then we
                                // should do nothing to remove the range
                            }
                            // handle case where start_col is deleted
                            else if range.start.col() == col {
                                range.start = CellRefRangeEnd::new_relative_xy(col + 1, 1);
                                ranges.push(CellRefRange::Sheet { range });
                            }
                            // handle case where end_col is deleted
                            else if range.end.col() == col {
                                // if start_col is the column right before the
                                // one being deleted, then the end range is same
                                // as the start range
                                if range.start.col() == col - 1 {
                                    range.end = range.start;
                                    ranges.push(CellRefRange::Sheet { range });
                                }
                                // otherwise we move the end to the previous column
                                else {
                                    range.end =
                                        CellRefRangeEnd::new_relative_xy(col - 1, UNBOUNDED);
                                    ranges.push(CellRefRange::Sheet { range });
                                }
                            } else {
                                let first = CellRefRange::new_relative_column_range(
                                    range.start.col(),
                                    col - 1,
                                );
                                let second = if range.end.col.is_unbounded() {
                                    CellRefRange::Sheet {
                                        range: RefRangeBounds {
                                            start: CellRefRangeEnd::new_relative_xy(col + 1, 1),
                                            end: CellRefRangeEnd::UNBOUNDED,
                                        },
                                    }
                                } else {
                                    CellRefRange::new_relative_column_range(
                                        col + 1,
                                        range.end.col(),
                                    )
                                };
                                ranges.push(first);
                                ranges.push(second);
                            };
                        }
                    }
                }
            });
            self.ranges = ranges;
        } else {
            // Add the column if it wasn't found and set the cursor position
            self.ranges.push(CellRefRange::new_relative_column(col));
            self.cursor.x = col;
            self.cursor.y = top;
        }

        if !self.contains_pos(self.cursor, context) {
            if self.contains_pos(Pos { x: col + 1, y: top }, context) {
                self.cursor = Pos { x: col + 1, y: top };
            } else if self.contains_pos(Pos { x: col - 1, y: top }, context) {
                self.cursor = Pos { x: col - 1, y: top };
            } else {
                // otherwise find a sensible default
                self.cursor = Pos { x: col + 1, y: top };
            }
        }

        // if we deleted the last range, then we use the cursor + top as the
        // new range
        if self.ranges.is_empty() {
            self.ranges.push(CellRefRange::new_relative_xy(col, top));
            self.cursor.x = col;
            self.cursor.y = top;
        }
    }

    /// Extends the last column range or creates a new one.
    pub fn extend_column(&mut self, col: i64, top: i64) {
        if let Some(CellRefRange::Sheet { range }) = self.ranges.last_mut() {
            if range.is_col_range() {
                range.end = CellRefRangeEnd::new_relative_xy(col, UNBOUNDED);
            } else {
                range.end = CellRefRangeEnd::new_relative_xy(col, UNBOUNDED);
                self.cursor.y = range.start.row();
            }
        } else {
            self.ranges.push(CellRefRange::new_relative_column(col));
            self.cursor.x = col;
            self.cursor.y = top;
        }
    }

    /// Removes a row if it is in any row ranges, or adds it if it is not.
    fn add_or_remove_row(&mut self, row: i64, left: i64, context: &A1Context) {
        // If the full row is in any range, then we'll remove it from all
        // ranges. Otherwise we'll add it.
        if self.ranges.iter().any(|range| range.has_row_range(row)) {
            let mut ranges = vec![];
            self.ranges.iter().for_each(|range| {
                if !range.has_row_range(row) {
                    ranges.push(range.clone());
                } else {
                    match range {
                        CellRefRange::Table { .. } => (),
                        CellRefRange::Sheet { mut range } => {
                            if range.start.row() == range.end.row() {
                                // if the range is a single row, then we
                                // should do nothing to remove the range
                            }
                            // handle case where start_row is deleted
                            else if range.start.row() == row {
                                range.start = CellRefRangeEnd::new_relative_xy(1, row + 1);
                                ranges.push(CellRefRange::Sheet { range });
                            }
                            // handle case where end_row is deleted
                            else if range.end.row() == row {
                                // if start_row is the row right before the one
                                // being deleted, then end becomes same as start
                                if range.start.row() == row - 1 {
                                    range.end = range.start;
                                    ranges.push(CellRefRange::Sheet { range });
                                }
                                // otherwise we move the end to the previous row
                                else {
                                    range.end =
                                        CellRefRangeEnd::new_relative_xy(UNBOUNDED, row - 1);
                                    ranges.push(CellRefRange::Sheet { range });
                                }
                            } else {
                                let first = CellRefRange::new_relative_row_range(
                                    range.start.row(),
                                    row - 1,
                                );
                                let second = CellRefRange::Sheet {
                                    range: RefRangeBounds {
                                        start: CellRefRangeEnd {
                                            col: CellRefCoord::new_rel(1),
                                            row: CellRefCoord::new_rel(row + 1),
                                        },
                                        end: range.end,
                                    },
                                };
                                ranges.push(first);
                                ranges.push(second);
                            };
                        }
                    }
                }
            });
            self.ranges = ranges;
        } else {
            // Add the row if it wasn't found and set the cursor position
            self.ranges.push(CellRefRange::new_relative_row(row));
            self.cursor.x = left;
            self.cursor.y = row;
        }

        if !self.contains_pos(self.cursor, context) {
            if self.contains_pos(
                Pos {
                    x: left,
                    y: row + 1,
                },
                context,
            ) {
                self.cursor = Pos {
                    x: left,
                    y: row + 1,
                };
            } else if self.contains_pos(
                Pos {
                    x: left,
                    y: row - 1,
                },
                context,
            ) {
                self.cursor = Pos {
                    x: left,
                    y: row - 1,
                };
            } else {
                // otherwise find a sensible default
                self.cursor = Pos {
                    x: left,
                    y: row + 1,
                };
            }
        }

        // if we deleted the last range, then we use the cursor + left as the
        // new range
        if self.ranges.is_empty() {
            self.ranges.push(CellRefRange::new_relative_xy(left, row));
            self.cursor.x = left;
            self.cursor.y = row;
        }
    }

    /// Selects a single column based on keyboard modifiers.
    pub fn select_column(
        &mut self,
        col: i64,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,

        // top of the screen to change the cursor position when selecting a column
        top: i64,

        context: &A1Context,
    ) {
        let select_only_column = |selection: &mut A1Selection, col: i64, top: i64| {
            selection.ranges.clear();
            selection
                .ranges
                .push(CellRefRange::new_relative_column(col));
            selection.cursor.x = col;
            selection.cursor.y = top;
        };

        if is_right_click {
            if !self.ranges.iter().any(|range| range.has_col_range(col)) {
                select_only_column(self, col, top);
            }
        } else if !ctrl_key && !shift_key {
            select_only_column(self, col, top);
        } else if ctrl_key && !shift_key {
            self.add_or_remove_column(col, top, context);
        } else if shift_key {
            self.extend_column(col, top);
        }
    }

    /// Extends the last row range or creates a new one.
    pub fn extend_row(&mut self, row: i64, left: i64) {
        if let Some(CellRefRange::Sheet { range }) = self.ranges.last_mut() {
            if range.is_row_range() {
                self.cursor.x = range.start.col();
            }
            range.end = CellRefRangeEnd {
                col: CellRefCoord::UNBOUNDED,
                row: CellRefCoord::new_rel(row),
            };
        } else {
            self.ranges.push(CellRefRange::new_relative_row(row));
            self.cursor.x = left;
            self.cursor.y = row;
        }
    }

    /// Selects a single row. If append is true, then the row is appended
    /// to the ranges (or, if the last selection was a row, then the end of
    /// that row is extended).
    pub fn select_row(
        &mut self,
        row: i64,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,

        // left of the screen to change the cursor position when selecting a row
        left: i64,

        context: &A1Context,
    ) {
        let select_only_row = |selection: &mut A1Selection, row: i64, left: i64| {
            selection.ranges.clear();
            selection.ranges.push(CellRefRange::new_relative_row(row));
            selection.cursor.x = left;
            selection.cursor.y = row;
        };

        if is_right_click {
            if !self.ranges.iter().any(|range| range.has_row_range(row)) {
                select_only_row(self, row, left);
            }
        } else if !ctrl_key && !shift_key {
            select_only_row(self, row, left);
        } else if ctrl_key && !shift_key {
            self.add_or_remove_row(row, left, context);
        } else if shift_key {
            self.extend_row(row, left);
        }
    }

    /// Selects a rectangular range. If append is true, then the range is appended
    /// to the ranges (or, if the last selection was a range, then the end of
    /// that range is extended).
    pub fn select_rect(
        &mut self,
        left: i64,
        top: i64,
        right: i64,
        bottom: i64,
        append: bool,
        context: &A1Context,
    ) {
        if !append {
            self.ranges.clear();
        }
        if left == right && top == bottom {
            self.ranges.push(CellRefRange::new_relative_xy(left, top));
        } else {
            self.ranges.push(CellRefRange::Sheet {
                range: RefRangeBounds {
                    start: CellRefRangeEnd::new_relative_xy(left, top),
                    end: CellRefRangeEnd::new_relative_xy(right, bottom),
                },
            });
        }
        self.cursor.x = left;
        self.cursor.y = top;
        self.check_for_table_ref(context);
    }

    /// Moves the cursor to the given position and clears the selection.
    pub fn move_to(&mut self, x: i64, y: i64, append: bool, context: &A1Context) {
        self.cursor.x = x;
        self.cursor.y = y;
        if !append {
            self.ranges.clear();
        }
        self.ranges
            .push(CellRefRange::new_relative_pos(Pos::new(x, y)));
        self.check_for_table_ref(context);
    }

    /// Extends the last selection to the given position. If append is true, then the range is appended
    /// to the ranges (or, if the last selection was a range, then the end of that range is extended).
    pub(crate) fn select_to(&mut self, column: i64, row: i64, append: bool, context: &A1Context) {
        // if the selection is empty, then we use the cursor as the starting point
        if self.ranges.is_empty() {
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        };
        if let Some(last) = self.ranges.last_mut() {
            let mut range = match last {
                CellRefRange::Table { range } => {
                    if let Some(range) =
                        range.convert_to_ref_range_bounds(false, context, false, false)
                    {
                        range
                    } else {
                        dbgjs!("Could not convert table range to ref range bounds in A1Selection::select_to");
                        return;
                    }
                }
                CellRefRange::Sheet { range } => *range,
            };
            if range.start.row.is_unbounded() {
                self.cursor.y = row;
            }
            if range.start.col.is_unbounded() {
                self.cursor.x = column;
            }
            range.end = CellRefRangeEnd::new_relative_xy(column, row);
            *last = CellRefRange::Sheet { range };
        }
        if !append {
            self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
        }
        self.check_for_table_ref(context);
    }

    /// Changes the selection to select all columns that have a selection (used by cmd+space). It only
    /// checks the last range (the same as Excel and Sheets)
    pub fn set_columns_selected(&mut self, context: &A1Context) {
        let Some(last) = self.ranges.last() else {
            return;
        };
        let last = match last {
            CellRefRange::Sheet { range } => *range,
            CellRefRange::Table { range } => {
                if let Some(range) = range.convert_to_ref_range_bounds(false, context, false, false)
                {
                    range
                } else {
                    return;
                }
            }
        };
        self.ranges.clear();
        self.ranges.push(CellRefRange::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(last.start.col(), 1),
                end: CellRefRangeEnd::new_relative_xy(last.end.col(), UNBOUNDED),
            },
        });
    }

    /// Changes the selection to select all rows that have a selection (used by shift+space). It only
    /// checks the last range (the same as Excel and Sheets)
    pub fn set_rows_selected(&mut self, context: &A1Context) {
        let Some(last) = self.ranges.last() else {
            return;
        };
        let last = match last {
            CellRefRange::Sheet { range } => *range,
            CellRefRange::Table { range } => {
                if let Some(range) = range.convert_to_ref_range_bounds(false, context, false, false)
                {
                    range
                } else {
                    return;
                }
            }
        };
        self.ranges.clear();
        self.ranges.push(CellRefRange::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(1, last.start.row()),
                end: CellRefRangeEnd::new_relative_xy(UNBOUNDED, last.end.row()),
            },
        });
    }
}

#[cfg(test)]
mod tests {
    use crate::{grid::SheetId, Rect};

    use super::*;

    #[test]
    fn test_select_all() {
        let mut selection = A1Selection::test_a1("A1,B1,C1");
        selection.select_all(false);
        assert_eq!(selection.test_to_string(), "*");

        selection = A1Selection::test_a1("B2");
        selection.select_all(true);
        assert_eq!(selection.test_to_string(), "B2:");
    }

    #[test]
    fn test_select_column() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1");
        selection.select_column(2, false, false, false, 1, &context);
        assert_eq!(selection.test_to_string(), "B");
    }

    #[test]
    fn test_move_to() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1,B1,C1");
        selection.move_to(2, 2, false, &context);
        assert_eq!(selection.test_to_string(), "B2");
    }

    #[test]
    fn test_columns_selected() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1,B1,C1");
        selection.set_columns_selected(&context);
        assert_eq!(selection.ranges, vec![CellRefRange::new_relative_column(3)]);

        let mut selection = A1Selection::test_a1("A1:C1");
        selection.set_columns_selected(&context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::new_relative_column_range(1, 3)]
        );

        let mut selection = A1Selection::test_a1("A:C");
        selection.set_columns_selected(&context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::new_relative_column_range(1, 3)]
        );

        let mut selection = A1Selection::test_a1("2:3");
        selection.set_columns_selected(&context);
        assert_eq!(selection.ranges, vec![CellRefRange::ALL]);
    }

    #[test]
    fn test_rows_selected() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1,B2,C3");
        selection.set_rows_selected(&context);
        assert_eq!(selection.ranges, vec![CellRefRange::new_relative_row(3)]);

        let mut selection = A1Selection::test_a1("A1:C3");
        selection.set_rows_selected(&context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::new_relative_row_range(1, 3)]
        );

        let mut selection = A1Selection::test_a1("1:3");
        selection.set_rows_selected(&context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::new_relative_row_range(1, 3)]
        );

        let mut selection = A1Selection::test_a1("C:D");
        selection.set_rows_selected(&context);
        assert_eq!(selection.ranges, vec![CellRefRange::ALL]);
    }

    #[test]
    fn test_select_row() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1");
        selection.select_row(2, false, false, false, 1, &context);
        assert_eq!(selection.test_to_string(), "A2:2");
    }

    #[test]
    fn test_select_rect() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1,B2,C3");
        selection.select_rect(1, 1, 2, 2, false, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection.cursor.y, 1);

        let mut selection = A1Selection::test_a1("A1:C3");
        selection.select_rect(3, 3, 5, 5, true, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A1:C3"),
                CellRefRange::test_a1("C3:E5"),
            ]
        );
        assert_eq!(selection.cursor.x, 3);
        assert_eq!(selection.cursor.y, 3);
    }

    #[test]
    fn test_select_to() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1");
        selection.select_to(2, 2, false, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);

        selection = A1Selection::test_a1("A:B");
        selection.select_to(2, 2, false, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A:B2")]);

        selection = A1Selection::test_a1("A1");
        selection.select_to(3, 3, false, &context);
        selection.select_to(1, 1, false, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1")]);

        let mut selection = A1Selection::test_a1("A1,B2,C3");
        selection.select_to(2, 2, false, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("C3:B2")]);
    }

    #[test]
    fn test_add_or_remove_column() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1,B1,C1");
        selection.add_or_remove_column(4, 2, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A1"),
                CellRefRange::test_a1("B1"),
                CellRefRange::test_a1("C1"),
                CellRefRange::test_a1("D")
            ]
        );
        assert_eq!(selection.cursor.x, 4);
        assert_eq!(selection.cursor.y, 2);

        let mut selection = A1Selection::test_a1("A:D,B1,A");
        selection.add_or_remove_column(1, 2, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("B:D"), CellRefRange::test_a1("B1"),]
        );
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 2);

        let mut selection = A1Selection::test_a1("A");
        selection.add_or_remove_column(1, 2, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A2")]);
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection.cursor.y, 2);
    }

    #[test]
    fn test_extend_column() {
        let mut selection = A1Selection::test_a1("A1,B");
        selection.extend_column(4, 2);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A1"), CellRefRange::test_a1("B:D")]
        );
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 1);
    }

    #[test]
    fn test_add_or_remove_row() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1,B2,3");
        selection.add_or_remove_row(4, 2, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A1"),
                CellRefRange::test_a1("B2"),
                CellRefRange::test_a1("3"),
                CellRefRange::test_a1("4")
            ]
        );
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 4);

        // Test removing a row from a range
        let mut selection = A1Selection::test_a1("1:4");
        selection.add_or_remove_row(2, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("1"), CellRefRange::test_a1("3:4")]
        );

        // Test removing the only selected row
        let mut selection = A1Selection::test_a1("3");
        selection.add_or_remove_row(3, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A3")]);
    }

    #[test]
    fn test_extend_row() {
        let mut selection = A1Selection::test_a1("A2,1");
        selection.extend_row(4, 2);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A2"), CellRefRange::test_a1("1:4")]
        );
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection.cursor.y, 1);

        // Test extending an empty selection
        let mut selection = A1Selection::test_a1("A1");
        selection.extend_row(3, 1);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:3")]);
    }

    #[test]
    fn test_select_rect_single_cell() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1");
        selection.select_rect(2, 2, 2, 2, false, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2")]);
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 2);
    }

    #[test]
    fn test_select_to_with_append() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1");
        selection.select_to(2, 2, true, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);

        // Test appending to existing selection
        selection.select_to(3, 3, true, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:C3")]);
    }

    #[test]
    fn test_all_remove_col() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("*");
        selection.cursor = Pos { x: 1, y: 1 };
        selection.add_or_remove_column(col![A], 2, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B:")]);
        assert_eq!(selection.cursor, Pos { x: 2, y: 2 });

        let mut selection = A1Selection::test_a1("*");
        selection.add_or_remove_column(2, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A"), CellRefRange::test_a1("C:")]
        );

        let mut selection = A1Selection::test_a1("*");
        selection.add_or_remove_column(3, 2, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A:B"), CellRefRange::test_a1("D:")]
        );
        assert_eq!(selection.cursor, Pos { x: 1, y: 1 });
    }

    #[test]
    fn test_remove_col_from_unbounded_range() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("C:");
        selection.add_or_remove_column(3, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("D:")]);
        assert_eq!(selection.cursor, Pos { x: 4, y: 1 });

        let mut selection = A1Selection::test_a1("A:B,D:");
        selection.add_or_remove_column(col![F], 1, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A:B"),
                CellRefRange::test_a1("D:E"),
                CellRefRange::test_a1("G:")
            ]
        );
        assert_eq!(selection.cursor, Pos { x: 4, y: 1 });
    }

    #[test]
    fn test_all_remove_row() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("*");
        selection.add_or_remove_row(1, 2, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("2:")]);
        assert_eq!(selection.cursor, Pos { x: 2, y: 2 });

        let mut selection = A1Selection::test_a1("*");
        selection.add_or_remove_row(2, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("1"), CellRefRange::test_a1("3:")]
        );

        let mut selection = A1Selection::test_a1("*");
        selection.add_or_remove_row(3, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("1:2"), CellRefRange::test_a1("4:")]
        );
        assert_eq!(selection.cursor, Pos { x: 1, y: 1 });
    }

    #[test]
    fn test_remove_row_from_unbounded_range() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("3:");
        selection.add_or_remove_row(3, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("4:")]);
        assert_eq!(selection.cursor, Pos { x: 1, y: 4 });

        let mut selection = A1Selection::test_a1("1:2,4:");
        selection.add_or_remove_row(6, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("1:2"),
                CellRefRange::test_a1("4:5"),
                CellRefRange::test_a1("7:")
            ]
        );
        assert_eq!(selection.cursor, Pos { x: 1, y: 4 });
    }

    #[test]
    fn test_col_row_cross() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("*");
        selection.add_or_remove_column(col![D], 1, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A:C"), CellRefRange::test_a1("E:")]
        );
        selection.add_or_remove_row(2, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A:C"),
                CellRefRange::test_a1("E:"),
                CellRefRange::test_a1("2")
            ]
        );

        let mut selection = A1Selection::test_a1("A:D,F");
        selection.add_or_remove_row(17, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A:D"),
                CellRefRange::test_a1("F"),
                CellRefRange::test_a1("17")
            ]
        );
    }

    #[test]
    fn test_row_col_cross() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("*");
        selection.add_or_remove_row(4, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("1:3"), CellRefRange::test_a1("5:")]
        );
        selection.add_or_remove_column(col![B], 1, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("1:3"),
                CellRefRange::test_a1("5:"),
                CellRefRange::test_a1("B")
            ]
        );
    }

    #[test]
    fn test_right_click_column_selection() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A:D");
        selection.select_column(col![B], false, false, true, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A:D")]);

        selection.select_column(col![F], false, false, true, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("F")]);
    }

    #[test]
    fn test_right_click_row_selection() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("1:4");
        selection.select_row(2, false, false, true, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("1:4")]);

        selection.select_row(6, false, false, true, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("6")]);
    }

    #[test]
    fn test_select_to_start_of_table() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );
        let mut selection = A1Selection::test_a1("A1");
        selection.select_to(col![A], 3, false, &context);
        assert_eq!(
            selection,
            A1Selection::test_a1_context("Table1[[#DATA],[#HEADERS],[col1]]", &context)
        );
    }
}
