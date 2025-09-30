//! Querying a TableRef.

use crate::{
    Pos, Rect,
    a1::{A1Context, UNBOUNDED},
};

use super::*;

impl TableRef {
    /// Returns any columns that have content in the TableRef that are between
    /// from and to.
    pub(crate) fn selected_cols(&self, from: i64, to: i64, a1_context: &A1Context) -> Vec<i64> {
        let mut cols = vec![];

        if let Some(table) = a1_context.try_table(&self.table_name) {
            match &self.col_range {
                ColRange::All => {
                    let start = table.bounds.min.x;
                    let end = table.bounds.max.x;
                    for x in start.max(from)..=end.min(to) {
                        cols.push(x);
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
                        for x in start.max(from)..=end.min(to) {
                            cols.push(x);
                        }
                    }
                }
                ColRange::ColToEnd(col) => {
                    if let Some((start, end)) = table.try_col_range_to_end(col) {
                        let start = start + table.bounds.min.x;
                        let end = end + table.bounds.min.x;
                        for x in start.max(from)..=end.min(to) {
                            cols.push(x);
                        }
                    }
                }
            }
        }
        cols
    }

    /// Returns all columns that have content in the TableRef.
    pub(crate) fn selected_cols_finite(&self, a1_context: &A1Context) -> Vec<i64> {
        // a table cannot be infinite, so we can just use UNBOUNDED
        self.selected_cols(1, UNBOUNDED, a1_context)
    }

    pub(crate) fn selected_rows(&self, from: i64, to: i64, a1_context: &A1Context) -> Vec<i64> {
        let mut rows = vec![];

        if let Some(table) = a1_context.try_table(&self.table_name) {
            let bounds = table.bounds;
            if self.headers && !self.data {
                rows.push(bounds.min.y + (if table.show_name { 1 } else { 0 }));
            } else {
                let min_y = bounds.min.y + table.y_adjustment(false);
                if min_y > to || bounds.max.y < from {
                    return rows;
                }
                let start = min_y.max(from);
                let end = bounds.max.y.min(to);
                rows.extend(start..=end);
            }
        }

        rows
    }

    pub(crate) fn selected_rows_finite(&self, a1_context: &A1Context) -> Vec<i64> {
        // a table cannot be infinite, so we can just use UNBOUNDED
        self.selected_rows(1, UNBOUNDED, a1_context)
    }

