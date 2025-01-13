//! Querying a TableRef.

use crate::{
    a1::{A1Context, UNBOUNDED},
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
                        let col_index = col_index + table.bounds.min.x;
                        if col_index >= from && col_index <= to {
                            cols.push(col_index);
                        }
                    }
                }
                ColRange::ColRange(col_range_start, col_range_end) => {
                    if let Some((start, end)) = table.try_col_range(col_range_start, col_range_end)
                    {
                        let start = start + table.bounds.min.x;
                        let end = end + table.bounds.min.x;
                        if start >= from && end <= to {
                            for x in start.max(from)..=end.min(to) {
                                cols.push(x);
                            }
                        }
                    }
                }
                ColRange::ColToEnd(col) => {
                    if let Some((start, end)) = table.try_col_range_to_end(col) {
                        let start = start + table.bounds.min.x;
                        let end = end + table.bounds.min.x;
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
            let min_y = bounds.min.y + if table.show_headers { 1 } else { 0 };
            if min_y > to || bounds.max.y < from {
                return rows;
            }
            let start = min_y.max(from);
            let end = bounds.max.y.min(to);
            rows.extend(start..=end);
        }

        rows
    }

    pub fn selected_rows_finite(&self, context: &A1Context) -> Vec<i64> {
        // a table cannot be infinite, so we can just use UNBOUNDED
        self.selected_rows(1, UNBOUNDED, context)
    }

    /// Whether the TableRef has more than one cell.
    pub fn is_multi_cursor(&self, context: &A1Context) -> bool {
        let Some(table_entry) = context.try_table(&self.table_name) else {
            return false;
        };
        if self.headers && self.data {
            return true;
        }
        match &self.col_range {
            ColRange::Col(_) => (),
            ColRange::All => {
                if table_entry.bounds.width() > 1 {
                    return true;
                }
            }
            ColRange::ColRange(start, end) => {
                let start = table_entry.try_col_index(start).unwrap_or(0);
                let end = table_entry.try_col_index(end).unwrap_or(0);
                if end - start != 0 {
                    return true;
                }
            }
            ColRange::ColToEnd(col) => {
                if table_entry.visible_columns.len() as i64
                    - table_entry.try_col_index(col).unwrap_or(0)
                    != 0
                {
                    return true;
                }
            }
        };

        table_entry.bounds.height() != if table_entry.show_headers { 2 } else { 1 }
    }

    pub fn to_largest_rect(&self, context: &A1Context) -> Option<Rect> {
        let table = context.try_table(&self.table_name)?;
        let bounds = table.bounds;
        let mut min_x = bounds.max.x;
        let mut max_x = bounds.min.x;

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
            ColRange::ColToEnd(col) => {
                let start = table.visible_columns.iter().position(|c| c == col)?;
                min_x = min_x.min(bounds.min.x + start as i64);
                max_x = min_x.max(bounds.min.x + table.visible_columns.len() as i64);
            }
        }

        let min_y = bounds.min.y + if table.show_headers { 1 } else { 0 };
        let max_y = bounds.max.y;
        Some(Rect::new(min_x, min_y, max_x, max_y))
    }

    /// Returns the cursor position from the last range.
    pub fn cursor_pos_from_last_range(&self, context: &A1Context) -> Pos {
        if let Some(table) = context.try_table(&self.table_name) {
            let x = table.bounds.min.x;
            let y = table.bounds.min.y
                + if self.headers || !table.show_headers || table.bounds.height() == 1 {
                    0
                } else {
                    1
                };
            Pos { x, y }
        } else {
            dbgjs!("Expected to find table in cursor_pos_from_last_range");
            Pos { x: 1, y: 1 }
        }
    }

    /// Returns true if the table ref may be two-dimensional--ie, if it has
    /// unbounded ranges that may change.
    pub fn is_two_dimensional(&self) -> bool {
        match &self.col_range {
            ColRange::All => true,
            ColRange::Col(_) => false,
            ColRange::ColRange(start, end) => start != end,
            ColRange::ColToEnd(_) => true,
        }
    }

    /// Tries to convert the TableRef to a Pos.
    pub fn try_to_pos(&self, context: &A1Context) -> Option<Pos> {
        let range = self.convert_to_ref_range_bounds(false, context)?;
        range.try_to_pos()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::a1::RefRangeBounds;

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
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols(1, 3, &context);

        // C should be 2 since B is hidden
        assert_eq!(cols, vec![2]);
    }

    #[test]
    fn test_is_multi_cursor() {
        let mut context = A1Context::default();
        // the context is A1:B2 because show_headers is true
        context
            .table_map
            .test_insert("test_table", &["A", "B"], None, Rect::test_a1("A1:B2"));

        // One column, one row--note, table has headers, but they're not selected
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.is_multi_cursor(&context));

        context
            .table_map
            .test_insert("test_table", &["A", "B"], None, Rect::test_a1("A1:B2"));

        // Two columns, one row--note, table has headers, but they're not selected
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));

        // One column, one row, and headers are selected
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            data: true,
            headers: true,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));

        // One column, one row, and only headers are selected
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            data: false,
            headers: true,
            totals: false,
        };
        assert!(!table_ref.is_multi_cursor(&context));
    }

    #[test]
    fn test_to_largest_rect() {
        let context = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        let rect = table_ref.to_largest_rect(&context);
        assert_eq!(rect.unwrap(), Rect::test_a1("A2:B3"));
    }

    #[test]
    fn test_convert_to_ref_range_bounds() {
        let mut context = A1Context::default();
        context
            .table_map
            .test_insert("test_table", &["A", "B", "C"], None, Rect::test_a1("A1:C3"));

        // Single column with all rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(false, &context);
        assert_eq!(ranges, Some(RefRangeBounds::test_a1("B2:B3")));

        // Column to end
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(false, &context);
        assert_eq!(ranges, Some(RefRangeBounds::test_a1("B2:C3")));
    }

    #[test]
    fn test_is_two_dimensional() {
        // Single column is not two-dimensional
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.is_two_dimensional());

        // Column range with different start and end is two-dimensional
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "C".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_two_dimensional());

        // Column to end is two-dimensional
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("B".to_string()),
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
            data: true,
            headers: false,
            totals: false,
        };
        assert_eq!(table_ref.try_to_pos(&context), None);
    }

    #[test]
    fn test_cursor_pos_from_last_range() {
        let mut context = setup_test_context();
        let mut table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert_eq!(table_ref.cursor_pos_from_last_range(&context), pos![A2]);

        context.table_map.tables.first_mut().unwrap().show_headers = false;
        assert_eq!(table_ref.cursor_pos_from_last_range(&context), pos![A1]);

        context.table_map.tables.first_mut().unwrap().show_headers = true;
        table_ref.headers = true;
        assert_eq!(table_ref.cursor_pos_from_last_range(&context), pos![A1]);
    }
}
