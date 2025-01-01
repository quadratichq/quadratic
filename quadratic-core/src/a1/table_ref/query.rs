use crate::{
    a1::{A1Context, CellRefRange, RefRangeBounds, UNBOUNDED},
    grid::SheetId,
    Pos, Rect,
};

use super::*;

impl TableRef {
    /// Returns any columns that have content in the TableRef that are between
    /// from and to.
    pub fn selected_cols(
        &self,
        from: i64,
        to: i64,
        sheet_id: SheetId,
        context: &A1Context,
    ) -> Vec<i64> {
        let mut cols = vec![];

        if let Some(table) = context.try_table(&self.table_name) {
            if sheet_id == table.sheet_id {
                self.col_ranges
                    .iter()
                    .for_each(|col_range| match col_range {
                        ColRange::Col(col) => {
                            if let Some(col_index) = table.try_col_index(col) {
                                if col_index >= from && col_index <= to {
                                    cols.push(col_index);
                                }
                            }
                        }
                        ColRange::ColRange(col_range_start, col_range_end) => {
                            if let Some((start, end)) =
                                table.try_col_range(col_range_start, col_range_end)
                            {
                                if start >= from && end <= to {
                                    for x in start.max(from)..=end.min(to) {
                                        cols.push(x);
                                    }
                                }
                            }
                        }
                        ColRange::ColumnToEnd(col) => {
                            if let Some((start, end)) = table.try_col_range_to_end(col) {
                                if start >= from && end <= to {
                                    for x in start.max(from)..=end.min(to) {
                                        cols.push(x);
                                    }
                                }
                            }
                        }
                    });
            }
        }

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

        if let Some(table) = context.try_table(&self.table_name) {
            if sheet_id == table.sheet_id {
                let bounds = table.bounds;
                if bounds.min.y > to || bounds.max.y < from {
                    return rows;
                }
                match &self.row_range {
                    RowRange::All => {
                        let start = bounds.min.y.max(from);
                        let end = bounds.max.y.min(to);
                        rows.extend(start..=end);
                    }
                    RowRange::CurrentRow => {
                        // this one doesn't make sense in this context
                    }
                    RowRange::Rows(ranges) => {
                        for range in ranges {
                            let start = range.start.coord.max(from);
                            let end = range.end.coord.min(to);
                            rows.extend(start..=end);
                        }
                    }
                }
            }
        }

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
                    let Some(col) = table.visible_columns.iter().position(|c| c == col) else {
                        return None;
                    };
                    min_x = min_x.min(bounds.min.x + col as i64);
                    max_x = max_x.max(bounds.min.x + col as i64);
                }
                ColRange::ColRange(col_range_start, col_range_end) => {
                    let Some(start) = table
                        .visible_columns
                        .iter()
                        .position(|c| c == col_range_start)
                    else {
                        return None;
                    };
                    let Some(end) = table
                        .visible_columns
                        .iter()
                        .position(|c| c == col_range_end)
                    else {
                        return None;
                    };
                    min_x = min_x
                        .min(bounds.min.x + start as i64)
                        .min(bounds.min.x + end as i64);
                    max_x = max_x
                        .max(bounds.min.x + start as i64)
                        .max(bounds.min.x + end as i64);
                }
                ColRange::ColumnToEnd(col) => {
                    let Some(start) = table.visible_columns.iter().position(|c| c == col) else {
                        return None;
                    };
                    min_x = min_x.min(bounds.min.x + start as i64);
                    max_x = min_x.max(bounds.min.x + table.visible_columns.len() as i64);
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

    /// Converts the table ref to a list of CellRefRange::RefRangeBounds
    pub fn convert_to_ref_range_bounds(
        &self,
        current_row: i64,
        context: &A1Context,
    ) -> Vec<CellRefRange> {
        let Some(table) = context.try_table(&self.table_name) else {
            // the table may no longer exist
            return vec![];
        };

        let mut ranges = vec![];
        let y_ranges = self.row_range.to_rows(current_row, &table);

        for range in self.col_ranges.iter() {
            match range {
                ColRange::Col(col) => {
                    if let Some(col) = table.try_col_index(col) {
                        for (y_start, y_end) in y_ranges.iter() {
                            ranges.push(CellRefRange::Sheet {
                                range: RefRangeBounds::new_relative(
                                    col as i64, *y_start, col as i64, *y_end,
                                ),
                            });
                        }
                    }
                }
                ColRange::ColRange(col_range_start, col_range_end) => {
                    if let Some((start, end)) = table.try_col_range(col_range_start, col_range_end)
                    {
                        for (y_start, y_end) in y_ranges.iter() {
                            ranges.push(CellRefRange::Sheet {
                                range: RefRangeBounds::new_relative(start, *y_start, end, *y_end),
                            });
                        }
                    }
                }
                ColRange::ColumnToEnd(col) => {
                    if let Some((start, end)) = table.try_col_range_to_end(col) {
                        for (y_start, y_end) in y_ranges.iter() {
                            ranges.push(CellRefRange::Sheet {
                                range: RefRangeBounds::new_relative(
                                    start as i64,
                                    *y_start,
                                    end,
                                    *y_end,
                                ),
                            });
                        }
                    }
                }
            }
        }
        ranges
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::a1::CellRefCoord;

    use super::*;

    fn setup_test_context() -> (A1Context, SheetId) {
        let sheet_id = SheetId::test();

        let mut context = A1Context::default();
        context.table_map.test_insert(
            sheet_id,
            "test_table",
            &["A", "B", "C"],
            None,
            Rect::test_a1("A1:C3"),
        );

        (context, sheet_id)
    }

    fn setup_test_context_with_hidden_columns() -> (A1Context, SheetId) {
        let sheet_id = SheetId::test();

        let mut context = A1Context::default();
        context.table_map.test_insert(
            sheet_id,
            "test_table",
            &["A", "C"],
            Some(&["A", "B", "C"]),
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
    fn test_selected_cols_hidden_columns() {
        let (context, sheet_id) = setup_test_context_with_hidden_columns();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::Col("C".to_string())],
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols(1, 3, sheet_id, &context);

        // C should be 2 since B is hidden
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

    #[test]
    fn test_is_multi_cursor() {
        let (context, _) = setup_test_context();

        // Single column, single row
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::Col("A".to_string())],
            row_range: RowRange::CurrentRow,
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.is_multi_cursor(&context));

        // Multiple columns
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![
                ColRange::Col("A".to_string()),
                ColRange::Col("B".to_string()),
            ],
            row_range: RowRange::CurrentRow,
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));

        // Multiple rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::Col("A".to_string())],
            row_range: RowRange::Rows(vec![
                RowRangeEntry {
                    start: CellRefCoord::new_rel(0),
                    end: CellRefCoord::new_rel(1),
                },
                RowRangeEntry {
                    start: CellRefCoord::new_rel(2),
                    end: CellRefCoord::new_rel(2),
                },
            ]),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));
    }

    #[test]
    fn test_to_largest_rect() {
        let (context, _) = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::ColRange("A".to_string(), "B".to_string())],
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        let rect = table_ref.to_largest_rect(1, &context);
        assert_eq!(rect.unwrap(), Rect::test_a1("A1:B3"));
    }

    #[test]
    fn test_convert_to_ref_range_bounds() {
        let sheet_id = SheetId::test();

        let mut context = A1Context::default();
        context.table_map.test_insert(
            sheet_id,
            "test_table",
            &["A", "B", "C"],
            None,
            Rect::test_a1("A1:C3"),
        );

        // Test case 1: Single column with all rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::Col("B".to_string())],
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(1, &context);
        assert_eq!(
            ranges,
            vec![CellRefRange::Sheet {
                range: RefRangeBounds::test_a1("B1:B3")
            }]
        );

        // Test case 2: Column range with specific rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::ColRange("A".to_string(), "C".to_string())],
            row_range: RowRange::Rows(vec![RowRangeEntry::new_rel(1, 2)]),
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(1, &context);
        assert_eq!(
            ranges,
            vec![CellRefRange::Sheet {
                range: RefRangeBounds::new_relative(1, 1, 3, 2)
            }]
        );

        // Test case 3: Column to end
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_ranges: vec![ColRange::ColumnToEnd("B".to_string())],
            row_range: RowRange::CurrentRow,
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(2, &context);
        assert_eq!(
            ranges,
            vec![CellRefRange::Sheet {
                range: RefRangeBounds::new_relative(2, 2, 3, 2)
            }]
        );
    }
}