    /// Whether the TableRef has more than one cell.
    pub(crate) fn is_multi_cursor(&self, a1_context: &A1Context) -> bool {
        let Some(table_entry) = a1_context.try_table(&self.table_name) else {
            return false;
        };
        if self.headers && self.data {
            return true;
        }
        if self.headers && !self.data && matches!(self.col_range, ColRange::Col(_)) {
            return false;
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

        table_entry.bounds.height()
            != 1 + if table_entry.show_name { 1 } else { 0 }
                + if table_entry.show_columns { 1 } else { 0 }
    }

    pub(crate) fn to_largest_rect(&self, a1_context: &A1Context) -> Option<Rect> {
        let table = a1_context.try_table(&self.table_name)?;
        let bounds = table.bounds;
        let mut min_x = bounds.max.x;
        let mut max_x = bounds.min.x;
        let mut min_y = bounds.min.y;
        let max_y = match (self.headers, self.data) {
            (true, false) => {
                if !table.show_columns {
                    return None;
                } else {
                    bounds.min.y + (if table.show_name { 1 } else { 0 })
                }
            }
            _ => bounds.max.y,
        };

        match &self.col_range {
            ColRange::All => {
                min_x = bounds.min.x;
                max_x = bounds.max.x;
            }
            ColRange::Col(col) => {
                let col = table.visible_columns.iter().position(|c| c == col)?;
                min_x = min_x.min(bounds.min.x + col as i64);
                max_x = max_x.max(bounds.min.x + col as i64);
                min_y += if table.show_name { 1 } else { 0 };
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
                min_y += if table.show_name { 1 } else { 0 };
            }
            ColRange::ColToEnd(col) => {
                let start = table.visible_columns.iter().position(|c| c == col)?;
                min_x = min_x.min(bounds.min.x + start as i64);
                max_x = min_x.max(bounds.min.x + table.visible_columns.len() as i64 - 1);
                min_y += if table.show_name { 1 } else { 0 };
            }
        }

        Some(Rect::new(min_x, min_y, max_x, max_y))
    }

    /// Returns the cursor position from the last range.
    pub(crate) fn cursor_pos_from_last_range(&self, a1_context: &A1Context) -> Pos {
        if let Some(table) = a1_context.try_table(&self.table_name) {
            let x = table.bounds.min.x;
            let y = table.bounds.min.y
                + if self.headers
                    || (!table.show_name && !table.show_columns)
                    || table.bounds.height() == 1
                {
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
    pub(crate) fn is_two_dimensional(&self) -> bool {
        match &self.col_range {
            ColRange::All => true,
            ColRange::Col(_) => false,
            ColRange::ColRange(start, end) => start != end,
            ColRange::ColToEnd(_) => true,
        }
    }

    /// Tries to convert the TableRef to a Pos.
    pub(crate) fn try_to_pos(&self, a1_context: &A1Context) -> Option<Pos> {
        let range = self.convert_to_ref_range_bounds(false, a1_context, false, false)?;
        range.try_to_pos()
    }

    /// Returns the columns that are selected in the table.
    pub(crate) fn table_column_selection(
        &self,
        table_name: &str,
        a1_context: &A1Context,
    ) -> Option<Vec<i64>> {
        let mut cols = vec![];
        if table_name != self.table_name {
            return None;
        }
        let table = a1_context.try_table(&self.table_name)?;
        if !table.show_columns {
            return None;
        }

        match &self.col_range {
            ColRange::All => {
                for col in 0..table.visible_columns.len() as i64 {
                    cols.push(col);
                }
            }
            ColRange::Col(col) => {
                if let Some(col_index) = table.try_col_index(col) {
                    cols.push(col_index);
                } else {
                    return None;
                }
            }
            ColRange::ColRange(start, end) => {
                if let (Some(start), Some(end)) =
                    (table.try_col_index(start), table.try_col_index(end))
                {
                    for col in start.min(end)..=start.max(end) {
                        cols.push(col);
                    }
                } else {
                    return None;
                }
            }
            ColRange::ColToEnd(col) => {
                if let Some(start) = table.try_col_index(col) {
                    for col in start..table.visible_columns.len() as i64 {
                        cols.push(col);
                    }
                } else {
                    return None;
                }
            }
        }
        Some(cols)
    }
}

#[cfg(test)]
mod tests {
    use crate::{a1::RefRangeBounds, grid::CodeCellLanguage};

    use super::*;

    fn setup_test_context() -> A1Context {
        let mut context = A1Context::default();
        context.table_map.test_insert(
            "test_table",
            &["A", "B", "C"],
            None,
            Rect::test_a1("A1:C3"),
            CodeCellLanguage::Import,
        );
        context
    }

    fn setup_test_context_with_hidden_columns() -> A1Context {
        let mut context = A1Context::default();
        context.table_map.test_insert(
            "test_table",
            &["A", "C"],
            Some(&["A", "B", "C"]),
            Rect::test_a1("A1:C3"),
            CodeCellLanguage::Import,
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
        context.table_map.test_insert(
            "test_table",
            &["A", "B"],
            None,
            Rect::test_a1("A1:B3"),
            CodeCellLanguage::Import,
        );

        // One column, one row--note, table has headers, but they're not selected
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("A".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(!table_ref.is_multi_cursor(&context));

        context.table_map.test_insert(
            "test_table",
            &["A", "B"],
            None,
            Rect::test_a1("A1:B3"),
            CodeCellLanguage::Import,
        );

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
        context.table_map.test_insert(
            "test_table",
            &["A", "B", "C"],
            None,
            Rect::test_a1("A1:C4"),
            CodeCellLanguage::Import,
        );

        // Single column with all rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(false, &context, false, false);
        assert_eq!(ranges, Some(RefRangeBounds::test_a1("B3:B4")));

        // Column to end
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };

        let ranges = table_ref.convert_to_ref_range_bounds(false, &context, false, false);
        assert_eq!(ranges, Some(RefRangeBounds::test_a1("B3:C4")));
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
        assert_eq!(table_ref.try_to_pos(&context), Some(pos![B3]));
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

        let mut table = context.table_map.remove("test_table").unwrap();
        table.show_name = false;
        table.show_columns = false;
        context.table_map.insert(table);
        assert_eq!(table_ref.cursor_pos_from_last_range(&context), pos![A1]);

        let mut table = context.table_map.remove("test_table").unwrap();
        table.show_name = true;
        table.show_columns = true;
        table_ref.headers = true;
        context.table_map.insert(table);
        assert_eq!(table_ref.cursor_pos_from_last_range(&context), pos![A1]);
    }

    #[test]
    fn test_table_column_selection() {
        let context = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };

        // Test all columns
        let cols = table_ref.table_column_selection("test_table", &context);
        assert_eq!(cols, Some(vec![0, 1, 2]));

        // Test single column
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            data: true,
            headers: true,
            totals: false,
        };
        let cols = table_ref.table_column_selection("test_table", &context);
        assert_eq!(cols, Some(vec![1]));

        // Test column range
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "B".to_string()),
            data: true,
            headers: true,
            totals: false,
        };
        let cols = table_ref.table_column_selection("test_table", &context);
        assert_eq!(cols, Some(vec![0, 1]));

        // Test reversed column range
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("B".to_string(), "A".to_string()),
            data: true,
            headers: true,
            totals: false,
        };
        let cols = table_ref.table_column_selection("test_table", &context);
        assert_eq!(cols, Some(vec![0, 1]));

        // Test column to end
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("B".to_string()),
            data: true,
            headers: true,
            totals: false,
        };
        let cols = table_ref.table_column_selection("test_table", &context);
        assert_eq!(cols, Some(vec![1, 2]));

