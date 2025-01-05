use crate::{
    a1::{A1Context, RefRangeBounds, UNBOUNDED},
    Pos, Rect,
};

use super::*;

impl TableRef {
    /// Returns any columns that have content in the TableRef that are between
    /// from and to.
    pub fn selected_cols(&self, from: i64, to: i64, context: &A1Context) -> Vec<i64> {
        let mut cols = vec![];

        if let Some(table) = context.try_table(&self.table_name) {
            match &self.col_range {
                ColRange::All => {
                    let start = table.bounds.min.x;
                    let end = table.bounds.max.x;
                    if start >= from && end <= to {
                        for x in start.max(from)..=end.min(to) {
                            cols.push(x);
                        }
                    }
                }
                ColRange::Col(col) => {
                    if let Some(col_index) = table.try_col_index(col) {
                        if col_index >= from && col_index <= to {
                            cols.push(col_index);
                        }
                    }
                }
                ColRange::ColRange(col_range_start, col_range_end) => {
                    if let Some((start, end)) = table.try_col_range(col_range_start, col_range_end)
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
            }
        }

        cols
    }

    /// Returns all columns that have content in the TableRef.
    pub fn selected_cols_finite(&self, context: &A1Context) -> Vec<i64> {
        // a table cannot be infinite, so we can just use UNBOUNDED
        self.selected_cols(1, UNBOUNDED, context)
    }

    pub fn selected_rows(&self, from: i64, to: i64, context: &A1Context) -> Vec<i64> {
        let mut rows = vec![];

        if let Some(table) = context.try_table(&self.table_name) {
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
                RowRange::Rows(range) => {
                    let start = range.start.coord.max(from);
                    let end = range.end.coord.min(to);
                    rows.extend(start..=end);
                }
            }
        }

        rows
    }

    pub fn selected_rows_finite(&self, context: &A1Context) -> Vec<i64> {
        // a table cannot be infinite, so we can just use UNBOUNDED
        self.selected_rows(1, UNBOUNDED, context)
    }

    pub fn is_multi_cursor(&self, context: &A1Context) -> bool {
        let Some(table_entry) = context.try_table(&self.table_name) else {
            return false;
        };
        let cols = match &self.col_range {
            ColRange::All => table_entry.bounds.width() as i64,
            ColRange::Col(_) => 1,
            ColRange::ColRange(start, end) => {
                let start = table_entry.try_col_index(start).unwrap_or(0);
                let end = table_entry.try_col_index(end).unwrap_or(0);
                end - start
            }
            ColRange::ColumnToEnd(col) => {
                table_entry.visible_columns.len() as i64
                    - table_entry.try_col_index(col).unwrap_or(0)
            }
        };

        if cols > 1 {
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
            RowRange::Rows(range) => range.start.coord != range.end.coord,
        }
    }

