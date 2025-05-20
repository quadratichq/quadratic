use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::{
    Pos, SheetPos,
    grid::{DataTable, SheetId},
    util::case_fold_ascii,
};

use super::TableMapEntry;

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableMap {
    pub tables: HashMap<String, TableMapEntry>,
}

impl TableMap {
    pub fn insert(&mut self, table_map_entry: TableMapEntry) {
        let table_name_folded = case_fold_ascii(&table_map_entry.table_name);
        self.tables.insert(table_name_folded, table_map_entry);
    }

    /// Inserts a table into the table map with a key that is already case folded.
    pub fn insert_with_key(&mut self, table_name: String, table_map_entry: TableMapEntry) {
        self.tables.insert(table_name, table_map_entry);
    }

    pub fn remove(&mut self, table_name: &str) -> Option<TableMapEntry> {
        let table_name_folded = case_fold_ascii(table_name);
        self.tables.remove(&table_name_folded)
    }

    pub fn insert_table(&mut self, sheet_id: SheetId, pos: Pos, table: &DataTable) {
        let table_name_folded = case_fold_ascii(table.name());
        let table_map_entry = TableMapEntry::from_table(sheet_id, pos, table);
        self.tables.insert(table_name_folded, table_map_entry);
    }

    /// Finds a table by name.
    pub fn try_table(&self, table_name: &str) -> Option<&TableMapEntry> {
        let table_name = case_fold_ascii(table_name);
        self.tables.get(&table_name)
    }

    /// Finds a table by name.
    pub fn try_table_mut(&mut self, table_name: &str) -> Option<&mut TableMapEntry> {
        let table_name = case_fold_ascii(table_name);
        self.tables.get_mut(&table_name)
    }

    /// Returns true if the table has a column with the given name.
    pub fn table_has_column(&self, table_name: &str, column_name: &str, index: usize) -> bool {
        let column_name_folded = case_fold_ascii(column_name);
        self.try_table(table_name)
            .map(|table| {
                table
                    .all_columns
                    .iter()
                    .enumerate()
                    .any(|(i, col)| case_fold_ascii(col) == column_name_folded && i != index)
            })
            .unwrap_or(false)
    }

    pub fn iter_table_names(&self) -> impl Iterator<Item = &String> {
        self.tables.keys()
    }

    /// Returns a list of all table names in the table map.
    pub fn table_names(&self) -> Vec<String> {
        self.tables.values().map(|t| t.table_name.clone()).collect()
    }

    /// Finds a table by position
    pub fn table_from_pos(&self, sheet_pos: SheetPos) -> Option<&TableMapEntry> {
        self.tables.values().find(|table| {
            table.sheet_id == sheet_pos.sheet_id && table.bounds.contains(sheet_pos.into())
        })
    }

    /// Returns the table name if the given position is in the table's name or column headers.
    pub fn table_in_name_or_column(&self, sheet_id: SheetId, x: u32, y: u32) -> Option<String> {
        self.tables.values().find_map(|table| {
            if table.sheet_id == sheet_id
                && table.bounds.contains(Pos {
                    x: x as i64,
                    y: y as i64,
                })
                && y < (table.bounds.min.y as u32)
                    + (if table.show_name { 1 } else { 0 } + if table.show_columns { 1 } else { 0 })
                        as u32
            {
                return Some(table.table_name.clone());
            }

            None
        })
    }

    pub fn hide_column(&mut self, table_name: &str, column_name: &str) {
        if let Some(table) = self.try_table_mut(table_name) {
            if let Some(index) = table
                .visible_columns
                .iter()
                .position(|col| col == column_name)
            {
                table.visible_columns.remove(index);
            }
        }
    }

    pub fn contains_name(&self, table_name: &str, sheet_pos: Option<SheetPos>) -> bool {
        let table = self.try_table(table_name);
        if let Some(table) = table {
            if let Some(sheet_pos) = sheet_pos {
                table.sheet_id != sheet_pos.sheet_id || table.bounds.min != sheet_pos.into()
            } else {
                true
            }
        } else {
            false
        }
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
        bounds: crate::Rect,
        language: crate::grid::CodeCellLanguage,
    ) {
        let table_name_folded = case_fold_ascii(table_name);
        self.tables.insert(
            table_name_folded,
            TableMapEntry::test(table_name, visible_columns, all_columns, bounds, language),
        );
    }