        // Test with different table name (should return empty vec)
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };
        let cols = table_ref.table_column_selection("different_table", &context);
        assert_eq!(cols, None);
    }

    #[test]
    fn test_selected_cols_finite() {
        let context = setup_test_context();

        // Test All columns
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols_finite(&context);
        assert_eq!(cols, vec![1, 2, 3]);

        // Test single column
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols_finite(&context);
        assert_eq!(cols, vec![2]);

        // Test column range
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols_finite(&context);
        assert_eq!(cols, vec![1, 2]);
    }

    #[test]
    fn test_selected_rows() {
        let context = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };

        // Test normal range
        let rows = table_ref.selected_rows(1, 5, &context);
        assert_eq!(rows, vec![3]);

        // Test headers only
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: false,
            headers: true,
            totals: false,
        };
        let rows = table_ref.selected_rows(1, 5, &context);
        assert_eq!(rows, vec![2]);

        // Test out of bounds range
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        let rows = table_ref.selected_rows(10, 15, &context);
        assert_eq!(rows, Vec::<i64>::new());
    }

    #[test]
    fn test_selected_rows_finite() {
        let context = setup_test_context();

        // Test data rows
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        let rows = table_ref.selected_rows_finite(&context);
        assert_eq!(rows, vec![3]);

        // Test headers
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: false,
            headers: true,
            totals: false,
        };
        let rows = table_ref.selected_rows_finite(&context);
        assert_eq!(rows, vec![2]);
    }

    #[test]
    fn test_selected_cols_edge_cases() {
        let context = setup_test_context();

        // Test column range with out of bounds
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols(4, 6, &context); // Beyond table bounds
        assert_eq!(cols, Vec::<i64>::new());

        // Test non-existent table
        let table_ref = TableRef {
            table_name: "non_existent".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols(1, 3, &context);
        assert_eq!(cols, Vec::<i64>::new());

        // Test non-existent column
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Z".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        let cols = table_ref.selected_cols(1, 3, &context);
        assert_eq!(cols, Vec::<i64>::new());
    }

    #[test]
    fn test_is_multi_cursor_comprehensive() {
        let mut context = A1Context::default();
        context.table_map.test_insert(
            "test_table",
            &["A", "B", "C"],
            None,
            Rect::test_a1("A1:C4"),
            CodeCellLanguage::Import,
        );

        // Test ColToEnd with multiple columns
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));

        // Test All with single column table
        context.table_map.test_insert(
            "single_col",
            &["A"],
            None,
            Rect::test_a1("A1:A4"),
            CodeCellLanguage::Import,
        );
        let table_ref = TableRef {
            table_name: "single_col".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.is_multi_cursor(&context));

        // Test headers only with show_ui false
        let mut table = context.table_map.remove("test_table").unwrap();
        table.show_name = false;
        table.show_columns = false;
        context.table_map.insert(table);
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
    fn test_to_largest_rect_comprehensive() {
        let context = setup_test_context();

        // Test ColToEnd
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColToEnd("B".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        let rect = table_ref.to_largest_rect(&context);
        assert_eq!(rect.unwrap(), Rect::test_a1("B2:C3"));

        // Test with hidden columns
        let context = setup_test_context_with_hidden_columns();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: false,
            totals: false,
        };
        let rect = table_ref.to_largest_rect(&context);
        assert_eq!(rect.unwrap(), Rect::test_a1("A1:C3"));

        // Test with non-existent column
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::Col("Z".to_string()),
            data: true,
            headers: false,
            totals: false,
        };
        assert!(table_ref.to_largest_rect(&context).is_none());
    }

    #[test]
    fn test_table_column_selection_ui_states() {
        let mut context = setup_test_context();
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::All,
            data: true,
            headers: true,
            totals: false,
        };

        // Test when show_ui is false
        {
            let table = context.table_map.try_table_mut("test_table").unwrap();
            table.show_name = false;
            table.show_columns = false;
            assert_eq!(
                table_ref.table_column_selection("test_table", &context),
                None
            );
        }

        // Test when show_columns is false
        {
            let table = context.table_map.try_table_mut("test_table").unwrap();
            table.show_name = false;
            table.show_columns = false;
            assert_eq!(
                table_ref.table_column_selection("test_table", &context),
                None
            );
        }

        // Test with non-existent column in ColRange
        let table_ref = TableRef {
            table_name: "test_table".to_string(),
            col_range: ColRange::ColRange("A".to_string(), "Z".to_string()),
            data: true,
            headers: true,
            totals: false,
        };
        let table = context.table_map.try_table_mut("test_table").unwrap();
        table.show_columns = true;
        assert_eq!(
            table_ref.table_column_selection("test_table", &context),
            None
        );
    }
}
