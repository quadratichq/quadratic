use std::collections::HashSet;

use crate::a1::{A1Context, CellRefCoord, CellRefRangeEnd, ColRange, RefRangeBounds, UNBOUNDED};
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

        // Use the default fallback
        self.cursor = if is_column {
            Pos {
                x: removed_pos + 1,
                y: fallback_pos,
            }
        } else {
            Pos {
                x: fallback_pos,
                y: removed_pos + 1,
            }
        };
    }

    /// Ensures that at least one range exists, using the current cursor position if necessary
    fn ensure_non_empty_ranges(&mut self, removed_pos: i64, fallback_pos: i64, is_column: bool) {
        if self.ranges.is_empty() {
            let (x, y) = if is_column {
                (removed_pos, fallback_pos)
            } else {
                (fallback_pos, removed_pos)
            };
            self.ranges.push(CellRefRange::new_relative_xy(x, y));
            self.cursor.x = x;
            self.cursor.y = y;
        }
    }

    /// Removes a column if it is in any column ranges, or adds it if it is not.
    fn add_or_remove_column(&mut self, col: i64, top: i64, a1_context: &A1Context) {
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
                        &CellRefRange::Sheet { mut range } => {
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

        self.reposition_cursor_after_removal(col, top, a1_context, true);
        self.ensure_non_empty_ranges(col, top, true);
    }

    /// Extends the last column range or creates a new one.
    pub fn extend_column(&mut self, col: i64, top: i64) {
        if let Some(CellRefRange::Sheet { range }) = self.ranges.last_mut() {
            range.end = CellRefRangeEnd::new_relative_xy(col, UNBOUNDED);
            if range.is_col_range() {
                self.cursor.y = range.start.row();
            }
        } else {
            self.ranges.push(CellRefRange::new_relative_column(col));
            self.cursor.x = col;
            self.cursor.y = top;
        }
    }

    /// Removes a row if it is in any row ranges, or adds it if it is not.
    fn add_or_remove_row(&mut self, row: i64, left: i64, a1_context: &A1Context) {
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
                        &CellRefRange::Sheet { mut range } => {
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

        self.reposition_cursor_after_removal(row, left, a1_context, false);
        self.ensure_non_empty_ranges(row, left, false);
    }

    /// Helper to select only a column (clears existing ranges)
    fn select_only_column(&mut self, col: i64, top: i64) {
        self.ranges.clear();
        self.ranges.push(CellRefRange::new_relative_column(col));
        self.cursor.x = col;
        self.cursor.y = top;
    }

    /// Helper to select only a row (clears existing ranges)
    fn select_only_row(&mut self, row: i64, left: i64) {
        self.ranges.clear();
        self.ranges.push(CellRefRange::new_relative_row(row));
        self.cursor.x = left;
        self.cursor.y = row;
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

        a1_context: &A1Context,
    ) {
        if is_right_click {
            if !self.ranges.iter().any(|range| range.has_col_range(col)) {
                self.select_only_column(col, top);
            }
        } else if !ctrl_key && !shift_key {
            self.select_only_column(col, top);
        } else if ctrl_key && !shift_key {
            self.add_or_remove_column(col, top, a1_context);
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
                col: CellRefCoord::REL_UNBOUNDED,
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

        a1_context: &A1Context,
    ) {
        if is_right_click {
            if !self.ranges.iter().any(|range| range.has_row_range(row)) {
                self.select_only_row(row, left);
            }
        } else if !ctrl_key && !shift_key {
            self.select_only_row(row, left);
        } else if ctrl_key && !shift_key {
            self.add_or_remove_row(row, left, a1_context);
        } else if shift_key {
            self.extend_row(row, left);
        }
    }

    /// Selects a rectangular range. If append is true, then the range is appended
    /// to the ranges (or, if the last selection was a range, then the end of
    /// that range is extended).
    pub fn select_rect(&mut self, left: i64, top: i64, right: i64, bottom: i64, append: bool) {
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
    }

    /// Moves the cursor to the given position and clears the selection.
    pub fn move_to(&mut self, x: i64, y: i64, append: bool) {
        self.cursor.x = x;
        self.cursor.y = y;
        if !append {
            self.ranges.clear();
        }
        self.ranges
            .push(CellRefRange::new_relative_pos(Pos::new(x, y)));
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
        is_drag: bool,
    ) {
        // Adjust column/row to align with merged cell boundaries if selection includes merged cells
        let (adjusted_column, adjusted_row, adjusted_start) = self
            .adjust_selection_end_for_merged_cells(column, row, a1_context, merge_cells, is_drag);

        // Store adjusted_start for use later
        let adjusted_start_opt = adjusted_start;

        // If the start position was adjusted (to include merged cells), update the cursor
        if let Some((start_x, start_y)) = adjusted_start_opt {
            self.cursor.x = start_x;
            self.cursor.y = start_y;
        }

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
                            return;
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
                        return;
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
                    // If start was adjusted, update the range start as well
                    if let Some((start_x, start_y)) = adjusted_start_opt {
                        // When both start and end are adjusted, create a normalized range
                        // (where start is always top-left and end is always bottom-right)
                        let min_x = start_x.min(column);
                        let max_x = start_x.max(column);
                        let min_y = start_y.min(row);
                        let max_y = start_y.max(row);

                        range.start = CellRefRangeEnd::new_relative_xy(min_x, min_y);
                        range.end = CellRefRangeEnd::new_relative_xy(max_x, max_y);
                    } else {
                        // No start adjustment - just set the end coordinate
                        // We still need to normalize the range to ensure start <= end
                        let start_x = range.start.col();
                        let start_y = range.start.row();

                        let min_x = start_x.min(column);
                        let max_x = start_x.max(column);
                        let min_y = start_y.min(row);
                        let max_y = start_y.max(row);

                        range.start = CellRefRangeEnd::new_relative_xy(min_x, min_y);
                        range.end = CellRefRangeEnd::new_relative_xy(max_x, max_y);
                    }
                    *last = CellRefRange::Sheet { range: *range };
                    if !append {
                        self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
                    }
                }
            };
        }
    }

    /// Adjusts selection end position to align with merged cell boundaries when selection includes merged cells
    /// Returns (adjusted_end_x, adjusted_end_y, optional_adjusted_start)
    fn adjust_selection_end_for_merged_cells(
        &self,
        new_x: i64,
        new_y: i64,
        a1_context: &A1Context,
        merge_cells: Option<&crate::grid::sheet::merge_cells::MergeCells>,
        is_drag: bool,
    ) -> (i64, i64, Option<(i64, i64)>) {
        let Some(merge_cells) = merge_cells else {
            return (new_x, new_y, None);
        };

        // Early return if current selection doesn't contain merged cells and new position isn't in a merged cell
        if !self.contains_merged_cells(a1_context, Some(merge_cells)) {
            // Check if the new position is in a merged cell - if so, we still need to adjust
            if merge_cells
                .get_merge_cell_rect(crate::Pos { x: new_x, y: new_y })
                .is_none()
            {
                return (new_x, new_y, None);
            }
        }

        let (start_x, start_y) = self.get_selection_start_position(a1_context);
        let (current_selection_end, current_bounds) = self.get_current_selection_info(a1_context);

        let delta_x = new_x - start_x;
        let delta_y = new_y - start_y;

        let mut selection_rect = self.create_initial_selection_rect(
            start_x,
            start_y,
            new_x,
            new_y,
            delta_x,
            delta_y,
            current_bounds,
        );

        let (shrinking_x, shrinking_y) =
            self.determine_shrink_behavior(start_x, start_y, new_x, new_y, current_selection_end);

        // Convert current_selection_end to Pos for use in adjust_rect_for_merged_cells
        let current_selection_end_pos = current_selection_end
            .map(|(x, y)| crate::Pos { x, y })
            .unwrap_or(crate::Pos {
                x: start_x,
                y: start_y,
            });

        self.adjust_rect_for_merged_cells(
            &mut selection_rect,
            start_x,
            start_y,
            new_x,
            new_y,
            shrinking_x,
            shrinking_y,
            merge_cells,
            is_drag,
            current_selection_end_pos,
        );

        self.calculate_adjusted_positions(selection_rect, start_x, start_y, new_x, new_y)
    }

    /// Gets the starting position of the current selection
    fn get_selection_start_position(&self, a1_context: &A1Context) -> (i64, i64) {
        if let Some(last_range) = self.ranges.last() {
            match last_range {
                CellRefRange::Sheet { range } => {
                    if range.is_finite() {
                        (range.start.col(), range.start.row())
                    } else {
                        (self.cursor.x, self.cursor.y)
                    }
                }
                CellRefRange::Table { range } => {
                    if let Some(rect) = range.to_largest_rect(a1_context) {
                        (rect.min.x, rect.min.y)
                    } else {
                        (self.cursor.x, self.cursor.y)
                    }
                }
            }
        } else {
            (self.cursor.x, self.cursor.y)
        }
    }

    /// Gets current selection end and bounds information
    fn get_current_selection_info(
        &self,
        a1_context: &A1Context,
    ) -> (Option<(i64, i64)>, Option<(i64, i64, i64, i64)>) {
        if let Some(last_range) = self.ranges.last() {
            match last_range {
                CellRefRange::Sheet { range } => {
                    if range.is_finite() {
                        let end = Some((range.end.col(), range.end.row()));
                        let bounds = Some((
                            range.start.col(),
                            range.start.row(),
                            range.end.col(),
                            range.end.row(),
                        ));
                        (end, bounds)
                    } else {
                        (None, None)
                    }
                }
                CellRefRange::Table { range } => {
                    if let Some(rect) = range.to_largest_rect(a1_context) {
                        let end = Some((rect.max.x, rect.max.y));
                        let bounds = Some((rect.min.x, rect.min.y, rect.max.x, rect.max.y));
                        (end, bounds)
                    } else {
                        (None, None)
                    }
                }
            }
        } else {
            (None, None)
        }
    }

    /// Creates the initial selection rectangle based on movement and current bounds
    fn create_initial_selection_rect(
        &self,
        start_x: i64,
        start_y: i64,
        new_x: i64,
        new_y: i64,
        delta_x: i64,
        delta_y: i64,
        current_bounds: Option<(i64, i64, i64, i64)>,
    ) -> Rect {
        if let Some((curr_min_x, curr_min_y, curr_max_x, curr_max_y)) = current_bounds {
            // Determine if we're shrinking in each direction
            let moving_left_from_right = delta_x < 0;
            let moving_right_from_left = delta_x > 0;
            let moving_up_from_bottom = delta_y < 0;
            let moving_down_from_top = delta_y > 0;

            // For X axis: preserve current bounds unless we're shrinking
            let min_x = if moving_left_from_right {
                new_x.min(start_x)
            } else {
                curr_min_x.min(new_x)
            };

            let max_x = if moving_right_from_left {
                new_x.max(start_x)
            } else if moving_left_from_right && new_x < start_x {
                start_x
            } else {
                curr_max_x.max(new_x)
            };

            // For Y axis: preserve current bounds unless we're shrinking
            let min_y = if moving_up_from_bottom {
                new_y.min(start_y)
            } else {
                curr_min_y.min(new_y)
            };

            let max_y = if moving_down_from_top {
                new_y.max(start_y)
            } else if moving_up_from_bottom && new_y < start_y {
                start_y
            } else {
                curr_max_y.max(new_y)
            };

            Rect::new(min_x, min_y, max_x, max_y)
        } else {
            // No current bounds, create from start to new position
            Rect::new(
                start_x.min(new_x),
                start_y.min(new_y),
                start_x.max(new_x),
                start_y.max(new_y),
            )
        }
    }

    /// Determines if we're shrinking or expanding in each axis
    fn determine_shrink_behavior(
        &self,
        start_x: i64,
        start_y: i64,
        new_x: i64,
        new_y: i64,
        current_selection_end: Option<(i64, i64)>,
    ) -> (bool, bool) {
        if let Some((current_end_x, current_end_y)) = current_selection_end {
            let delta_x = new_x - start_x;
            let delta_y = new_y - start_y;
            let current_delta_x = current_end_x - start_x;
            let current_delta_y = current_end_y - start_y;

            // Check if we're shrinking in X direction
            let shrinking_x = delta_x != 0
                && ((delta_x > 0 && current_delta_x > 0 && new_x < current_end_x)
                    || (delta_x < 0 && current_delta_x < 0 && new_x > current_end_x)
                    || (delta_x > 0 && current_delta_x < 0)
                    || (delta_x < 0 && current_delta_x > 0));

            // Check if we're shrinking in Y direction
            let shrinking_y = delta_y != 0
                && ((delta_y > 0 && current_delta_y > 0 && new_y < current_end_y)
                    || (delta_y < 0 && current_delta_y < 0 && new_y > current_end_y)
                    || (delta_y > 0 && current_delta_y < 0)
                    || (delta_y < 0 && current_delta_y > 0));

            (shrinking_x, shrinking_y)
        } else {
            (false, false)
        }
    }

    /// Collects all cells that need to be checked for merged cell boundaries
    /// Adjusts the selection rectangle to properly handle merged cells
    ///
    /// 1. Build the "potential" selection rect from start to end (ignoring current bounds)
    /// 2. Find all merged cells that overlap this potential selection OR contain the end position
    /// 3. Expand selection to fully include all such merged cells (iterate until stable)
    /// 4. When dragging: done - overlapping merged cells stay selected
    /// 5. When shift-clicking: shrink if moving away, but ensure no partial selection remains
    fn adjust_rect_for_merged_cells(
        &self,
        selection_rect: &mut Rect,
        start_x: i64,
        start_y: i64,
        new_x: i64,
        new_y: i64,
        shrinking_x: bool,
        shrinking_y: bool,
        merge_cells: &MergeCells,
        is_drag: bool,
        current_selection_end: crate::Pos,
    ) {
        // Build the "potential" selection rect from start to end
        // This represents what the selection WOULD be if we didn't have current bounds
        // We need this to find merged cells that the selection overlaps, even if we're shrinking
        let potential_selection = Rect::new(
            start_x.min(new_x),
            start_y.min(new_y),
            start_x.max(new_x),
            start_y.max(new_y),
        );

        // Build search rect that includes potential selection, current selection, start, and end positions
        // We need to expand the search rect to catch merged cells that extend beyond the potential selection
        // This is important because merged cells that overlap with the selection might extend beyond it
        let search_rect = Rect::new(
            potential_selection
                .min
                .x
                .min(selection_rect.min.x)
                .min(start_x)
                .min(new_x)
                - 100,
            potential_selection
                .min
                .y
                .min(selection_rect.min.y)
                .min(start_y)
                .min(new_y)
                - 100,
            potential_selection
                .max
                .x
                .max(selection_rect.max.x)
                .max(start_x)
                .max(new_x)
                + 100,
            potential_selection
                .max
                .y
                .max(selection_rect.max.y)
                .max(start_y)
                .max(new_y)
                + 100,
        );

        // Find all merged cells that overlap with potential selection or contain the end position
        // Use nondefault_rects_in_rect_combined to get complete merged cell rects
        let mut merged_cells_to_include = HashSet::<Rect>::new();

        // Get all merged cells in the search area
        for merge_rect in merge_cells.get_merge_cells(search_rect) {
            // Check if this merged cell overlaps with the potential selection
            // When reducing, we only care about potential_selection (start to new position)
            // When expanding/dragging, we also check current selection
            let overlaps_potential = merge_rect.intersects(potential_selection);
            let overlaps_current = merge_rect.intersects(*selection_rect);

            // When reducing selection (not dragging), check if the new position is completely
            // outside the merged cell. If so, we should allow shrinking past it.
            let new_pos_outside_merge = if !is_drag && (shrinking_x || shrinking_y) {
                // Check if new position is completely before/above/left/right of the merged cell
                (shrinking_x && new_x < merge_rect.min.x)
                    || (shrinking_x && new_x > merge_rect.max.x)
                    || (shrinking_y && new_y < merge_rect.min.y)
                    || (shrinking_y && new_y > merge_rect.max.y)
            } else {
                false
            };

            // Include merged cells that overlap with potential selection (always)
            // or current selection (when dragging)
            // But exclude merged cells when reducing and the new position is outside them
            // When reducing, only check potential_selection, not current selection (which has old bounds)
            let should_include = if is_drag {
                overlaps_potential || overlaps_current
            } else if shrinking_x || shrinking_y {
                // When reducing, only include if it overlaps with potential selection AND new position is not outside
                overlaps_potential && !new_pos_outside_merge
            } else {
                // When expanding (not dragging, not shrinking), include if it overlaps with potential selection
                overlaps_potential
            };

            if should_include {
                merged_cells_to_include.insert(merge_rect);
            }
        }

        // Also check if end position is within a merged cell
        // But only include it if we're not reducing past it
        if let Some(end_merge_rect) =
            merge_cells.get_merge_cell_rect(crate::Pos { x: new_x, y: new_y })
        {
            // When reducing, if the new position is within a merged cell, include it
            // (This is the normal case - selecting into a merged cell)
            // But if we're reducing and the new position moved outside a previously selected merged cell,
            // that's handled by the logic above
            merged_cells_to_include.insert(end_merge_rect);
        }

        // Expand selection to fully include all overlapping merged cells
        // When dragging, check overlap with potential_selection to ensure we include merged cells
        // even if current selection_rect has been shrunk
        // Iterate until no more changes (in case expansion reveals new overlapping merged cells)
        loop {
            let mut changed = false;

            for merge_rect in &merged_cells_to_include {
                // Check overlap with current selection_rect and potential selection
                // This ensures we include merged cells that overlap with the full selection
                let overlaps_current = merge_rect.intersects(*selection_rect);
                let overlaps_potential = merge_rect.intersects(potential_selection);

                // When reducing (not dragging), check if the new position is outside this merged cell
                // If so, don't expand to include it (we're shrinking past it)
                let new_pos_outside_this_merge = if !is_drag && (shrinking_x || shrinking_y) {
                    (shrinking_x && new_x < merge_rect.min.x)
                        || (shrinking_x && new_x > merge_rect.max.x)
                        || (shrinking_y && new_y < merge_rect.min.y)
                        || (shrinking_y && new_y > merge_rect.max.y)
                } else {
                    false
                };

                // Also check if current selection end is beyond this merged cell
                // If so, we're shrinking past it even if new position is still within
                let current_end_beyond_merge = if !is_drag && (shrinking_x || shrinking_y) {
                    (shrinking_x && current_selection_end.x > merge_rect.max.x)
                        || (shrinking_x && current_selection_end.x < merge_rect.min.x)
                        || (shrinking_y && current_selection_end.y > merge_rect.max.y)
                        || (shrinking_y && current_selection_end.y < merge_rect.min.y)
                } else {
                    false
                };

                // Expand to include merged cells that overlap with potential selection or current selection
                // But don't expand if we're reducing and the new position is outside this merged cell
                // OR if the current selection end is beyond this merged cell (we're shrinking past it)
                if (overlaps_current || overlaps_potential)
                    && !new_pos_outside_this_merge
                    && !current_end_beyond_merge
                {
                    // Expand to fully include this merged cell
                    if selection_rect.min.x > merge_rect.min.x {
                        selection_rect.min.x = merge_rect.min.x;
                        changed = true;
                    }
                    if selection_rect.min.y > merge_rect.min.y {
                        selection_rect.min.y = merge_rect.min.y;
                        changed = true;
                    }
                    if selection_rect.max.x < merge_rect.max.x {
                        selection_rect.max.x = merge_rect.max.x;
                        changed = true;
                    }
                    if selection_rect.max.y < merge_rect.max.y {
                        selection_rect.max.y = merge_rect.max.y;
                        changed = true;
                    }
                }
            }

            // If we expanded, check for newly overlapping merged cells
            // After expanding, we need to check ALL merged cells that overlap with the
            // current expanded selection_rect, not just those in a search area.
            // This ensures that when we expand to include a merged cell, we catch any
            // other merged cells that now overlap with the expanded selection.
            if changed {
                // Check for merged cells that overlap with the current expanded selection_rect
                // Expand the search area slightly to catch edge cases
                let expanded_search = Rect::new(
                    selection_rect.min.x.min(start_x).min(new_x) - 1,
                    selection_rect.min.y.min(start_y).min(new_y) - 1,
                    selection_rect.max.x.max(start_x).max(new_x) + 1,
                    selection_rect.max.y.max(start_y).max(new_y) + 1,
                );

                // Get all merged cells in the expanded search area
                let newly_found_merged_cells = merge_cells.get_merge_cells(expanded_search);

                // Check each newly found merged cell to see if it overlaps
                // But don't include merged cells when reducing and new position is outside them
                for merge_rect in newly_found_merged_cells {
                    let overlaps = merge_rect.intersects(*selection_rect)
                        || merge_rect.intersects(potential_selection);

                    let new_pos_outside = if !is_drag && (shrinking_x || shrinking_y) {
                        (shrinking_x && new_x < merge_rect.min.x)
                            || (shrinking_x && new_x > merge_rect.max.x)
                            || (shrinking_y && new_y < merge_rect.min.y)
                            || (shrinking_y && new_y > merge_rect.max.y)
                    } else {
                        false
                    };

                    if overlaps && !new_pos_outside {
                        merged_cells_to_include.insert(merge_rect);
                    }
                }
            } else {
                break;
            }
        }

        // When dragging: we're done - overlapping merged cells stay selected
        // When shift-clicking: we may need to shrink if moving away, but ensure no partial selection
        if !is_drag && (shrinking_x || shrinking_y) {
            // Re-collect merged cells for shrinking logic
            let final_search = Rect::new(
                selection_rect.min.x.min(start_x).min(new_x),
                selection_rect.min.y.min(start_y).min(new_y),
                selection_rect.max.x.max(start_x).max(new_x),
                selection_rect.max.y.max(start_y).max(new_y),
            );
            let mut merged_cells_for_shrink = HashSet::<Rect>::new();
            for merge_rect in merge_cells.get_merge_cells(final_search) {
                merged_cells_for_shrink.insert(merge_rect);
            }

            // Shrink to exclude partially overlapping merged cells (only when not dragging)
            self.shrink_for_merged_cells(
                selection_rect,
                &merged_cells_for_shrink,
                start_x,
                start_y,
                new_x,
                new_y,
                shrinking_x,
                shrinking_y,
                merge_cells,
                is_drag,
            );

            // Final pass: ensure no partial selection remains
            // When shrinking, we can either expand to include fully or shrink further to exclude completely
            // Prefer shrinking further when the new position is outside the merged cell
            for merge_rect in &merged_cells_for_shrink {
                let overlaps = merge_rect.intersects(*selection_rect);
                let fully_included = selection_rect.min.x <= merge_rect.min.x
                    && selection_rect.min.y <= merge_rect.min.y
                    && selection_rect.max.x >= merge_rect.max.x
                    && selection_rect.max.y >= merge_rect.max.y;

                if overlaps && !fully_included {
                    // We have a partial overlap - need to resolve it
                    if shrinking_x || shrinking_y {
                        // When shrinking, always shrink further to exclude partially overlapping merged cells
                        // This prevents partial selections and allows unselecting merged cells
                        if shrinking_x {
                            if merge_rect.min.x <= selection_rect.max.x
                                && merge_rect.max.x >= selection_rect.min.x
                            {
                                // Merged cell overlaps with selection - shrink to exclude it completely
                                if new_x < merge_rect.min.x {
                                    // Shrinking left - shrink max_x to just before merged cell
                                    let max_safe_x = merge_rect.min.x - 1;
                                    if max_safe_x >= selection_rect.min.x {
                                        selection_rect.max.x = selection_rect.max.x.min(max_safe_x);
                                    }
                                } else if new_x > merge_rect.max.x {
                                    // Shrinking right - shrink min_x to just after merged cell
                                    let min_safe_x = merge_rect.max.x + 1;
                                    if min_safe_x <= selection_rect.max.x {
                                        selection_rect.min.x = selection_rect.min.x.max(min_safe_x);
                                    }
                                } else {
                                    // New position is within merged cell bounds - shrink to exclude based on direction
                                    // If we're shrinking left, exclude everything from merged cell onwards
                                    if shrinking_x && new_x <= merge_rect.max.x {
                                        let max_safe_x = merge_rect.min.x - 1;
                                        if max_safe_x >= selection_rect.min.x {
                                            selection_rect.max.x =
                                                selection_rect.max.x.min(max_safe_x);
                                        }
                                    }
                                }
                            }
                        }
                        if shrinking_y {
                            if merge_rect.min.y <= selection_rect.max.y
                                && merge_rect.max.y >= selection_rect.min.y
                            {
                                // Merged cell overlaps with selection - shrink to exclude it completely
                                if new_y < merge_rect.min.y {
                                    // Shrinking up - shrink max_y to just before merged cell
                                    let max_safe_y = merge_rect.min.y - 1;
                                    if max_safe_y >= selection_rect.min.y {
                                        selection_rect.max.y = selection_rect.max.y.min(max_safe_y);
                                    }
                                } else if new_y > merge_rect.max.y {
                                    // Shrinking down - shrink min_y to just after merged cell
                                    let min_safe_y = merge_rect.max.y + 1;
                                    if min_safe_y <= selection_rect.max.y {
                                        selection_rect.min.y = selection_rect.min.y.max(min_safe_y);
                                    }
                                } else {
                                    // New position is within merged cell bounds - shrink to exclude based on direction
                                    // If we're shrinking up, exclude everything from merged cell onwards
                                    if shrinking_y && new_y <= merge_rect.max.y {
                                        let max_safe_y = merge_rect.min.y - 1;
                                        if max_safe_y >= selection_rect.min.y {
                                            selection_rect.max.y =
                                                selection_rect.max.y.min(max_safe_y);
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // When expanding (not shrinking), expand to include fully (no partial selection)
                        if selection_rect.min.x > merge_rect.min.x {
                            selection_rect.min.x = merge_rect.min.x;
                        }
                        if selection_rect.min.y > merge_rect.min.y {
                            selection_rect.min.y = merge_rect.min.y;
                        }
                        if selection_rect.max.x < merge_rect.max.x {
                            selection_rect.max.x = merge_rect.max.x;
                        }
                        if selection_rect.max.y < merge_rect.max.y {
                            selection_rect.max.y = merge_rect.max.y;
                        }
                    }
                }
            }
        }
    }

    /// Shrinks the selection to exclude partially overlapping merged cells
    fn shrink_for_merged_cells(
        &self,
        selection_rect: &mut Rect,
        merged_cells: &HashSet<Rect>,
        start_x: i64,
        start_y: i64,
        new_x: i64,
        new_y: i64,
        shrinking_x: bool,
        shrinking_y: bool,
        merge_cells_ref: &MergeCells,
        is_drag: bool,
    ) -> bool {
        let mut changed = false;

        // When dragging, check if the mouse position is within any merged cell
        // If so, don't shrink to exclude that merged cell
        let mouse_in_merged_cell = if is_drag {
            merge_cells_ref
                .get_merge_cell_rect(crate::Pos { x: new_x, y: new_y })
                .is_some()
        } else {
            false
        };

        for merge_rect in merged_cells {
            let merge_overlaps = merge_rect.intersects(*selection_rect);
            let merge_fully_included = selection_rect.min.x <= merge_rect.min.x
                && selection_rect.min.y <= merge_rect.min.y
                && selection_rect.max.x >= merge_rect.max.x
                && selection_rect.max.y >= merge_rect.max.y;

            // When dragging, if the mouse is within this merged cell, don't shrink to exclude it
            let mouse_in_this_merged_cell = if is_drag && mouse_in_merged_cell {
                let mouse_merge_rect =
                    merge_cells_ref.get_merge_cell_rect(crate::Pos { x: new_x, y: new_y });
                mouse_merge_rect.map_or(false, |rect| rect == *merge_rect)
            } else {
                false
            };

            // When dragging, if the selection still overlaps with the merged cell, keep it included
            // Only shrink to exclude if we're moving away AND the selection no longer overlaps
            // IMPORTANT: When dragging, we never shrink to exclude overlapping merged cells
            // because the user is still selecting them (even if moving in a direction that would
            // normally shrink the selection)
            let keep_merged_cell = if is_drag {
                // When dragging, always keep merged cells that overlap with the selection
                // This prevents partially selected merged cells during drag operations
                mouse_in_this_merged_cell || merge_overlaps
            } else {
                false
            };

            // Check if we're reducing past a fully included merged cell (keyboard navigation)
            // Only shrink past the merged cell that's immediately adjacent to the new position.
            // This ensures we don't jump past multiple merged cells when there are gaps between them.
            // When the selection end is beyond the merged cell, we can still shrink if the new position
            // is immediately adjacent (the normal case), but we won't shrink past non-adjacent merged cells.
            let reducing_past_fully_included = if !is_drag && merge_fully_included {
                if shrinking_y && new_y < merge_rect.min.y {
                    // Moving up: only shrink past merged cells that start immediately below the new position
                    // The merged cell should start at new_y + 1 (immediately below)
                    merge_rect.min.y == new_y + 1
                } else if shrinking_y && new_y > merge_rect.max.y {
                    // Moving down: only shrink past merged cells that end immediately above the new position
                    // The merged cell should end at new_y - 1 (immediately above)
                    merge_rect.max.y == new_y - 1
                } else if shrinking_x && new_x < merge_rect.min.x {
                    // Moving left: only shrink past merged cells that start immediately right of the new position
                    // The merged cell should start at new_x + 1 (immediately right)
                    merge_rect.min.x == new_x + 1
                } else if shrinking_x && new_x > merge_rect.max.x {
                    // Moving right: only shrink past merged cells that end immediately left of the new position
                    // The merged cell should end at new_x - 1 (immediately left)
                    merge_rect.max.x == new_x - 1
                } else {
                    false
                }
            } else {
                false
            };

            // Shrink if:
            // 1. Merged cell is not fully included, overlaps, and we're not keeping it (partial overlap case)
            // 2. OR we're reducing past a fully included merged cell (keyboard navigation)
            let should_shrink = (!merge_fully_included && merge_overlaps && !keep_merged_cell)
                || reducing_past_fully_included;
            if should_shrink {
                if shrinking_x {
                    let max_safe_x = merge_rect.min.x - 1;
                    // When reducing past a fully included merged cell, shrink to just before it
                    // Maintain the selection width by keeping min_x the same
                    if reducing_past_fully_included && merge_fully_included {
                        // Shrink to just before the merged cell, preserving selection width
                        if max_safe_x >= selection_rect.min.x {
                            let new_max_x = selection_rect.max.x.min(max_safe_x);
                            if new_max_x != selection_rect.max.x {
                                selection_rect.max.x = new_max_x;
                                changed = true;
                            }
                        }
                    } else {
                        // Partial overlap case - use existing logic
                        if max_safe_x >= start_x {
                            let new_max_x = selection_rect.max.x.min(max_safe_x);
                            if new_max_x != selection_rect.max.x {
                                selection_rect.max.x = new_max_x;
                                changed = true;
                            }
                        } else if selection_rect.max.x != start_x {
                            selection_rect.max.x = start_x;
                            selection_rect.min.x = start_x;
                            changed = true;
                        }
                    }
                }

                if shrinking_y {
                    let max_safe_y = merge_rect.min.y - 1;
                    // When reducing past a fully included merged cell, shrink to just before it
                    // Maintain the selection height by keeping min_y the same
                    if reducing_past_fully_included && merge_fully_included {
                        // Shrink to just before the merged cell, preserving selection height
                        if max_safe_y >= selection_rect.min.y {
                            let new_max_y = selection_rect.max.y.min(max_safe_y);
                            if new_max_y != selection_rect.max.y {
                                selection_rect.max.y = new_max_y;
                                changed = true;
                            }
                        }
                    } else {
                        // Partial overlap case - use existing logic
                        if max_safe_y >= start_y {
                            let new_max_y = selection_rect.max.y.min(max_safe_y);
                            if new_max_y != selection_rect.max.y {
                                selection_rect.max.y = new_max_y;
                                changed = true;
                            }
                        } else if selection_rect.max.y != start_y {
                            selection_rect.max.y = start_y;
                            selection_rect.min.y = start_y;
                            changed = true;
                        }
                    }
                }
            }
        }

        changed
    }

    /// Calculates the final adjusted positions based on the selection rectangle
    fn calculate_adjusted_positions(
        &self,
        selection_rect: Rect,
        start_x: i64,
        start_y: i64,
        new_x: i64,
        new_y: i64,
    ) -> (i64, i64, Option<(i64, i64)>) {
        let targets_right = new_x >= start_x;
        let targets_down = new_y >= start_y;

        let adjusted_end_x = if targets_right {
            selection_rect.max.x
        } else {
            selection_rect.min.x
        };

        let adjusted_end_y = if targets_down {
            selection_rect.max.y
        } else {
            selection_rect.min.y
        };

        let adjusted_start_x = if targets_right {
            selection_rect.min.x
        } else {
            selection_rect.max.x
        };

        let adjusted_start_y = if targets_down {
            selection_rect.min.y
        } else {
            selection_rect.max.y
        };

        let adjusted_start = if adjusted_start_x != start_x || adjusted_start_y != start_y {
            Some((adjusted_start_x, adjusted_start_y))
        } else {
            None
        };

        (adjusted_end_x, adjusted_end_y, adjusted_start)
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

    /// Changes the selection to select all columns that have a selection (used by cmd+space). It only
    /// checks the last range (the same as Excel and Sheets)
    pub fn set_columns_selected(&mut self, a1_context: &A1Context) {
        let Some(last) = self.last_range_to_bounds(a1_context) else {
            return;
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
    pub fn set_rows_selected(&mut self, a1_context: &A1Context) {
        let Some(last) = self.last_range_to_bounds(a1_context) else {
            return;
        };
        self.ranges.clear();
        self.ranges.push(CellRefRange::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(1, last.start.row()),
                end: CellRefRangeEnd::new_relative_xy(UNBOUNDED, last.end.row()),
            },
        });
    }

    /// Appends a selection to an existing selection and returns a new selection.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn append_selection(&self, other: &Self) -> Self {
        let mut new_selection = self.clone();
        new_selection.ranges.extend(other.ranges.clone());
        new_selection
    }
}

#[cfg(test)]
mod tests {
    use crate::{Rect, grid::SheetId};

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
        let mut selection = A1Selection::test_a1("A1,B1,C1");
        selection.move_to(2, 2, false);
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
        assert_eq!(selection.test_to_string(), "2:2");
    }

    #[test]
    fn test_select_rect() {
        let mut selection = A1Selection::test_a1("A1,B2,C3");
        selection.select_rect(1, 1, 2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection.cursor.y, 1);

        let mut selection = A1Selection::test_a1("A1:C3");
        selection.select_rect(3, 3, 5, 5, true);
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
        selection.select_to(2, 2, false, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);

        selection = A1Selection::test_a1("A:B");
        selection.select_to(2, 2, false, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A:B2")]);

        selection = A1Selection::test_a1("A1");
        selection.select_to(3, 3, false, &context, None, false);
        selection.select_to(1, 1, false, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1")]);

        let mut selection = A1Selection::test_a1("A1,B2,C3");
        selection.select_to(2, 2, false, &context, None, false);
        // When selecting from C3 to B2 (right-to-left, bottom-to-top), the range is normalized to B2:C3
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2:C3")]);
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
        let mut selection = A1Selection::test_a1("A1");
        selection.select_rect(2, 2, 2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2")]);
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 2);
    }

    #[test]
    fn test_select_to_with_append() {
        let context = A1Context::default();
        let mut selection = A1Selection::test_a1("A1");
        selection.select_to(2, 2, true, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);

        // Test appending to existing selection
        selection.select_to(3, 3, true, &context, None, false);
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
    fn test_table_selection() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::TEST)],
            &[("Table1", &["col1", "col2", "col3"], Rect::test_a1("A1:C3"))],
        );

        let mut selection = A1Selection::test_a1_context("Table1", &context);
        selection.select_to(5, 5, true, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:E5")]);

        // Test table column selection
        selection = A1Selection::test_a1_context("Table1[col2]", &context);
        selection.select_to(4, 6, true, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2:D6")]);
    }

    #[test]
    fn test_complex_selection_scenarios() {
        let context = A1Context::default();

        // Test multiple discontinuous ranges
        let mut selection = A1Selection::test_a1("A1:B2,D4:E5");
        selection.select_to(6, 6, false, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("D4:F6")]);
    }

    #[test]
    fn test_unbounded_selection_edge_cases() {
        let context = A1Context::default();

        // Test unbounded column selection
        let mut selection = A1Selection::test_a1("A:");
        selection.select_to(3, 5, false, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:C5")]);

        // Test unbounded row selection
        selection = A1Selection::test_a1("1:");
        selection.select_to(4, 3, false, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:D3")]);

        // Test selection starting from unbounded
        selection = A1Selection::test_a1(":");
        selection.select_to(2, 2, false, &context, None, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
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

    #[test]
    fn test_select_to_with_merged_cell_drag() {
        use crate::grid::sheet::merge_cells::MergeCells;
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();

        // Add merged cell from D5:G12
        merge_cells.merge_cells(Rect::test_a1("D5:G12"));

        // Start selection at B2
        let mut selection = A1Selection::test_a1("B2");

        // Select to E7 - merged cell should be included
        // B2 to E7 overlaps with merged cell D5:G12, so selection should expand to include entire merged cell
        selection.select_to(5, 7, false, &context, Some(&merge_cells), false);
        let ranges = &selection.ranges;
        assert_eq!(ranges.len(), 1);
        if let CellRefRange::Sheet { range } = &ranges[0] {
            // The selection B2:E7 overlaps with merged cell D5:G12 (columns 4-7, rows 5-12)
            // So it should expand to include the entire merged cell
            // Selection should be at least B2:G12 (columns 2-7, rows 2-12)
            let end_col = range.end.col();
            let end_row = range.end.row();
            assert!(
                end_col >= 7,
                "Selection end column {} should be >= 7 (G) to include merged cell",
                end_col
            );
            assert!(
                end_row >= 12,
                "Selection end row {} should be >= 12 to include merged cell",
                end_row
            );
        }

        // Drag to D14 - merged cell should still be selected (not partially selected)
        // When dragging from E7 to D14, we're moving left and down, but the selection B2:D14
        // still overlaps with merged cell D5:G12 (column 4 overlaps, rows 5-12 overlap),
        // so the merged cell should remain fully included
        selection.select_to(4, 14, false, &context, Some(&merge_cells), true);
        let ranges_after_drag = &selection.ranges;
        assert_eq!(ranges_after_drag.len(), 1);
        if let CellRefRange::Sheet { range } = &ranges_after_drag[0] {
            // The merged cell D5:G12 should still be fully included
            // Selection from B2 to D14 overlaps with D5:G12, so it should expand to include entire merged cell
            let end_col = range.end.col();
            let end_row = range.end.row();
            assert!(
                end_col >= 7,
                "Selection end column {} should be >= 7 (G) to include merged cell D5:G12",
                end_col
            );
            assert!(
                end_row >= 12,
                "Selection end row {} should be >= 12 to include merged cell D5:G12",
                end_row
            );

            // Verify the merged cell is fully included (not partially selected)
            if let Some(selection_rect) = range.to_rect() {
                // Check that D5:G12 is fully within the selection
                // D5:G12 means columns 4-7, rows 5-12
                assert!(
                    selection_rect.min.x <= 4 && selection_rect.min.y <= 5,
                    "Selection should start before or at merged cell start (D5 is col 4, row 5)"
                );
                assert!(
                    selection_rect.max.x >= 7 && selection_rect.max.y >= 12,
                    "Selection should end after or at merged cell end (G12 is col 7, row 12)"
                );
            } else {
                panic!("Selection should be finite");
            }
        }
    }

    #[test]
    fn test_select_to_with_multiple_merged_cells() {
        use crate::grid::sheet::merge_cells::MergeCells;
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();

        // Add three merged cells:
        // Merged cell 1: B2:D4 (columns 2-4, rows 2-4)
        // Merged cell 2: F5:H7 (columns 6-8, rows 5-7)
        // Merged cell 3: I8:J10 (columns 9-10, rows 8-10)
        // The selection from A1 to G6 should include merged cell 1 and 2
        // When we expand to include merged cell 2, we should check if merged cell 3 now overlaps
        merge_cells.merge_cells(Rect::test_a1("B2:D4"));
        merge_cells.merge_cells(Rect::test_a1("F5:H7"));
        merge_cells.merge_cells(Rect::test_a1("I8:J10"));

        // Start selection at A1
        let mut selection = A1Selection::test_a1("A1");

        // Select to G6 - this should include merged cells B2:D4 and F5:H7
        // A1 to G6 overlaps with B2:D4 (columns 2-4, rows 2-4) and F5:H7 (columns 6-8, rows 5-7)
        // When we expand to include F5:H7, we need to check if I8:J10 now overlaps
        // (It shouldn't in this case, but the logic should check)
        selection.select_to(7, 6, false, &context, Some(&merge_cells), false);
        let ranges = &selection.ranges;
        assert_eq!(ranges.len(), 1);
        if let CellRefRange::Sheet { range } = &ranges[0] {
            // The selection should include both merged cells B2:D4 and F5:H7
            // So it should be at least A1:H7 (columns 1-8, rows 1-7)
            let end_col = range.end.col();
            let end_row = range.end.row();
            assert!(
                end_col >= 8,
                "Selection end column {} should be >= 8 (H) to include merged cell F5:H7",
                end_col
            );
            assert!(
                end_row >= 7,
                "Selection end row {} should be >= 7 to include merged cell F5:H7",
                end_row
            );

            // Verify merged cell B2:D4 is fully included
            assert!(
                range.start.col() <= 2 && range.start.row() <= 2,
                "Selection should start before or at merged cell B2:D4"
            );
            assert!(
                end_col >= 4 && end_row >= 4,
                "Selection should include entire merged cell B2:D4"
            );

            // Verify merged cell F5:H7 is fully included
            assert!(
                range.start.col() <= 6 && range.start.row() <= 5,
                "Selection should start before or at merged cell F5:H7"
            );
            assert!(
                end_col >= 8 && end_row >= 7,
                "Selection should include entire merged cell F5:H7"
            );
        }

        // Now test a case where expanding to include one merged cell reveals another
        // Add merged cell 4: E8:F9 (columns 5-6, rows 8-9) - this is adjacent to F5:H7
        merge_cells.merge_cells(Rect::test_a1("E8:F9"));

        // Select from A1 to G7 - this should include F5:H7, and when we expand to include it,
        // we should check if E8:F9 now overlaps (it doesn't, but we should check)
        let mut selection2 = A1Selection::test_a1("A1");
        selection2.select_to(7, 7, false, &context, Some(&merge_cells), false);

        // Now extend selection to H9 - this should include E8:F9
        // When we expand to include F5:H7, we should check if E8:F9 overlaps
        // E8:F9 (columns 5-6, rows 8-9) overlaps with the expanded selection that includes F5:H7
        selection2.select_to(8, 9, false, &context, Some(&merge_cells), false);
        let ranges2 = &selection2.ranges;
        assert_eq!(ranges2.len(), 1);
        if let CellRefRange::Sheet { range } = &ranges2[0] {
            // The selection should include F5:H7 and E8:F9
            // So it should be at least A1:H9 (columns 1-8, rows 1-9)
            let end_col = range.end.col();
            let end_row = range.end.row();
            assert!(
                end_col >= 8,
                "Selection end column {} should be >= 8 (H) to include merged cells",
                end_col
            );
            assert!(
                end_row >= 9,
                "Selection end row {} should be >= 9 to include merged cell E8:F9",
                end_row
            );
        }
    }

    #[test]
    fn test_select_to_with_merged_cells_no_drag() {
        use crate::grid::sheet::merge_cells::MergeCells;
        let context = A1Context::default();
        let mut merge_cells = MergeCells::default();

        // Test 1: Single merged cell that extends beyond selection bounds
        // Merged cell D5:G12 extends beyond selection B2:E14, should still be included
        merge_cells.merge_cells(Rect::test_a1("D5:G12"));
        let mut selection = A1Selection::test_a1("B2");
        selection.select_to(5, 14, false, &context, Some(&merge_cells), false);
        if let CellRefRange::Sheet { range } = &selection.ranges[0] {
            assert!(
                range.end.col() >= 7,
                "Should include merged cell extending beyond selection"
            );
            assert!(
                range.end.row() >= 12,
                "Should include merged cell extending beyond selection"
            );
        }

        // Test 2: Multiple merged cells
        merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C3:E5"));
        merge_cells.merge_cells(Rect::test_a1("G7:I9"));
        let mut selection2 = A1Selection::test_a1("A1");
        selection2.select_to(8, 8, false, &context, Some(&merge_cells), false);
        if let CellRefRange::Sheet { range } = &selection2.ranges[0] {
            assert!(range.end.col() >= 9, "Should include both merged cells");
            assert!(range.end.row() >= 9, "Should include both merged cells");
        }
    }
}
