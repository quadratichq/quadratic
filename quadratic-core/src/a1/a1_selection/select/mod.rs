mod column_row;
mod helpers;
mod keyboard;
pub(crate) mod merged_cells;
mod normalize;

#[cfg(test)]
mod tests;

use crate::a1::{A1Context, CellRefRangeEnd, ColRange, RefRangeBounds};
use crate::grid::sheet::merge_cells::MergeCells;
use crate::{Pos, Rect};

use super::{A1Selection, CellRefRange};

impl A1Selection {
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

    /// to the ranges (or, if the last selection was a range, then the end of that range is extended).
    pub(crate) fn select_to(
        &mut self,
        column: i64,
        row: i64,
        append: bool,
        isDrag: bool,
        isShiftClick: bool,
        a1_context: &A1Context,
        merge_cells: &MergeCells,
    ) {
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
                            // let range =
                            //     RefRangeBounds::new_relative(start_col, start_row, column, row);
                            // *last = CellRefRange::Sheet { range };
                            // Update selection_end to track the target position
                            // return Pos::new(column, row);
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
                        // return Pos::new(column, row);
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

                    // // Normalize the selection using the new normalize module
                    // let new_cursor = normalize_selection(
                    //     range,
                    //     column,
                    //     row,
                    //     original_cursor,
                    //     None, // Merged cell adjustments handled separately
                    //     &mut state,
                    // );
                    // self.cursor = new_cursor;

                    if !append {
                        self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
                    }
                }
            };
        }
        // state.selection_end = Pos::new(column, row);

        // state
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
