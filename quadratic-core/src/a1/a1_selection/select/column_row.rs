use crate::a1::{A1Context, A1Selection, CellRefRange, CellRefRangeEnd, RefRangeBounds, UNBOUNDED};

impl A1Selection {
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

    pub(crate) fn add_or_remove_column(&mut self, col: i64, top: i64, a1_context: &A1Context) {
        // Special case: if we have ALL selected, split it around the column
        if self.ranges.len() == 1 && self.ranges[0] == CellRefRange::ALL {
            self.ranges.clear();
            if col == 1 {
                // Remove column 1, keep everything from column 2 onwards
                self.ranges.push(CellRefRange::Sheet {
                    range: RefRangeBounds::new_infinite_cols(2, UNBOUNDED),
                });
                self.cursor.x = 2;
                self.cursor.y = top;
            } else {
                // Split into ranges before and after the column
                if col - 1 == 1 {
                    // Single column before: use single column
                    self.ranges.push(CellRefRange::new_relative_column(1));
                } else {
                    // Multiple columns before: use column range
                    self.ranges
                        .push(CellRefRange::new_relative_column_range(1, col - 1));
                }
                // Unbounded column range after
                self.ranges.push(CellRefRange::Sheet {
                    range: RefRangeBounds::new_infinite_cols(col + 1, UNBOUNDED),
                });
                self.cursor.x = 1;
                self.cursor.y = 1;
            }
            return;
        }

        let mut ranges = Vec::new();
        let mut found = false;

        for range in &self.ranges {
            match range {
                CellRefRange::Sheet { range } => {
                    let mut range = *range;
                    // Check if this is a row range (unbounded in columns, starting at column 1)
                    let is_row_range = range.end.col.is_unbounded() && range.start.col() == 1;

                    // For row ranges, we don't modify them when removing a column
                    // We just keep them as-is and add the column as a separate selection
                    if is_row_range {
                        ranges.push(CellRefRange::Sheet { range });
                        continue;
                    }

                    // Check if this range contains the column
                    let range_contains_col = if range.end.col.is_unbounded() {
                        // Column range: check if col is within start and end
                        col >= range.start.col() && col <= range.end.col()
                    } else {
                        // Regular range: check if col is within start and end
                        col >= range.start.col() && col <= range.end.col()
                    };

                    if range_contains_col {
                        found = true;
                    }

                    if range.start.col() == range.end.col() && range.start.col() == col {
                        // Single column range matching col:
                        // If there are other ranges that will remain, remove this one
                        // Otherwise, convert to cell (to ensure we don't have empty selection)
                        // Check if there are other ranges in the original selection that don't match col
                        let has_other_ranges = self.ranges.iter().any(|r| {
                            if let CellRefRange::Sheet { range: other_range } = r {
                                // Check if this is a different range that doesn't match col
                                !(other_range.start.col() == other_range.end.col()
                                    && other_range.start.col() == col)
                            } else {
                                // Table ranges always count as "other"
                                true
                            }
                        });
                        if !has_other_ranges {
                            // This is the only range (or all others also match col), convert to cell
                            ranges.push(CellRefRange::Sheet {
                                range: RefRangeBounds::new_relative_xy(col, top),
                            });
                            // Set cursor to the cell position
                            self.cursor.x = col;
                            self.cursor.y = top;
                        }
                        // Otherwise, remove it (don't add to ranges)
                    } else if range.start.col() == range.end.col() {
                        // Single column range not matching col: keep it
                        ranges.push(CellRefRange::Sheet { range });
                    } else if range.start.col() == col {
                        range.start = CellRefRangeEnd::new_relative_xy(col + 1, 1);
                        ranges.push(CellRefRange::Sheet { range });
                    } else if range.end.col() == col {
                        // if start_col is the column right before the
                        // one being deleted, then the end range is same
                        // as the start range
                        if range.start.col() == col - 1 {
                            range.end = range.start;
                            ranges.push(CellRefRange::Sheet { range });
                        } else {
                            range.end =
                                CellRefRangeEnd::new_relative_xy(range.start.col(), col - 1);
                            let second = CellRefRange::Sheet {
                                range: RefRangeBounds {
                                    start: CellRefRangeEnd::new_relative_xy(col + 1, 1),
                                    end: range.end,
                                },
                            };
                            ranges.push(CellRefRange::Sheet { range });
                            ranges.push(second);
                        }
                    } else if range.start.col() < col && range.end.col() > col {
                        // Column is in the middle of the range
                        let first = CellRefRange::Sheet {
                            range: RefRangeBounds {
                                start: range.start,
                                end: CellRefRangeEnd::new_relative_xy(col - 1, range.end.row()),
                            },
                        };
                        let second = CellRefRange::Sheet {
                            range: RefRangeBounds {
                                start: CellRefRangeEnd::new_relative_xy(col + 1, 1),
                                end: range.end,
                            },
                        };
                        ranges.push(first);
                        ranges.push(second);
                    } else {
                        ranges.push(CellRefRange::Sheet { range });
                    }
                }
                _ => ranges.push(range.clone()),
            }
        }

        self.ranges = ranges;

        // If column was not found, add it
        if !found {
            self.ranges.push(CellRefRange::new_relative_column(col));
            self.cursor.x = col;
            // Ensure cursor.y is at least 1 since column selections start at row 1
            self.cursor.y = top.max(1);
        } else {
            // Reposition cursor after removal (unless we already set it when converting single column to cell)
            // We track if cursor was set by checking if it matches the cell we created
            let cursor_was_set = self.cursor.x == col
                && self.cursor.y == top
                && self.ranges.iter().any(|r| {
                    if let CellRefRange::Sheet { range } = r {
                        range.start.col() == col
                            && range.start.row() == top
                            && range.end.col() == col
                            && range.end.row() == top
                    } else {
                        false
                    }
                });

            if !cursor_was_set {
                self.reposition_cursor_after_removal(col, top, a1_context, true);
            }
            self.ensure_non_empty_ranges(col, top, true);
        }
    }

