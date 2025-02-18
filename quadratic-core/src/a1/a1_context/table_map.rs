use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::{
    grid::{CodeCellLanguage, DataTable, SheetId},
    util::case_fold,
    Pos, SheetPos,
};

use super::TableMapEntry;

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableMap {
    pub tables: HashMap<String, TableMapEntry>,
}

impl TableMap {
    pub fn insert(&mut self, table_map_entry: TableMapEntry) {
        let table_name_folded = case_fold(&table_map_entry.table_name);
        self.tables.insert(table_name_folded, table_map_entry);
    }

    pub fn insert_table(
        &mut self,
        sheet_id: SheetId,
        pos: Pos,
        table: &DataTable,
        language: Option<CodeCellLanguage>,
    ) {
        let table_name_folded = case_fold(&table.name.to_display());
        let table_map_entry = TableMapEntry::from_table(sheet_id, pos, table, language);
        self.tables.insert(table_name_folded, table_map_entry);
    }

    /// Finds a table by name.
    pub fn try_table(&self, table_name: &str) -> Option<&TableMapEntry> {
        let table_name = case_fold(table_name);
        self.tables.get(&table_name)
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
    ) {
        let table_name_folded = case_fold(table_name);
        self.tables.insert(
            table_name_folded,
            TableMapEntry::test(table_name, visible_columns, all_columns, bounds),
        );
    }

    /// Returns the table name if the given position is in the table's name or column headers.
    pub fn table_in_name_or_column(&self, sheet_id: SheetId, x: u32, y: u32) -> Option<String> {
        self.tables.values().find_map(|table| {
            if table.sheet_id == sheet_id
                && table.bounds.contains(Pos {
                    x: x as i64,
                    y: y as i64,
                })
                && table.show_ui
                && y < (table.bounds.min.y as u32)
                    + (if table.show_name { 1 } else { 0 } + if table.show_columns { 1 } else { 0 })
                        as u32
            {
                return Some(table.table_name.clone());
            }

            None
        })
    }

    #[cfg(test)]
    pub fn get_mut(&mut self, table_name: &str) -> Option<&mut TableMapEntry> {
        let table_name_folded = case_fold(table_name);
        self.tables.get_mut(&table_name_folded)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::Rect;

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

    #[test]
    fn test_col_name_from_index() {
        let mut map = TableMap::default();
        map.test_insert("test", &["A", "B", "C"], None, Rect::test_a1("A1:C5"));
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
            show_ui: true,
            show_name: true,
            show_columns: true,
            is_html_image: false,
            header_is_first_row: false,
            language: None,
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
            show_ui: true,
            show_name: false,
            show_columns: true,
            is_html_image: false,
            header_is_first_row: false,
            language: None,
        });

        // Test position in column headers row (y=5)
        assert_eq!(
            map.table_in_name_or_column(sheet_id_1, 5, 5),
            Some("Table 2".to_string())
        );

        // Test position in data area (y=6)
        assert_eq!(map.table_in_name_or_column(sheet_id_1, 5, 6), None);
    }
}
