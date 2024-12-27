use crate::{
    grid::{SheetId, TableMap},
    Rect, UNBOUNDED,
};

use super::*;

impl TableRef {
    pub fn selected_cols(
        &self,
        from: i64,
        to: i64,
        sheet_id: SheetId,
        table_map: &TableMap,
    ) -> Vec<i64> {
        let mut cols = vec![];
        if let Some(table_entry) = table_map
            .tables
            .iter()
            .find(|entry| entry.sheet_id == sheet_id && entry.table_name == self.table_name)
        {
            cols.extend(table_entry.bounds.cols_range(from, to));
        }
        cols
    }

    pub fn selected_rows(
        &self,
        from: i64,
        to: i64,
        sheet_id: SheetId,
        table_map: &TableMap,
    ) -> Vec<i64> {
        let mut rows = vec![];

        if let Some(table_entry) = table_map
            .tables
            .iter()
            .find(|entry| entry.sheet_id == sheet_id && entry.table_name == self.table_name)
        {
            rows.extend(table_entry.bounds.rows_range(from, to));
        }

        rows
    }

    pub fn is_multi_cursor(&self, sheet_id: SheetId, table_map: &TableMap) -> bool {
        // if more than one column, then it's a multi-cursor
        if self.col_ranges.len() > 1 {
            return true;
        }

        // If just the last row and one column, then it's not a multi-cursor
        match &self.row_range {
            RowRange::All => {
                if let Some(table_entry) = table_map
                    .tables
                    .iter()
                    .find(|entry| entry.sheet_id == sheet_id && entry.table_name == self.table_name)
                {
                    table_entry.bounds.height() > 1
                } else {
                    false
                }
            }
            RowRange::CurrentRow => false,
            RowRange::Rows(ranges) => {
                if ranges.len() > 1 {
                    return true;
                }
                false
            }
        }
    }

    pub fn intersect_rect(&self, rect: Rect, table_map: &TableMap) -> bool {
        let Some(table) = table_map.table(&self.table_name) else {
            return false;
        };
        table.bounds.intersects(rect)
    }

    pub fn to_largest_rect(&self, current_row: i64, table_map: &TableMap) -> Option<Rect> {
        let Some(table) = table_map.table(&self.table_name) else {
            return None;
        };
        let bounds = table.bounds;
        let mut min_x = bounds.max.x;
        let mut min_y = bounds.max.y;
        let mut max_x = bounds.min.x;
        let mut max_y = bounds.min.y;

        for range in self.col_ranges.iter() {
            match range {
                ColRange::Col(col) => {
                    let Some(col) = table.column_names.iter().position(|c| c == col) else {
                        return None;
                    };
                    min_x = min_x.min(col as i64);
                    max_x = max_x.max(col as i64);
                }
                ColRange::ColRange(col_range_start, col_range_end) => {
                    let Some(start) = table.column_names.iter().position(|c| c == col_range_start)
                    else {
                        return None;
                    };
                    let Some(end) = table.column_names.iter().position(|c| c == col_range_end)
                    else {
                        return None;
                    };
                    min_x = min_x.min(start as i64).min(end as i64);
                    max_x = max_x.max(start as i64).max(end as i64);
                }
                ColRange::ColumnToEnd(col) => {
                    let Some(start) = table.column_names.iter().position(|c| c == col) else {
                        return None;
                    };
                    min_x = min_x.min(start as i64);
                    max_x = max_x.max(table.column_names.len() as i64);
                }
            }
        }
        match &self.row_range {
            RowRange::All => {
                min_y = bounds.min.y;
                max_y = bounds.max.y;
            }
            RowRange::CurrentRow => {
                min_y = current_row;
                max_y = current_row;
            }
            RowRange::Rows(ranges) => {
                for range in ranges {
                    min_y = min_y.min(range.start.coord);
                    if range.end.coord == UNBOUNDED {
                        max_y = bounds.max.y;
                    } else {
                        max_y = max_y.max(range.end.coord);
                    }
                }
            }
        }
        Some(Rect::new(min_x, min_y, max_x, max_y))
    }

    // todo: finish this work if needed (not sure this is needed)
    // /// Returns the rectangle that the table reference covers. Returns None if
    // /// the table reference is not a rectangle (ie, if non-consecutive columns
    // /// or rows are selected).
    // pub fn to_rect(&self, current_row: i64, table_map: &TableMap) -> Option<Rect> {
    //     let Some(table) = table_map.table(&self.table_name) else {
    //         return None;
    //     };
    //     let bounds = table.bounds;

    //     let mut col_start = None;
    //     let mut col_end = None;

    //     for range in self.col_ranges.iter() {
    //         let (next_col_start, next_col_end) = match range {
    //             ColRange::Col(col) => {
    //                 let Some(col) = table.column_names.iter().position(|c| c == col) else {
    //                     return None;
    //                 };
    //                 (col, col)
    //             }
    //             ColRange::ColRange(col_range_start, col_range_end) => {
    //                 let Some(start) = table.column_names.iter().position(|c| c == col_range_start)
    //                 else {
    //                     return None;
    //                 };
    //                 let Some(end) = table.column_names.iter().position(|c| c == col_range_end)
    //                 else {
    //                     return None;
    //                 };
    //                 (start, end)
    //             }
    //             ColRange::ColumnToEnd(col) => {
    //                 let Some(start) = table.column_names.iter().position(|c| c == col) else {
    //                     return None;
    //                 };
    //                 (start, table.column_names.len() as i64)
    //             }
    //         };
    //     }
    //     let (y0, y1) = match &self.row_range {
    //         RowRange::All => (0, bounds.height() as i64),
    //         RowRange::CurrentRow => (current_row, current_row),
    //         RowRange::Rows(ranges) => {
    //             let mut y0 = 0;
    //             let mut y1 = 0;
    //             for range in ranges {
    //                 y0 += range.start.row();
    //                 y1 += range.end.row();
    //             }
    //             (y0, y1)
    //         }
    //     };
    //     if let (Some(col_start), Some(col_end)) = (col_start, col_end) {
    //         Some(Rect::new(
    //             bounds.min.x + col_start as i64,
    //             bounds.min.y + y0,
    //             bounds.min.x + col_end as i64,
    //             bounds.min.y + y1,
    //         ))
    //     } else {
    //         None
    //     }
    // }
}