    pub fn extend_column(&mut self, col: i64, _top: i64) {
        // First, check if we have a cell selection that we should extend from
        // If the last range is a single cell, extend it to a column range
        if let Some(CellRefRange::Sheet { range }) = self.ranges.last()
            // Check if this is a single cell (not a column or row range)
            && !range.end.row.is_unbounded()
            && !range.end.col.is_unbounded()
            && range.start.col() == range.end.col()
            && range.start.row() == range.end.row()
        {
            let start_col = range.start.col();
            let start_row = range.start.row();

            // Create a range from the cell to the column
            let min_col = start_col.min(col);
            let max_col = start_col.max(col);

            // Replace the last range with a range from the cell to the column
            if let Some(CellRefRange::Sheet { range: range_ref }) = self.ranges.last_mut() {
                range_ref.start = CellRefRangeEnd::new_relative_xy(min_col, start_row);
                range_ref.end = CellRefRangeEnd::new_relative_xy(max_col, UNBOUNDED);
                self.cursor.x = min_col;
                self.cursor.y = start_row;
                return;
            }
        }

        // Find the column range that contains or is adjacent to col
        // A column range has end.row.is_unbounded()
        let mut found_range = false;
        for range in &mut self.ranges {
            if let CellRefRange::Sheet { range: range_ref } = range {
                // Check if this is a column range (unbounded in rows)
                if range_ref.end.row.is_unbounded() {
                    let start_col = range_ref.start.col();
                    let end_col = range_ref.end.col();

                    // Check if col is within or adjacent to this range
                    if col >= start_col && col <= end_col {
                        // Already in range, no change needed
                        // Keep cursor at the start of the range
                        self.cursor.x = start_col;
                        self.cursor.y = 1;
                        found_range = true;
                        break;
                    } else if col == start_col - 1 {
                        // Adjacent before: extend start
                        range_ref.start = CellRefRangeEnd::new_relative_xy(col, 1);
                        // Keep cursor at the new start
                        self.cursor.x = col;
                        self.cursor.y = 1;
                        found_range = true;
                        break;
                    } else if col == end_col + 1 {
                        // Adjacent after: extend end
                        range_ref.end = CellRefRangeEnd::new_relative_xy(col, UNBOUNDED);
                        // Keep cursor at the start of the range being extended
                        self.cursor.x = start_col;
                        self.cursor.y = 1;
                        found_range = true;
                        break;
                    } else if col < start_col {
                        // Before range: extend start to include col
                        range_ref.start = CellRefRangeEnd::new_relative_xy(col, 1);
                        // Keep cursor at the new start
                        self.cursor.x = col;
                        self.cursor.y = 1;
                        found_range = true;
                        break;
                    } else if col > end_col {
                        // After range: extend end to include col
                        range_ref.end = CellRefRangeEnd::new_relative_xy(col, UNBOUNDED);
                        // Keep cursor at the start of the range being extended
                        self.cursor.x = start_col;
                        self.cursor.y = 1;
                        found_range = true;
                        break;
                    }
                }
            }
        }

        if !found_range {
            self.ranges.push(CellRefRange::new_relative_column(col));
            self.cursor.x = col;
            self.cursor.y = 1;
        }
    }