    #[cfg(test)]
    pub fn get_mut(&mut self, table_name: &str) -> Option<&mut TableMapEntry> {
        let table_name_folded = case_fold_ascii(table_name);
        self.tables.get_mut(&table_name_folded)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::{Rect, grid::CodeCellLanguage};

    #[test]
    fn test_try_col_index() {
        let mut map = TableMap::default();
        map.test_insert(
            "test",
            &["Col1", "Col2", "Col3"],
            None,
            Rect::new(1, 1, 3, 5),
            CodeCellLanguage::Import,
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
            CodeCellLanguage::Import,
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
            CodeCellLanguage::Import,
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
            CodeCellLanguage::Import,
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
            CodeCellLanguage::Import,
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
        map.test_insert(
            "test",
            &["A"],
            None,
            Rect::test_a1("A1:C5"),
            CodeCellLanguage::Import,
        );
        let table = map.try_table("test").unwrap();
        assert_eq!(table.to_sheet_rows(), (1, 5));
    }

    #[test]
    fn test_col_name_from_index() {
        let mut map = TableMap::default();
        map.test_insert(
            "test",
            &["A", "B", "C"],
            None,
            Rect::test_a1("A1:C5"),
            CodeCellLanguage::Import,
        );
        let table = map.try_table("test").unwrap();
        assert_eq!(table.col_name_from_index(0), Some("A".to_string()));
        assert_eq!(table.col_name_from_index(1), Some("B".to_string()));
        assert_eq!(table.col_name_from_index(2), Some("C".to_string()));
    }

    #[test]
    fn test_table_in_name_or_column() {
        let mut map = TableMap::default();

        let sheet_id_1 = SheetId::new();
        let sheet_id_2 = SheetId::new();

        // Create a table with both name and columns shown
        map.insert(TableMapEntry {
            sheet_id: sheet_id_1,
            table_name: "Test Table".to_string(),
            visible_columns: vec!["Col1".to_string(), "Col2".to_string()],
            all_columns: vec!["Col1".to_string(), "Col2".to_string()],
            bounds: Rect::new(0, 0, 2, 3),
            show_name: true,
            show_columns: true,
            is_html_image: false,
            header_is_first_row: false,
            language: CodeCellLanguage::Import,
        });

        // Test position in table name row (y=0)
        assert_eq!(
            map.table_in_name_or_column(sheet_id_1, 0, 0),
            Some("Test Table".to_string())
        );

        // Test position in column headers row (y=1)
        assert_eq!(
            map.table_in_name_or_column(sheet_id_1, 0, 1),
            Some("Test Table".to_string())
        );

        // Test position in data area (y=2)
        assert_eq!(map.table_in_name_or_column(sheet_id_1, 0, 2), None);

        // Test position outside table
        assert_eq!(map.table_in_name_or_column(sheet_id_1, 5, 0), None);

        // Test with different sheet_id
        assert_eq!(map.table_in_name_or_column(sheet_id_2, 0, 0), None);

        // Create a table with only columns shown (no name)
        map.insert(TableMapEntry {
            sheet_id: sheet_id_1,
            table_name: "Table 2".to_string(),
            visible_columns: vec!["Col1".to_string(), "Col2".to_string()],
            all_columns: vec!["Col1".to_string(), "Col2".to_string()],
            bounds: Rect::new(5, 5, 7, 8),
            show_name: false,
            show_columns: true,
            is_html_image: false,
            header_is_first_row: false,
            language: CodeCellLanguage::Import,
        });

        // Test position in column headers row (y=5)
        assert_eq!(
            map.table_in_name_or_column(sheet_id_1, 5, 5),
            Some("Table 2".to_string())
        );

        // Test position in data area (y=6)
        assert_eq!(map.table_in_name_or_column(sheet_id_1, 5, 6), None);
    }

    #[test]
    fn test_table_has_column() {
        let mut map = TableMap::default();

        // Create a table with visible and hidden columns
        map.test_insert(
            "test_table",
            &["Visible1", "Visible2"],                  // visible columns
            Some(&["Visible1", "Hidden1", "Visible2"]), // all columns
            Rect::new(1, 1, 3, 5),
            CodeCellLanguage::Import,
        );

        // Test existing visible column (exact match)
        assert!(map.table_has_column("test_table", "Visible1", 10));
        assert!(map.table_has_column("test_table", "Visible2", 10));

        // Test existing hidden column
        assert!(map.table_has_column("test_table", "Hidden1", 10));

        // Test case insensitivity
        assert!(map.table_has_column("TEST_TABLE", "visible1", 10));
        assert!(map.table_has_column("test_table", "VISIBLE2", 10));
        assert!(map.table_has_column("TEST_TABLE", "HIDDEN1", 10));

        // Test non-existent column
        assert!(!map.table_has_column("test_table", "NonExistent", 10));

        // Test non-existent table
        assert!(!map.table_has_column("non_existent_table", "Visible1", 10));

        // Test empty column name
        assert!(!map.table_has_column("test_table", "", 10));

        // Create a table with empty column list
        map.test_insert(
            "empty_table",
            &[],
            None,
            Rect::new(1, 1, 3, 5),
            CodeCellLanguage::Import,
        );
        assert!(!map.table_has_column("empty_table", "AnyColumn", 10));

        assert!(map.table_has_column("test_table", "VISIBLE1", 1));
        // table_has_column is false when the index is the same as the existing column index
        assert!(!map.table_has_column("test_table", "VISIBLE1", 0));
    }
}
