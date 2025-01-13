use serde::{Deserialize, Serialize};

use crate::{
    grid::{DataTable, SheetId},
    Pos, Rect, SheetPos,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMapEntry {
    pub sheet_id: SheetId,
    pub table_name: String,
    pub visible_columns: Vec<String>,
    pub all_columns: Vec<String>,
    pub bounds: Rect,
    pub show_headers: bool,
    pub is_html_image: bool,
}

impl TableMapEntry {
    /// Returns the start and end of the table in row coordinates relative to
    /// the sheet.
    pub fn to_sheet_rows(&self) -> (i64, i64) {
        (self.bounds.min.y, self.bounds.max.y)
    }

    /// Tries to get the visible_columns index for the given column name.
    /// Returns None if the range is not visible or no longer exists.
    ///
    /// Note: the index does not include the table's column offset.
    pub fn try_col_index(&self, col: &str) -> Option<i64> {
        let index = self
            .visible_columns
            .iter()
            .position(|c| c.to_lowercase() == col.to_lowercase())?;
        Some(index as i64)
    }

    /// Returns the col_index if visible, otherwise returns the closest visible
    /// column index either after or before the hidden one. Returns None if there are none.
    ///
    /// Note: the index does not include the table's column offset.
    pub fn try_col_closest(&self, col: &str, after: bool) -> Option<i64> {
        if let Some(index) = self.try_col_index(col) {
            // If the column is visible, return its index
            Some(index)
        } else {
            // Find position in all_columns
            let all_col_pos = self
                .all_columns
                .iter()
                .position(|c| c.to_lowercase() == col.to_lowercase())?;

            if after {
                // Find first visible column after this position
                for i in all_col_pos..self.all_columns.len() {
                    let col = &self.all_columns[i];
                    if let Some(vis_pos) = self
                        .visible_columns
                        .iter()
                        .position(|c| c.to_lowercase() == col.to_lowercase())
                    {
                        return Some(vis_pos as i64);
                    }
                }

                // If no visible columns after, return last visible column
                if !self.visible_columns.is_empty() {
                    Some((self.visible_columns.len() - 1) as i64)
                } else {
                    None
                }
            } else {
                // Find first visible column before this position
                for i in (0..all_col_pos).rev() {
                    let col = &self.all_columns[i];
                    if let Some(vis_pos) = self
                        .visible_columns
                        .iter()
                        .position(|c| c.to_lowercase() == col.to_lowercase())
                    {
                        return Some(vis_pos as i64);
                    }
                }

                // If no visible columns before, return first visible column
                if !self.visible_columns.is_empty() {
                    Some(0)
                } else {
                    None
                }
            }
        }
    }

    /// Tries to get the range for the given column range. Returns None if the
    /// range is not visible or no longer exists.
    ///
    /// Note: the index does not include the table's column offset.
    pub fn try_col_range(&self, col1: &str, col2: &str) -> Option<(i64, i64)> {
        // Get closest visible columns for start and end
        let start = self.try_col_closest(col1, true)?;
        let end = self.try_col_closest(col2, false)?;

        // Return range between closest visible columns, ensuring start <= end
        Some((start.min(end), start.max(end)))
    }

    /// Tries to get the range for the given column range. Returns None if the
    /// range is not visible or no longer exists.
    ///
    /// Note: the index does not include the table's column offset.
    pub fn try_col_range_to_end(&self, col: &str) -> Option<(i64, i64)> {
        let start = self.try_col_closest(col, true)?;
        let end = (self.visible_columns.len() - 1) as i64;
        Some((start, end))
    }

    /// Returns true if the table contains the given position.
    pub fn contains(&self, pos: SheetPos) -> bool {
        self.sheet_id == pos.sheet_id && self.bounds.contains(pos.into())
    }

    #[cfg(test)]
    pub fn test(
        table_name: &str,
        visible_columns: &[&str],
        all_columns: Option<&[&str]>,
        bounds: Rect,
    ) -> Self {
        let visible_columns: Vec<String> = visible_columns.iter().map(|c| c.to_string()).collect();
        let all_columns: Vec<String> = all_columns.map_or(visible_columns.clone(), |c| {
            c.iter().map(|c| c.to_string()).collect()
        });
        TableMapEntry {
            sheet_id: SheetId::test(),
            table_name: table_name.to_string(),
            visible_columns,
            all_columns,
            bounds,
            show_headers: true,
            is_html_image: false,
        }
    }
}

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct TableMap {
    pub tables: Vec<TableMapEntry>,
}

impl TableMap {
    pub fn insert(&mut self, sheet_id: SheetId, pos: Pos, table: &DataTable) {
        self.tables.push(TableMapEntry {
            sheet_id,
            table_name: table.name.clone(),
            visible_columns: table.columns_map(false),
            all_columns: table.columns_map(true),
            bounds: table.output_rect(pos, true),
            show_headers: table.show_header,
            is_html_image: table.is_html() || table.is_image(),
        });
    }

    /// Finds a table by name.
    pub fn try_table(&self, table_name: &str) -> Option<&TableMapEntry> {
        self.tables
            .iter()
            .find(|table| table.table_name.to_lowercase() == table_name.to_lowercase())
    }

    /// Returns a list of all table names in the table map.
    pub fn table_names(&self) -> Vec<String> {
        self.tables.iter().map(|t| t.table_name.clone()).collect()
    }

    /// Finds a table by position
    pub fn table_from_pos(&self, sheet_pos: SheetPos) -> Option<&TableMapEntry> {
        self.tables.iter().find(|table| {
            table.sheet_id == sheet_pos.sheet_id && table.bounds.contains(sheet_pos.into())
        })
    }

    /// Inserts a test table into the table map.
    ///
    /// if all_columns is None, then it uses visible_columns.
    #[cfg(test)]
    pub fn test_insert(
        &mut self,
        table_name: &str,
        visible_columns: &[&str],
        all_columns: Option<&[&str]>,
        bounds: Rect,
    ) {
        self.tables.push(TableMapEntry::test(
            table_name,
            visible_columns,
            all_columns,
            bounds,
        ));
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_try_col_index() {
        let mut map = TableMap::default();
        map.test_insert(
            "test",
            &["Col1", "Col2", "Col3"],
            None,
            Rect::new(1, 1, 3, 5),
        );

        let table = map.try_table("test").unwrap();

        // Test exact match
        assert_eq!(table.try_col_index("Col1"), Some(0));
        assert_eq!(table.try_col_index("Col2"), Some(1));
        assert_eq!(table.try_col_index("Col3"), Some(2));

        // Test case insensitive
        assert_eq!(table.try_col_index("col1"), Some(0));
        assert_eq!(table.try_col_index("COL2"), Some(1));

        // Test non-existent column
        assert_eq!(table.try_col_index("Col4"), None);
    }

    #[test]
    fn test_try_col_range() {
        let mut map = TableMap::default();

        // Test with visible and hidden columns
        map.test_insert(
            "test",
            &["A", "C", "E"],                 // visible columns
            Some(&["A", "B", "C", "D", "E"]), // all columns
            Rect::new(1, 1, 3, 5),
        );

        let table = map.try_table("test").unwrap();

        // Test both visible columns
        assert_eq!(table.try_col_range("A", "C"), Some((0, 1)));
        assert_eq!(table.try_col_range("A", "E"), Some((0, 2)));

        // Test case insensitive
        assert_eq!(table.try_col_range("a", "c"), Some((0, 1)));

        // Test with hidden start column
        assert_eq!(table.try_col_range("B", "E"), Some((1, 2)));

        // Test with hidden end column
        assert_eq!(table.try_col_range("A", "D"), Some((0, 1)));

        // Test with both hidden columns
        assert_eq!(table.try_col_range("B", "D"), Some((1, 1)));

        // Test non-existent columns
        assert_eq!(table.try_col_range("X", "Y"), None);
        assert_eq!(table.try_col_range("A", "Y"), None);
        assert_eq!(table.try_col_range("X", "E"), None);
    }

    #[test]
    fn test_try_col_range_to_end() {
        let mut map = TableMap::default();

        // Test with visible and hidden columns
        map.test_insert(
            "test",
            &["A", "C", "E"],                 // visible columns
            Some(&["A", "B", "C", "D", "E"]), // all columns
            Rect::new(1, 1, 2, 4),
        );

        let table = map.try_table("test").unwrap();

        // Test from visible column
        assert_eq!(table.try_col_range_to_end("A"), Some((0, 2)));
        assert_eq!(table.try_col_range_to_end("C"), Some((1, 2)));

        // Test case insensitive
        assert_eq!(table.try_col_range_to_end("a"), Some((0, 2)));

        // Test from hidden column
        assert_eq!(table.try_col_range_to_end("B"), Some((1, 2)));
        assert_eq!(table.try_col_range_to_end("D"), Some((2, 2)));

        // Test non-existent column
        assert_eq!(table.try_col_range_to_end("X"), None);
    }

    #[test]
    fn test_try_col_closest_after() {
        let mut map = TableMap::default();

        // Test with visible and hidden columns
        map.test_insert(
            "test",
            &["A", "C", "E"],                 // visible columns
            Some(&["A", "B", "C", "D", "E"]), // all columns
            Rect::new(1, 1, 2, 4),
        );

        let table = map.try_table("test").unwrap();

        // Test visible column
        assert_eq!(table.try_col_closest("A", true), Some(0));
        assert_eq!(table.try_col_closest("C", true), Some(1));
        assert_eq!(table.try_col_closest("E", true), Some(2));

        // Test case insensitive
        assert_eq!(table.try_col_closest("a", true), Some(0));

        // Test hidden column - should return next visible
        assert_eq!(table.try_col_closest("B", true), Some(1)); // Returns C
        assert_eq!(table.try_col_closest("D", true), Some(2)); // Returns E

        // Test non-existent column
        assert_eq!(table.try_col_closest("X", true), None);
    }

    #[test]
    fn test_try_col_closest_before() {
        let mut map = TableMap::default();
        // Test with visible and hidden columns
        map.test_insert(
            "test",
            &["A", "C", "E"],                 // visible columns
            Some(&["A", "B", "C", "D", "E"]), // all columns
            Rect::new(1, 1, 2, 4),
        );

        let table = map.try_table("test").unwrap();

        // Test visible column
        assert_eq!(table.try_col_closest("A", false), Some(0));
        assert_eq!(table.try_col_closest("C", false), Some(1));
        assert_eq!(table.try_col_closest("E", false), Some(2));

        // Test case insensitive
        assert_eq!(table.try_col_closest("a", false), Some(0));

        // Test hidden column - should return previous visible
        assert_eq!(table.try_col_closest("B", false), Some(0)); // Returns A
        assert_eq!(table.try_col_closest("D", false), Some(1)); // Returns C

        // Test non-existent column
        assert_eq!(table.try_col_closest("X", false), None);
    }

    #[test]
    fn test_to_sheet_rows() {
        let mut map = TableMap::default();
        map.test_insert("test", &["A"], None, Rect::test_a1("A1:C5"));
        let table = map.try_table("test").unwrap();
        assert_eq!(table.to_sheet_rows(), (1, 5));
    }
}