    pub(crate) fn add_or_remove_row(&mut self, row: i64, left: i64, a1_context: &A1Context) {
        // Special case: if we have ALL selected, split it around the row
        if self.ranges.len() == 1 && self.ranges[0] == CellRefRange::ALL {
            self.ranges.clear();
            if row == 1 {
                // Remove row 1, keep everything from row 2 onwards
                self.ranges.push(CellRefRange::Sheet {
                    range: RefRangeBounds::new_infinite_rows(2, UNBOUNDED),
                });
                self.cursor.x = left;
                self.cursor.y = 2;
            } else {
                // Split into ranges before and after the row
                if row - 1 == 1 {
                    // Single row before: use single row
                    self.ranges.push(CellRefRange::new_relative_row(1));
                } else {
                    // Multiple rows before: use row range
                    self.ranges
                        .push(CellRefRange::new_relative_row_range(1, row - 1));
                }
                // Unbounded row range after
                self.ranges.push(CellRefRange::Sheet {
                    range: RefRangeBounds::new_infinite_rows(row + 1, UNBOUNDED),
                });
                self.cursor.x = 1;
                self.cursor.y = 1;
            }
            return;
        }

        let mut ranges = Vec::new();
        let mut found = false;

        for range in &self.ranges {
            match range {
                CellRefRange::Sheet { range } => {
                    let mut range = *range;
                    // Check if this is a column range (unbounded in rows, starting at row 1)
                    let is_col_range = range.end.row.is_unbounded() && range.start.row() == 1;

                    // For column ranges, we don't modify them when removing a row
                    // We just keep them as-is and add the row as a separate selection
                    if is_col_range {
                        ranges.push(CellRefRange::Sheet { range });
                        continue;
                    }

                    // Check if this range contains the row
                    let range_contains_row = if range.end.row.is_unbounded() {
                        // Row range: check if row is within start and end
                        row >= range.start.row() && row <= range.end.row()
                    } else {
                        // Regular range: check if row is within start and end
                        row >= range.start.row() && row <= range.end.row()
                    };

                    if range_contains_row {
                        found = true;
                    }

                    if range.start.row() == range.end.row() && range.start.row() == row {
                        // Single row range matching row: convert to single cell
                        ranges.push(CellRefRange::Sheet {
                            range: RefRangeBounds::new_relative_xy(left, row),
                        });
                    } else if range.start.row() == range.end.row() {
                        // Single row range not matching row: keep it
                        ranges.push(CellRefRange::Sheet { range });
                    } else if range.start.row() == row {
                        range.start = CellRefRangeEnd::new_relative_xy(1, row + 1);
                        ranges.push(CellRefRange::Sheet { range });
                    } else if range.end.row() == row {
                        // if start_row is the row right before the
                        // one being deleted, then the end range is same
                        // as the start range
                        if range.start.row() == row - 1 {
                            range.end = range.start;
                            ranges.push(CellRefRange::Sheet { range });
                        } else {
                            range.end = CellRefRangeEnd::new_relative_xy(
                                range.end.col(),
                                range.start.row(),
                            );
                            let second = CellRefRange::Sheet {
                                range: RefRangeBounds {
                                    start: CellRefRangeEnd::new_relative_xy(1, row + 1),
                                    end: range.end,
                                },
                            };
                            ranges.push(CellRefRange::Sheet { range });
                            ranges.push(second);
                        }
                    } else if range.start.row() < row && range.end.row() > row {
                        // Row is in the middle of the range
                        let first = CellRefRange::Sheet {
                            range: RefRangeBounds {
                                start: range.start,
                                end: CellRefRangeEnd::new_relative_xy(range.end.col(), row - 1),
                            },
                        };
                        let second = CellRefRange::Sheet {
                            range: RefRangeBounds {
                                start: CellRefRangeEnd::new_relative_xy(1, row + 1),
                                end: range.end,
                            },
                        };
                        ranges.push(first);
                        ranges.push(second);
                    } else {
                        ranges.push(CellRefRange::Sheet { range });
                    }
                }
                _ => ranges.push(range.clone()),
            }
        }

        self.ranges = ranges;

        // If row was not found, add it
        if !found {
            self.ranges.push(CellRefRange::new_relative_row(row));
            // Ensure cursor.x is at least 1 since row selections start at column 1
            self.cursor.x = left.max(1);
            self.cursor.y = row;
        } else {
            self.reposition_cursor_after_removal(row, left, a1_context, false);
            self.ensure_non_empty_ranges(row, left, false);
        }
    }

