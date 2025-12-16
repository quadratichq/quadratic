use crate::{
    a1::{A1Context, A1Selection, CellRefRange, CellRefRangeEnd, ColRange},
    grid::sheet::merge_cells::MergeCells,
};

impl A1Selection {
    /// to the ranges (or, if the last selection was a range, then the end of that range is extended).
    pub(crate) fn select_to(
        &mut self,
        column: i64,
        row: i64,
        append: bool,
        a1_context: &A1Context,
        _merge_cells: &MergeCells,
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
                        if let Some((_start_col, _start_row)) = start {
                            todo!()
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

                    range.end = CellRefRangeEnd::new_relative_xy(column, row);

                    if !append {
                        self.ranges = self.ranges.split_off(self.ranges.len().saturating_sub(1));
                    }
                }
            };
        }
    }
}
