mod helpers;
mod merged_cells;
mod normalize;

#[cfg(test)]
mod tests;

use crate::a1::{A1Context, CellRefRangeEnd, ColRange, RefRangeBounds, UNBOUNDED};
use crate::grid::sheet::merge_cells::MergeCells;
use crate::{Pos, Rect};

use super::{A1Selection, CellRefRange};

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

    /// Helper to reposition cursor after removing a range, ensuring it stays within valid selections
    fn reposition_cursor_after_removal(
        &mut self,
        removed_pos: i64,
        fallback_pos: i64,
        a1_context: &A1Context,
        is_column: bool,
    ) {
        if self.contains_pos(self.cursor, a1_context) {
            return;
        }

        let try_positions = [
            (removed_pos + 1, fallback_pos),
            (removed_pos - 1, fallback_pos),
            (removed_pos + 1, fallback_pos), // default fallback
        ];

        for (primary, secondary) in try_positions {
            let test_pos = if is_column {
                Pos {
                    x: primary,
                    y: secondary,
                }
            } else {
                Pos {
                    x: secondary,
                    y: primary,
                }
            };
            if self.contains_pos(test_pos, a1_context) {
                self.cursor = test_pos;
                return;
            }
        }

        // If no valid position found, use fallback
        if is_column {
            self.cursor.x = fallback_pos;
        } else {
            self.cursor.y = fallback_pos;
        }
    }

    fn ensure_non_empty_ranges(&mut self, _removed_pos: i64, fallback_pos: i64, is_column: bool) {
        if self.ranges.is_empty() {
            if is_column {
                self.cursor.x = fallback_pos;
            } else {
                self.cursor.y = fallback_pos;
            }
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
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
                    let mut range = range.clone();
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
                            let second = if range.end.col.is_unbounded() {
                                CellRefRange::Sheet {
                                    range: RefRangeBounds {
                                        start: CellRefRangeEnd::new_relative_xy(col + 1, 1),
                                        end: range.end,
                                    },
                                }
                            } else {
                                CellRefRange::Sheet {
                                    range: RefRangeBounds {
                                        start: CellRefRangeEnd::new_relative_xy(col + 1, 1),
                                        end: range.end,
                                    },
                                }
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
                        let second = if range.end.col.is_unbounded() {
                            CellRefRange::Sheet {
                                range: RefRangeBounds {
                                    start: CellRefRangeEnd::new_relative_xy(col + 1, 1),
                                    end: range.end,
                                },
                            }
                        } else {
                            CellRefRange::Sheet {
                                range: RefRangeBounds {
                                    start: CellRefRangeEnd::new_relative_xy(col + 1, 1),
                                    end: range.end,
                                },
                            }
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
            self.cursor.y = top;
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
        if let Some(last_range) = self.ranges.last() {
            if let CellRefRange::Sheet { range } = last_range {
                // Check if this is a single cell (not a column or row range)
                if !range.end.row.is_unbounded()
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
                    if let Some(last_range) = self.ranges.last_mut() {
                        if let CellRefRange::Sheet { range: range_ref } = last_range {
                            range_ref.start = CellRefRangeEnd::new_relative_xy(min_col, start_row);
                            range_ref.end = CellRefRangeEnd::new_relative_xy(max_col, UNBOUNDED);
                            self.cursor.x = min_col;
                            self.cursor.y = start_row;
                            return;
                        }
                    }
                }
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
                    let mut range = range.clone();
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
                            let second = if range.end.row.is_unbounded() {
                                CellRefRange::Sheet {
                                    range: RefRangeBounds {
                                        start: CellRefRangeEnd::new_relative_xy(1, row + 1),
                                        end: range.end,
                                    },
                                }
                            } else {
                                CellRefRange::Sheet {
                                    range: RefRangeBounds {
                                        start: CellRefRangeEnd::new_relative_xy(1, row + 1),
                                        end: range.end,
                                    },
                                }
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
                        let second = if range.end.row.is_unbounded() {
                            CellRefRange::Sheet {
                                range: RefRangeBounds {
                                    start: CellRefRangeEnd::new_relative_xy(1, row + 1),
                                    end: range.end,
                                },
                            }
                        } else {
                            CellRefRange::Sheet {
                                range: RefRangeBounds {
                                    start: CellRefRangeEnd::new_relative_xy(1, row + 1),
                                    end: range.end,
                                },
                            }
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
            self.cursor.x = left;
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
        // For right-click, if the column is already selected, keep the selection unchanged
        if is_right_click && !ctrl_key && !shift_key {
            if self.is_entire_column_selected(col) {
                return;
            }
        }

        if ctrl_key && !shift_key {
            self.add_or_remove_column(col, top, a1_context);
        } else if shift_key {
            self.extend_column(col, top);
        } else {
            self.select_only_column(col, top);
        }
    }

    pub fn extend_row(&mut self, row: i64, _left: i64) {
        // First, check for existing row ranges
        // A row range has end.col.is_unbounded()
        let mut found_row_range = false;
        for range in &mut self.ranges {
            if let CellRefRange::Sheet { range: range_ref } = range {
                if range_ref.end.col.is_unbounded() {
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
        }

        // If no row range found, check if we can convert a cell to a row range
        if !found_row_range {
            let mut cell_to_convert: Option<usize> = None;
            for (idx, range) in self.ranges.iter_mut().enumerate() {
                if let CellRefRange::Sheet { range: range_ref } = range {
                    if !range_ref.start.col.is_unbounded() && !range_ref.end.col.is_unbounded() {
                        // This is a regular cell/range (not a row or column range)
                        // If it's a single cell or single-row range, convert it to a row range
                        if range_ref.start.row() == range_ref.end.row() {
                            cell_to_convert = Some(idx);
                            break;
                        }
                    }
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
        // For right-click, if the row is already selected, keep the selection unchanged
        if is_right_click && !ctrl_key && !shift_key {
            if self.is_entire_row_selected(row) {
                return;
            }
        }

        if ctrl_key && !shift_key {
            self.add_or_remove_row(row, left, a1_context);
        } else if shift_key {
            self.extend_row(row, left);
        } else {
            self.select_only_row(row, left);
        }
    }

    pub fn select_rect(&mut self, left: i64, top: i64, right: i64, bottom: i64, append: bool) {
        let range = RefRangeBounds::new_relative_rect(Rect::new(left, top, right, bottom));
        if append {
            self.ranges.push(CellRefRange::Sheet { range });
        } else {
            self.ranges.clear();
            self.ranges.push(CellRefRange::Sheet { range });
        }
        self.cursor.x = left;
        self.cursor.y = top;
    }

    pub fn move_to(&mut self, x: i64, y: i64, append: bool) {
        if append {
            self.ranges
                .push(CellRefRange::new_relative_pos(Pos::new(x, y)));
        } else {
            self.ranges.clear();
            self.ranges
                .push(CellRefRange::new_relative_pos(Pos::new(x, y)));
        }
        self.cursor.x = x;
        self.cursor.y = y;
    }

    /// Extends the last selection to the given position. If append is true, then the range is appended
    /// to the ranges (or, if the last selection was a range, then the end of that range is extended).
    pub(crate) fn select_to(
        &mut self,
        column: i64,
        row: i64,
        append: bool,
        a1_context: &A1Context,
        merge_cells: Option<&MergeCells>,
        state: Option<super::SelectionState>,
    ) -> super::SelectionState {
        use normalize::normalize_selection;

        // Determine selection state - use provided state or compute from current selection
        let mut state =
            state.unwrap_or_else(|| super::SelectionState::from_selection(self, a1_context));

        // Adjust column/row to align with merged cell boundaries if selection includes merged cells
        let (adjusted_column, adjusted_row, adjusted_start) =
            merged_cells::adjust_selection_end_for_merged_cells(
                self,
                column,
                row,
                a1_context,
                merge_cells,
                &state,
            );

        // Store adjusted_start for use later
        let adjusted_start_opt = adjusted_start;

        // Store original cursor position for normalize function
        // This is the fixed point for the selection
        // For both keyboard and drag, if the start was adjusted to include merged cells, use the adjusted start
        // Otherwise, use the anchor from state
        let original_cursor = if let Some((adjusted_x, adjusted_y)) = adjusted_start_opt {
            // Start was adjusted to include merged cells - use adjusted position
            // For drag, also update the cursor and anchor
            if state.is_drag() {
                self.cursor.x = adjusted_x;
                self.cursor.y = adjusted_y;
                state.anchor.x = adjusted_x;
                state.anchor.y = adjusted_y;
            }
            // For keyboard, also update the anchor to match the adjusted start
            // This ensures the selection stays anchored at the merged cell boundary
            state.anchor.x = adjusted_x;
            state.anchor.y = adjusted_y;

            Pos {
                x: adjusted_x,
                y: adjusted_y,
            }
        } else {
            // No adjustment - use the original anchor
            if state.is_drag() {
                self.cursor
            } else {
                state.anchor
            }
        };

        let column = adjusted_column;
        let row = adjusted_row;
        // if the selection is empty, then we use the cursor as the starting point
        if self.ranges.is_empty() {
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        };
        if let Some(last) = self.ranges.last_mut() {
            match last {
                CellRefRange::Table { range } => {
                    if let Some(table) = a1_context.try_table(&range.table_name) {
                        let mut start: Option<(i64, i64)> = None;
                        match &range.col_range {
                            // all gets the entire table selection
                            ColRange::All => {
                                if table.show_name {
                                    start = Some((table.bounds.min.x, table.bounds.min.y));
                                }
                            }
                            ColRange::Col(col) => {
                                if table.show_columns
                                    && let Some(col_index) = table.try_col_index(col)
                                {
                                    start = Some((
                                        table.bounds.min.x + col_index,
                                        table.bounds.min.y + if table.show_name { 1 } else { 0 },
                                    ));
                                }
                            }
                            ColRange::ColRange(start_col, _) => {
                                if let Some(col_index) = table.try_col_index(start_col) {
                                    start = Some((
                                        table.bounds.min.x + col_index,
                                        table.bounds.min.y + if table.show_name { 1 } else { 0 },
                                    ));
                                }
                            }
                            ColRange::ColToEnd(col) => {
                                if let Some(col_index) = table.try_col_index(col) {
                                    start = Some((
                                        table.bounds.min.x + col_index,
                                        table.bounds.min.y + if table.show_name { 1 } else { 0 },
                                    ));
                                }
                            }
                        }
                        if let Some((start_col, start_row)) = start {
                            let range =
                                RefRangeBounds::new_relative(start_col, start_row, column, row);
                            *last = CellRefRange::Sheet { range };
                            // Update selection_end to track the target position
                            state.selection_end = Pos::new(column, row);
                            return state;
                        }
                    }
                    if let Some(mut range_converted) = range
                        .clone()
                        .convert_to_ref_range_bounds(false, a1_context, false, false)
                    {
                        // if cursor is at the end of the table, then reverse the selection
                        if self.cursor.x == range_converted.end.col()
                            && self.cursor.y == range_converted.end.row()
                        {
                            range_converted.start = range_converted.end;
                        }
                        range_converted.end = CellRefRangeEnd::new_relative_xy(column, row);
                        *last = CellRefRange::Sheet {
                            range: range_converted,
                        };
                    } else {
                        dbgjs!(
                            "Could not convert table range to ref range bounds in A1Selection::select_to"
                        );
                        // Update selection_end to track the target position
                        state.selection_end = Pos::new(column, row);
                        return state;
                    }
                    if !append {
                        self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
                    }
                }
                CellRefRange::Sheet { range } => {
                    if range.start.row.is_unbounded() {
                        self.cursor.y = row;
                    }
                    if range.start.col.is_unbounded() {
                        self.cursor.x = column;
                    }

                    // Normalize the selection using the new normalize module
                    let new_cursor = normalize_selection(
                        range,
                        column,
                        row,
                        original_cursor,
                        adjusted_start_opt,
                        &mut state,
                    );
                    self.cursor = new_cursor;

                    if !append {
                        self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
                    }
                }
            };
        }

        // Update state based on final selection and return it
        // Anchor NEVER changes - it stays fixed at the starting position for both keyboard and drag
        // Only selection_end moves to extend the selection
        // Mode stays the same throughout the selection operation

        // Update selection_end to the target position (column, row)
        // For keyboard selection, this is the moving end (opposite from cursor/anchor)
        // For drag selection, this tracks the current mouse position
        state.selection_end = Pos::new(column, row);

        state
    }

    /// Helper to convert last range to RefRangeBounds (for set_columns_selected and set_rows_selected)
    fn last_range_to_bounds(&self, a1_context: &A1Context) -> Option<RefRangeBounds> {
        let last = self.ranges.last()?;
        match last {
            CellRefRange::Sheet { range } => Some(*range),
            CellRefRange::Table { range } => {
                range.convert_to_ref_range_bounds(false, a1_context, false, false)
            }
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

    pub fn append_selection(&self, other: &Self) -> Self {
        let mut ranges = self.ranges.clone();
        ranges.extend(other.ranges.iter().cloned());
        Self {
            sheet_id: self.sheet_id,
            cursor: self.cursor,
            ranges,
        }
    }
}