    pub(crate) fn select_only_column(&mut self, col: i64, top: i64) {
        self.ranges.clear();
        self.ranges.push(CellRefRange::new_relative_column(col));
        self.cursor.x = col;
        self.cursor.y = top;
    }

    pub(crate) fn select_only_row(&mut self, row: i64, left: i64) {
        self.ranges.clear();
        self.ranges.push(CellRefRange::new_relative_row(row));
        self.cursor.x = left;
        self.cursor.y = row;
    }

    pub fn select_column(
        &mut self,
        col: i64,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,
        top: i64,
        a1_context: &A1Context,
    ) {
        // Handle ctrl/meta key combinations first (including ctrl+right-click)
        if ctrl_key && !shift_key {
            // Add column to selection (works for both left-click and right-click with ctrl/meta)
            self.add_or_remove_column(col, top.max(1), a1_context);
        } else if shift_key {
            self.extend_column(col, top);
        } else if is_right_click {
            // Right-click without modifiers: only change selection if column not already selected
            if !self.is_entire_column_selected(col) {
                self.select_only_column(col, top.max(1));
            }
        } else {
            // Regular left-click without modifiers: select only this column
            self.select_only_column(col, top.max(1));
        }
    }

    pub fn extend_row(&mut self, row: i64, _left: i64) {
        // First, check for existing row ranges
        // A row range has end.col.is_unbounded()
        let mut found_row_range = false;
        for range in &mut self.ranges {
            if let CellRefRange::Sheet { range: range_ref } = range
                && range_ref.end.col.is_unbounded()
            {
                    let start_row = range_ref.start.row();
                    let end_row = range_ref.end.row();

                    // Check if row is within or adjacent to this range
                    if row >= start_row && row <= end_row {
                        // Already in range, no change needed
                        self.cursor.x = 1;
                        self.cursor.y = start_row;
                        found_row_range = true;
                        break;
                    } else if row == start_row - 1 {
                        // Adjacent before: extend start
                        range_ref.start = CellRefRangeEnd::new_relative_xy(1, row);
                        self.cursor.x = 1;
                        self.cursor.y = row;
                        found_row_range = true;
                        break;
                    } else if row == end_row + 1 {
                        // Adjacent after: extend end
                        range_ref.end = CellRefRangeEnd::new_relative_xy(UNBOUNDED, row);
                        self.cursor.x = 1;
                        self.cursor.y = start_row;
                        found_row_range = true;
                        break;
                    } else if row < start_row {
                        // Before range: extend start to include row
                        range_ref.start = CellRefRangeEnd::new_relative_xy(1, row);
                        self.cursor.x = 1;
                        self.cursor.y = row;
                        found_row_range = true;
                        break;
                    } else if row > end_row {
                        // After range: extend end to include row
                        range_ref.end = CellRefRangeEnd::new_relative_xy(UNBOUNDED, row);
                        self.cursor.x = 1;
                        self.cursor.y = start_row;
                        found_row_range = true;
                        break;
                    }
            }
        }

        // If no row range found, check if we can convert a cell to a row range
        if !found_row_range {
            let mut cell_to_convert: Option<usize> = None;
            for (idx, range) in self.ranges.iter_mut().enumerate() {
                if let CellRefRange::Sheet { range: range_ref } = range
                    && !range_ref.start.col.is_unbounded()
                    && !range_ref.end.col.is_unbounded()
                    // This is a regular cell/range (not a row or column range)
                    // If it's a single cell or single-row range, convert it to a row range
                    && range_ref.start.row() == range_ref.end.row()
                {
                    cell_to_convert = Some(idx);
                    break;
                }
            }

            if let Some(idx) = cell_to_convert {
                if let CellRefRange::Sheet { range: range_ref } = &mut self.ranges[idx] {
                    let cell_row = range_ref.start.row();
                    let min_row = cell_row.min(row);
                    let max_row = cell_row.max(row);
                    range_ref.start = CellRefRangeEnd::new_relative_xy(1, min_row);
                    range_ref.end = CellRefRangeEnd::new_relative_xy(UNBOUNDED, max_row);
                    self.cursor.x = 1;
                    self.cursor.y = min_row;
                }
            } else {
                // No row range or cell found, add new row range
                self.ranges.push(CellRefRange::new_relative_row(row));
                self.cursor.x = 1;
                self.cursor.y = row;
            }
        }
    }

