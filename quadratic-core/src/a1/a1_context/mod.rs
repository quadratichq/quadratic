//! Contains context for use by quadratic-rust-client (and core) when using A1.
//! This is needed because rust-client does not have access to the grid, so it
//! needs a mapping of sheet names to ids, table information, and (eventually)
//! named ranges.

use serde::{Deserialize, Serialize};

mod sheet_map;
mod table_map;
pub mod wasm_bindings;

pub use sheet_map::*;
pub use table_map::*;

use crate::{grid::SheetId, SheetPos};

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct A1Context {
    pub sheet_map: SheetMap,
    pub table_map: TableMap,
}

impl A1Context {
    /// Finds a table by the table name.
    pub fn try_table(&self, table_name: &str) -> Option<&TableMapEntry> {
        self.table_map.try_table(table_name)
    }

    /// Finds a sheetId using a sheet name.
    pub fn try_sheet_name(&self, sheet_name: &str) -> Option<SheetId> {
        self.sheet_map.try_sheet_name(sheet_name)
    }

    /// Finds a sheetId using a sheet name.
    pub fn try_sheet_id(&self, sheet_id: SheetId) -> Option<&String> {
        self.sheet_map.try_sheet_id(sheet_id)
    }

    /// Returns an iterator over all the tables in the context.
    pub fn tables(&self) -> impl Iterator<Item = &TableMapEntry> {
        self.table_map.tables.iter()
    }

    /// Returns a list of all table names in the context.
    pub fn table_names(&self) -> Vec<String> {
        self.table_map
            .tables
            .iter()
            .map(|table| table.table_name.clone())
            .collect()
    }

    /// Returns any table that intersects with the given sheet position.
    pub fn table_from_pos(&self, sheet_pos: SheetPos) -> Option<&TableMapEntry> {
        self.table_map.table_from_pos(sheet_pos)
    }

    /// Creates an A1Context for testing.
    ///
    /// sheets: Vec<(sheet_name: &str, sheet_id: SheetId)>
    /// tables: Vec<(table_name: &str, column_names: Vec<&str>, bounds: Rect)>
    #[cfg(test)]
    pub fn test(sheets: &[(&str, SheetId)], tables: &[(&str, &[&str], crate::Rect)]) -> Self {
        let mut sheet_map = SheetMap::default();
        for (name, id) in sheets {
            sheet_map.insert_test(name, *id);
        }

        let mut table_map = TableMap::default();
        for (table_name, column_names, bounds) in tables {
            table_map.test_insert(table_name, column_names, None, *bounds);
        }

        Self {
            sheet_map,
            table_map,
        }
    }

    #[cfg(test)]
    pub fn to_string(&self) -> String {
        serde_json::to_string(self).unwrap()
    }

    #[cfg(test)]
    pub fn table_mut(&mut self, table_name: &str) -> Option<&mut TableMapEntry> {
        self.table_map.get_mut(table_name)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_table_operations() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::test())],
            &[
                ("Table1", &["col1", "col2"], Rect::test_a1("A1:B3")),
                ("Table2", &["col3", "col4"], Rect::test_a1("D1:E3")),
            ],
        );

        // Test try_table
        let table1 = context.try_table("Table1").unwrap();
        assert_eq!(table1.table_name, "Table1");
        assert!(context.try_table("NonexistentTable").is_none());

        // Test tables iterator
        let table_names: Vec<_> = context.tables().map(|t| &t.table_name).collect();
        assert_eq!(table_names, vec!["Table1", "Table2"]);

        // Test table_names
        let names = context.table_names();
        assert_eq!(names, vec!["Table1", "Table2"]);
    }

    #[test]
    fn test_sheet_operations() {
        let sheet_id1 = SheetId::new();
        let sheet_id2 = SheetId::new();
        let context = A1Context::test(&[("Sheet1", sheet_id1), ("Sheet2", sheet_id2)], &[]);

        // Test try_sheet_name
        assert_eq!(context.try_sheet_name("Sheet1"), Some(sheet_id1));
        assert_eq!(context.try_sheet_name("Sheet2"), Some(sheet_id2));
        assert_eq!(context.try_sheet_name("NonexistentSheet"), None);

        // Test try_sheet_id
        assert_eq!(
            context.try_sheet_id(sheet_id1).map(String::as_str),
            Some("Sheet1")
        );
        assert_eq!(
            context.try_sheet_id(sheet_id2).map(String::as_str),
            Some("Sheet2")
        );
        assert_eq!(context.try_sheet_id(SheetId::new()), None);
    }
}