    pub fn to_largest_rect(&self, current_row: i64, context: &A1Context) -> Option<Rect> {
        let table = context.try_table(&self.table_name)?;
        let bounds = table.bounds;
        let mut min_x = bounds.max.x;
        let mut min_y = bounds.max.y;
        let mut max_x = bounds.min.x;
        let mut max_y = bounds.min.y;

        match &self.col_range {
            ColRange::All => {
                min_x = bounds.min.x;
                max_x = bounds.max.x;
            }
            ColRange::Col(col) => {
                let col = table.visible_columns.iter().position(|c| c == col)?;
                min_x = min_x.min(bounds.min.x + col as i64);
                max_x = max_x.max(bounds.min.x + col as i64);
            }
            ColRange::ColRange(col_range_start, col_range_end) => {
                let start = table
                    .visible_columns
                    .iter()
                    .position(|c| c == col_range_start)?;
                let end = table
                    .visible_columns
                    .iter()
                    .position(|c| c == col_range_end)?;
                min_x = min_x
                    .min(bounds.min.x + start as i64)
                    .min(bounds.min.x + end as i64);
                max_x = max_x
                    .max(bounds.min.x + start as i64)
                    .max(bounds.min.x + end as i64);
            }
            ColRange::ColumnToEnd(col) => {
                let start = table.visible_columns.iter().position(|c| c == col)?;
                min_x = min_x.min(bounds.min.x + start as i64);
                max_x = min_x.max(bounds.min.x + table.visible_columns.len() as i64);
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
            RowRange::Rows(range) => {
                min_y = min_y.min(range.start.coord);
                if range.end.coord == UNBOUNDED {
                    max_y = bounds.max.y;
                } else {
                    max_y = max_y.max(range.end.coord);
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
    ) -> Option<RefRangeBounds> {
        let Some(table) = context.try_table(&self.table_name) else {
            // the table may no longer exist
            return None;
        };

        let (y_start, y_end) = self.row_range.to_rows(current_row, table);
        match &self.col_range {
            ColRange::All => {
                let range = RefRangeBounds::new_relative(
                    table.bounds.min.x,
                    y_start,
                    table.bounds.max.x,
                    y_end,
                );
                Some(range)
            }
            ColRange::Col(col) => table
                .try_col_index(col)
                .map(|col| RefRangeBounds::new_relative(col, y_start, col, y_end)),
            ColRange::ColRange(col_range_start, col_range_end) => {
                if let Some((start, end)) = table.try_col_range(col_range_start, col_range_end) {
                    Some(RefRangeBounds::new_relative(start, y_start, end, y_end))
                } else {
                    None
                }
            }
            ColRange::ColumnToEnd(col) => {
                if let Some((start, end)) = table.try_col_range_to_end(col) {
                    Some(RefRangeBounds::new_relative(start, y_start, end, y_end))
                } else {
                    None
                }
            }
        }
    }

    /// Returns true if the table ref may be two-dimensional--ie, if it has
    /// unbounded ranges that may change.
    pub fn is_two_dimensional(&self) -> bool {
        match &self.col_range {
            ColRange::All => true,
            ColRange::Col(_) => false,
            ColRange::ColRange(start, end) => start != end,
            ColRange::ColumnToEnd(_) => true,
        }
    }

    /// Tries to convert the TableRef to a Pos.
    pub fn try_to_pos(&self, context: &A1Context) -> Option<Pos> {
        let range = self.convert_to_ref_range_bounds(0, context)?;
        range.try_to_pos()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    fn setup_test_context() -> A1Context {
        let mut context = A1Context::default();
        context
            .table_map
            .test_insert("test_table", &["A", "B", "C"], None, Rect::test_a1("A1:C3"));

        context
    }

    fn setup_test_context_with_hidden_columns() -> A1Context {
        let mut context = A1Context::default();
        context.table_map.test_insert(
            "test_table",
            &["A", "C"],
            Some(&["A", "B", "C"]),
            Rect::test_a1("A1:C3"),
        );

        context
    }

    #[test]
    fn test_selected_cols() {
        let context = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        let cols = table_ref.selected_cols(1, 3, &context);
        assert_eq!(cols, vec![2]);
    }

    #[test]
    fn test_selected_cols_hidden_columns() {
        let context = setup_test_context_with_hidden_columns();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("C".to_string()),
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols(1, 3, &context);

        // C should be 2 since B is hidden
        assert_eq!(cols, vec![2]);
    }

    #[test]
    fn test_selected_rows() {
        let context = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            row_range: RowRange::Rows(RowRangeEntry::new_rel(1, 2)),
            data: true,
            headers: false,
            totals: false,
        };

        let rows = table_ref.selected_rows(1, 3, &context);
        assert_eq!(rows, vec![1, 2]);
    }

    #[test]
    fn test_is_multi_cursor() {
        let context = setup_test_context();

        // Single column, single row
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            row_range: RowRange::CurrentRow,
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.is_multi_cursor(&context));

        // Multiple columns
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            row_range: RowRange::CurrentRow,
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.is_multi_cursor(&context));

        // Multiple rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            row_range: RowRange::Rows(RowRangeEntry::new_rel(0, 1)),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            row_range: RowRange::Rows(RowRangeEntry::new_rel(1, 2)),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));

        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            row_range: RowRange::Rows(RowRangeEntry::new_rel(1, 2)),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));
    }

    #[test]
    fn test_to_largest_rect() {
        let context = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "B".to_string()),
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
        let mut context = A1Context::default();
        context
            .table_map
            .test_insert("test_table", &["A", "B", "C"], None, Rect::test_a1("A1:C3"));

        // Test case 1: Single column with all rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(1, &context);
        assert_eq!(ranges, Some(RefRangeBounds::test_a1("B1:B3")));

        // Test case 2: Column range with specific rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "C".to_string()),
            row_range: RowRange::Rows(RowRangeEntry::new_rel(1, 2)),
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(1, &context);
        assert_eq!(ranges, Some(RefRangeBounds::new_relative(1, 1, 3, 2)));

        // Test case 3: Column to end
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColumnToEnd("B".to_string()),
            row_range: RowRange::CurrentRow,
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(2, &context);
        assert_eq!(ranges, Some(RefRangeBounds::new_relative(2, 2, 3, 2)));
    }

    #[test]
    fn test_is_two_dimensional() {
        // Single column is not two-dimensional
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.is_two_dimensional());

        // Column range with different start and end is two-dimensional
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "C".to_string()),
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_two_dimensional());

        // Column to end is two-dimensional
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColumnToEnd("B".to_string()),
            row_range: RowRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_two_dimensional());
    }

    #[test]
    fn test_try_to_pos() {
        let context = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            row_range: RowRange::Rows(RowRangeEntry::new_rel(1, 1)),
            data: true,
            headers: false,
            totals: false,
        };
        assert_eq!(table_ref.try_to_pos(&context).unwrap(), pos![B1]);
    }
}