    pub fn select_row(
        &mut self,
        row: i64,
        ctrl_key: bool,
        shift_key: bool,
        is_right_click: bool,
        left: i64,
        a1_context: &A1Context,
    ) {
        // Handle ctrl/meta key combinations first (including ctrl+right-click)
        if ctrl_key && !shift_key {
            // Add row to selection (works for both left-click and right-click with ctrl/meta)
            self.add_or_remove_row(row, left.max(1), a1_context);
        } else if shift_key {
            self.extend_row(row, left);
        } else if is_right_click {
            // Right-click without modifiers: only change selection if row not already selected
            if !self.is_entire_row_selected(row) {
                self.select_only_row(row, left.max(1));
            }
        } else {
            // Regular left-click without modifiers: select only this row
            self.select_only_row(row, left.max(1));
        }
    }

    pub fn set_columns_selected(&mut self, a1_context: &A1Context) {
        if let Some(bounds) = self.last_range_to_bounds(a1_context) {
            self.ranges.clear();

            // If the range is a row range, select all columns
            if bounds.is_row_range() {
                self.ranges.push(CellRefRange::ALL);
                return;
            }

            let start_col = bounds.start.col();
            let end_col = if bounds.end.col.is_unbounded() {
                start_col
            } else {
                bounds.end.col()
            };
            // Merge adjacent columns into ranges
            if start_col == end_col {
                self.ranges
                    .push(CellRefRange::new_relative_column(start_col));
            } else {
                self.ranges
                    .push(CellRefRange::new_relative_column_range(start_col, end_col));
            }
        }
    }

