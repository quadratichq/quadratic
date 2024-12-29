use crate::{
    a1::{A1Context, UNBOUNDED},
    grid::SheetId,
    Pos, Rect,
};

use super::*;

impl TableRef {
    pub fn selected_cols(
        &self,
        from: i64,
        to: i64,
        sheet_id: SheetId,
        context: &A1Context,
    ) -> Vec<i64> {
        let mut cols = vec![];

        context.tables().for_each(|table| {
            if table.sheet_id == sheet_id && table.table_name == self.table_name {
                cols.extend(table.bounds.cols_range(from, to));
            }
        });

        cols
    }

    pub fn selected_rows(
        &self,
        from: i64,
        to: i64,
        sheet_id: SheetId,
        context: &A1Context,
    ) -> Vec<i64> {
        let mut rows = vec![];

        context.tables().for_each(|table| {
            if table.sheet_id == sheet_id && table.table_name == self.table_name {
                rows.extend(table.bounds.rows_range(from, to));
            }
        });

        rows
    }

    pub fn is_multi_cursor(&self, context: &A1Context) -> bool {
        // if more than one column, then it's a multi-cursor
        if self.col_ranges.len() > 1 {
            return true;
        }

        // If just the last row and one column, then it's not a multi-cursor
        match &self.row_range {
            RowRange::All => {
                if let Some(table_entry) = context.try_table(&self.table_name) {
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

    pub fn intersect_rect(&self, rect: Rect, context: &A1Context) -> bool {
        let Some(table) = context.try_table(&self.table_name) else {
            return false;
        };
        table.bounds.intersects(rect)
    }

    pub fn to_largest_rect(&self, current_row: i64, context: &A1Context) -> Option<Rect> {
        let Some(table) = context.try_table(&self.table_name) else {
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

    /// Returns the cursor position from the last range.
    pub fn cursor_pos_from_last_range(&self, context: &A1Context) -> Pos {
        if let Some(table) = context.try_table(&self.table_name) {
            let x = table.bounds.min.x;
            let y = table.bounds.min.y;
            Pos { x, y }
        } else {
            dbgjs!("Expected to find table in cursor_pos_from_last_range");
            Pos { x: 1, y: 1 }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    fn setup_test_context() -> (A1Context, SheetId) {
        let sheet_id = SheetId::test();

        let mut context = A1Context::default();
        context.table_map.test_insert(
            sheet_id,
            "test_table",
            &["A", "B", "C"],
            Rect::test_a1("A1:C3"),
        );

        (context, sheet_id)
    }

    #[test]
    fn test_selected_cols() {
        let (context, sheet_id) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::Col("B".to_string())],
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        let cols = table_ref.selected_cols(1, 3, sheet_id, &context);
        assert_eq!(cols, vec![2]);
    }

    #[test]
    fn test_selected_rows() {
        let (context, sheet_id) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::Col("A".to_string())],
            row_range: RowRange::Rows(vec![RowRangeEntry::new_rel(1, 2)]),
            data: true,
            headers: false,
            totals: false,
        };

        let rows = table_ref.selected_rows(1, 3, sheet_id, &context);
        assert_eq!(rows, vec![1, 2]);
    }

    // #[test]
    // fn test_is_multi_cursor() {
    //     let (context, _) = setup_test_context();

    //     // Single column, single row
    //     let table_ref = TableRef {
    //         table_name: "test_table".to_string(),
    //         col_ranges: vec![ColRange::Col("A".to_string())],
    //         row_range: RowRange::CurrentRow,
    //     };
    //     assert!(!table_ref.is_multi_cursor(&context));

    //     // Multiple columns
    //     let table_ref = TableRef {
    //         table_name: "test_table".to_string(),
    //         col_ranges: vec![
    //             ColRange::Col("A".to_string()),
    //             ColRange::Col("B".to_string()),
    //         ],
    //         row_range: RowRange::CurrentRow,
    //     };
    //     assert!(table_ref.is_multi_cursor(&context));

    //     // Multiple rows
    //     let table_ref = TableRef {
    //         table_name: "test_table".to_string(),
    //         col_ranges: vec![ColRange::Col("A".to_string())],
    //         row_range: RowRange::Rows(vec![
    //             RowRangeEntry {
    //                 start: RowRangeValue { coord: 0 },
    //                 end: RowRangeValue { coord: 1 },
    //             },
    //             RowRangeEntry {
    //                 start: RowRangeValue { coord: 2 },
    //                 end: RowRangeValue { coord: 2 },
    //             },
    //         ]),
    //     };
    //     assert!(table_ref.is_multi_cursor(&context));
    // }

    // #[test]
    // fn test_intersect_rect() {
    //     let (context, _) = setup_test_context();
    //     let table_ref = TableRef {
    //         table_name: "test_table".to_string(),
    //         col_ranges: vec![ColRange::Col("A".to_string())],
    //         row_range: RowRange::All,
    //     };

    //     // Intersecting rectangle
    //     assert!(table_ref.intersect_rect(Rect::new(0, 0, 1, 1), &context));

    //     // Non-intersecting rectangle
    //     assert!(!table_ref.intersect_rect(Rect::new(10, 10, 11, 11), &context));
    // }

    // #[test]
    // fn test_to_largest_rect() {
    //     let (context, _) = setup_test_context();
    //     let table_ref = TableRef {
    //         table_name: "test_table".to_string(),
    //         col_ranges: vec![ColRange::ColRange("A".to_string(), "B".to_string())],
    //         row_range: RowRange::All,
    //     };

    //     let rect = table_ref.to_largest_rect(0, &context);
    //     assert!(rect.is_some());
    //     let rect = rect.unwrap();
    //     assert_eq!(rect.min.x, 0); // Column A
    //     assert_eq!(rect.max.x, 1); // Column B
    //     assert_eq!(rect.min.y, 0); // First row
    //     assert_eq!(rect.max.y, 2); // Last row
    // }
}
