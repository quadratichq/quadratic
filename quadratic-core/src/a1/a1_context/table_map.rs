use std::collections::HashMap;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use crate::{
    Pos, SheetPos,
    grid::{CodeCellLanguage, DataTable, SheetId},
    util::case_fold_ascii,
};

use super::{JsTableInfo, TableMapEntry};

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TableMap {
    tables: IndexMap<String, TableMapEntry>,

    sheet_pos_to_table: HashMap<SheetPos, String>,
}

impl TableMap {
    pub(crate) fn insert(&mut self, table_map_entry: TableMapEntry) {
        let table_name_folded = case_fold_ascii(&table_map_entry.table_name);
        let sheet_pos = table_map_entry
            .bounds
            .min
            .as_sheet_pos(table_map_entry.sheet_id);
        self.sheet_pos_to_table
            .insert(sheet_pos, table_name_folded.clone());
        self.tables.insert(table_name_folded, table_map_entry);
    }

    pub(crate) fn insert_table(&mut self, sheet_id: SheetId, pos: Pos, table: &DataTable) {
        let table_map_entry = TableMapEntry::from_table(sheet_id, pos, table);
        self.insert(table_map_entry);
    }

    pub(crate) fn remove_at(&mut self, sheet_id: SheetId, pos: Pos) {
        if let Some(table_name) = self.sheet_pos_to_table.remove(&pos.as_sheet_pos(sheet_id))
            && let Some(table) = self.tables.get(&table_name)
            && table.sheet_id == sheet_id
            && table.bounds.min == pos
        {
            self.tables.swap_remove(&table_name);
        }
    }

    pub(crate) fn remove_sheet(&mut self, sheet_id: SheetId) {
        self.sheet_pos_to_table.retain(|sheet_pos, name| {
            if sheet_pos.sheet_id == sheet_id {
                self.tables.swap_remove(name);
                false
            } else {
                true
            }
        });
    }

    pub(crate) fn sort(&mut self) {
        self.tables
            .sort_unstable_by(|k1, _, k2, _| k1.len().cmp(&k2.len()).then(k1.cmp(k2)));
    }

    /// Finds a table by name.
    pub(crate) fn try_table(&self, table_name: &str) -> Option<&TableMapEntry> {
        let table_name = case_fold_ascii(table_name);
        self.tables.get(&table_name)
    }

    /// Finds a table by name.
    #[cfg(test)]
    pub(crate) fn try_table_mut(&mut self, table_name: &str) -> Option<&mut TableMapEntry> {
        let table_name = case_fold_ascii(table_name);
        self.tables.get_mut(&table_name)
    }

    /// Returns true if the table has a column with the given name.
    pub(crate) fn table_has_column(
        &self,
        table_name: &str,
        column_name: &str,
        index: usize,
    ) -> bool {
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

    /// Returns an iterator over the table names in the table map in reverse order.
    pub(crate) fn iter_rev_table_names(&self) -> impl Iterator<Item = &String> {
        self.tables.keys().rev()
    }

    /// Returns an iterator over the TableMapEntry in the table map.
    pub(crate) fn iter_table_values(&self) -> impl Iterator<Item = &TableMapEntry> {
        self.tables.values()
    }

    /// Finds a table by position
    pub(crate) fn table_from_pos(&self, sheet_pos: SheetPos) -> Option<&TableMapEntry> {
        if let Some(table_name) = self.sheet_pos_to_table.get(&sheet_pos) {
            self.tables.get(table_name)
        } else {
            self.tables.values().find(|table| {
                table.sheet_id == sheet_pos.sheet_id && table.bounds.contains(sheet_pos.into())
            })
        }
    }

    pub(crate) fn contains_name(&self, table_name: &str, skip_sheet_pos: Option<SheetPos>) -> bool {
        let table = self.try_table(table_name);
        if let Some(table) = table {
            if let Some(sheet_pos) = skip_sheet_pos {
                table.sheet_id != sheet_pos.sheet_id || table.bounds.min != sheet_pos.into()
            } else {
                true
            }
        } else {
            false
        }
    }

    /// Returns JsTableInfo for all non-formula tables.
    pub(crate) fn expensive_table_info(&self) -> Vec<JsTableInfo> {
        self.iter_table_values()
            .filter_map(|table| {
                if table.language != CodeCellLanguage::Formula && table.bounds.len() > 1 {
                    Some(JsTableInfo {
                        name: table.table_name.clone(),
                        sheet_id: table.sheet_id.to_string(),
                        chart: table.is_html_image,
                        language: table.language.clone(),
                    })
                } else {
                    None
                }
            })
            .collect()
    }

    /// Finds a table by position.
    pub(crate) fn table_at(&self, sheet_pos: SheetPos) -> Option<&TableMapEntry> {
        self.sheet_pos_to_table
            .get(&sheet_pos)
            .and_then(|table_name| self.tables.get(table_name))
    }

    /// Inserts a test table into the table map.
    ///
    /// if all_columns is None, then it uses visible_columns.
    #[cfg(test)]
    pub(crate) fn test_insert(
        &mut self,
        table_name: &str,
        visible_columns: &[&str],
        all_columns: Option<&[&str]>,
        bounds: crate::Rect,
        language: crate::grid::CodeCellLanguage,
    ) {
        self.insert(TableMapEntry::test(
            table_name,
            visible_columns,
            all_columns,
            bounds,
            language,
        ));
    }

    // shift_remove is expensive, so we should only use it for testing
    #[cfg(test)]
    pub(crate) fn remove(&mut self, table_name: &str) -> Option<TableMapEntry> {
        let table_name_folded = case_fold_ascii(table_name);
        if let Some(table) = self.tables.shift_remove(&table_name_folded) {
            let sheet_pos = table.bounds.min.as_sheet_pos(table.sheet_id);
            self.sheet_pos_to_table.remove(&sheet_pos);
            Some(table)
        } else {
            None
        }
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

    #[test]
    fn test_table_info() {
        let mut map = TableMap::default();

        // Insert tables with different languages
        map.test_insert(
            "table1",
            &["A", "B"],
            None,
            Rect::new(1, 1, 2, 3),
            CodeCellLanguage::Python,
        );

        map.test_insert(
            "table2",
            &["C", "D"],
            None,
            Rect::new(4, 1, 2, 3),
            CodeCellLanguage::Formula, // This should be excluded
        );

        map.test_insert(
            "table3",
            &["E", "F"],
            None,
            Rect::new(7, 1, 2, 3),
            CodeCellLanguage::Import,
        );

        let info = map.expensive_table_info();
        assert_eq!(info.len(), 2); // Only non-formula tables should be included

        // Verify table1 info
        let table1_info = info.iter().find(|t| t.name == "table1").unwrap();
        assert_eq!(table1_info.name, "table1");
        assert_eq!(table1_info.sheet_id, SheetId::TEST.to_string());
        assert!(!table1_info.chart);
        assert_eq!(table1_info.language, CodeCellLanguage::Python);

        // Verify table3 info
        let table3_info = info.iter().find(|t| t.name == "table3").unwrap();
        assert_eq!(table3_info.name, "table3");
        assert_eq!(table3_info.sheet_id, SheetId::TEST.to_string());
        assert!(!table3_info.chart);
        assert_eq!(table3_info.language, CodeCellLanguage::Import);
    }
}