    pub fn set_rows_selected(&mut self, a1_context: &A1Context) {
        if let Some(bounds) = self.last_range_to_bounds(a1_context) {
            self.ranges.clear();

            // If the range is a column range, select all rows
            if bounds.is_col_range() {
                self.ranges.push(CellRefRange::ALL);
                return;
            }

            let start_row = bounds.start.row();
            let end_row = if bounds.end.row.is_unbounded() {
                start_row
            } else {
                bounds.end.row()
            };
            // Merge adjacent rows into ranges
            if start_row == end_row {
                self.ranges.push(CellRefRange::new_relative_row(start_row));
            } else {
                self.ranges
                    .push(CellRefRange::new_relative_row_range(start_row, end_row));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::{A1Selection, CellRefRange};
    use crate::{Pos, a1::A1Context};

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
        assert_eq!(selection.test_to_string(), "2:2");
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

        // Test adding column when top is 0 (viewport scrolled to show row 0)
        // The cursor should still be at row 1, not row 0
        let mut selection = A1Selection::test_a1("A");
        selection.add_or_remove_column(3, 0, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A"), CellRefRange::test_a1("C")]
        );
        assert_eq!(selection.cursor.x, 3);
        assert_eq!(selection.cursor.y, 1); // cursor.y should be 1, not 0

        // Test adding column when top is negative
        let mut selection = A1Selection::test_a1("A");
        selection.add_or_remove_column(3, -5, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A"), CellRefRange::test_a1("C")]
        );
        assert_eq!(selection.cursor.x, 3);
        assert_eq!(selection.cursor.y, 1); // cursor.y should be 1, not -5
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

        // Test adding row when left is 0 (viewport scrolled to show column 0)
        // The cursor should still be at column 1, not column 0
        let mut selection = A1Selection::test_a1("1");
        selection.add_or_remove_row(3, 0, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("1"), CellRefRange::test_a1("3")]
        );
        assert_eq!(selection.cursor.x, 1); // cursor.x should be 1, not 0
        assert_eq!(selection.cursor.y, 3);

        // Test adding row when left is negative
        let mut selection = A1Selection::test_a1("1");
        selection.add_or_remove_row(3, -5, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("1"), CellRefRange::test_a1("3")]
        );
        assert_eq!(selection.cursor.x, 1); // cursor.x should be 1, not -5
        assert_eq!(selection.cursor.y, 3);
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

        // Test Cmd+right-click on a new column should ADD to selection, not replace it
        let mut selection = A1Selection::test_a1("A");
        selection.select_column(col![C], true, false, true, 1, &context); // ctrl=true, right_click=true
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A"), CellRefRange::test_a1("C")]
        );
    }

    #[test]
    fn test_right_click_row_selection() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("1:4");
        selection.select_row(2, false, false, true, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("1:4")]);

        selection.select_row(6, false, false, true, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("6")]);

        // Test Cmd+right-click on a new row should ADD to selection, not replace it
        let mut selection = A1Selection::test_a1("1");
        selection.select_row(3, true, false, true, 1, &context); // ctrl=true, right_click=true
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("1"), CellRefRange::test_a1("3")]
        );
    }

    #[test]
    fn test_cursor_position_handling() {
        let context = A1Context::default();

        // Test cursor position after column removal
        let mut selection = A1Selection::test_a1("A:C");
        selection.cursor = Pos { x: 1, y: 1 };
        selection.add_or_remove_column(2, 1, &context);
        assert_eq!(selection.cursor, Pos { x: 1, y: 1 });

        // Test cursor position after row removal
        selection = A1Selection::test_a1("1:3");
        selection.cursor = Pos { x: 1, y: 1 };
        selection.add_or_remove_row(2, 1, &context);
        assert_eq!(selection.cursor, Pos { x: 1, y: 1 });
    }

    #[test]
    fn test_selection_with_modifiers() {
        let context = A1Context::default();

        // Test shift selection
        let mut selection = A1Selection::test_a1("B2");
        selection.select_column(4, false, true, false, 1, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2:D")]);

        // Test ctrl selection
        selection = A1Selection::test_a1("B2");
        selection.select_column(4, true, false, false, 1, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("B2"), CellRefRange::test_a1("D")]
        );
    }
}
