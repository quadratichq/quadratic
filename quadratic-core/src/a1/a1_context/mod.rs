//! Contains context for use by quadratic-rust-client (and core) when using A1.
//! This is needed because rust-client does not have access to the grid, so it
//! needs a mapping of sheet names to ids, table information, and (eventually)
//! named ranges.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

mod sheet_map;
mod table_map;
mod table_map_entry;
pub mod wasm_bindings;

use crate::{
    grid::{CodeCellLanguage, SheetId},
    SheetPos,
};
pub use sheet_map::*;
pub use table_map::*;
pub use table_map_entry::*;

use super::{CellRefRange, RefRangeBounds};

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct A1Context {
    pub sheet_map: SheetMap,
    pub table_map: TableMap,
}

// Used by the client to get table information.
#[derive(Debug, Serialize, Deserialize, PartialEq, TS)]
pub struct JsTableInfo {
    pub name: String,
    pub sheet_name: String,
    pub chart: bool,
    pub language: CodeCellLanguage,
}

#[cfg(test)]
impl std::fmt::Display for A1Context {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", serde_json::to_string(self).unwrap())
    }
}

impl A1Context {
    /// Returns whether a table exists with the given name.
    pub fn has_table(&self, table_name: &str) -> bool {
        self.try_table(table_name).is_some()
    }

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
        self.table_map.tables.values()
    }

    /// Returns a list of all table names in the context.
    pub fn table_info(&self) -> Vec<JsTableInfo> {
        self.table_map
            .tables
            .values()
            .filter_map(|table| {
                self.sheet_map
                    .try_sheet_id(table.sheet_id)
                    .map(|sheet_name| JsTableInfo {
                        name: table.table_name.clone(),
                        sheet_name: sheet_name.to_string(),
                        chart: table.is_html_image,
                        language: table.language.clone(),
                    })
            })
            .collect()
    }

    /// Returns any table that intersects with the given sheet position.
    pub fn table_from_pos(&self, sheet_pos: SheetPos) -> Option<&TableMapEntry> {
        self.table_map.table_from_pos(sheet_pos)
    }

    /// Converts a table name reference to an A1 range.
    pub fn convert_table_to_range(
        &self,
        table_name: &str,
        current_sheet_id: SheetId,
    ) -> Result<String, String> {
        if let Some(table) = self.try_table(table_name) {
            let range = CellRefRange::Sheet {
                range: RefRangeBounds::new_relative_rect(table.bounds),
            };
            if current_sheet_id == table.sheet_id {
                Ok(format!("{range}"))
            } else if let Some(sheet_name) = self.sheet_map.try_sheet_id(table.sheet_id) {
                Ok(format!("{sheet_name}!{range}"))
            } else {
                Err("Sheet not found".to_string())
            }
        } else {
            Err(format!("Table {table_name} not found"))
        }
    }

    pub fn table_in_name_or_column(&self, sheet_id: SheetId, x: u32, y: u32) -> Option<String> {
        self.table_map.table_in_name_or_column(sheet_id, x, y)
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
            table_map.test_insert(
                table_name,
                column_names,
                None,
                *bounds,
                CodeCellLanguage::Import,
            );
        }

        Self {
            sheet_map,
            table_map,
        }
    }

    #[cfg(test)]
    pub fn table_mut(&mut self, table_name: &str) -> Option<&mut TableMapEntry> {
        self.table_map.get_mut(table_name)
    }
}

#[cfg(test)]
mod tests {
    use crate::Rect;

    use super::*;

    #[test]
    fn test_table_operations() {
        let context = A1Context::test(
            &[("Sheet1", SheetId::TEST)],
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
        let mut table_names: Vec<_> = context.tables().map(|t| &t.table_name).collect();
        table_names.sort();
        assert_eq!(table_names, vec!["Table1", "Table2"]);

        // Test table_names
        let mut info = context.table_info();
        info.sort_by_key(|info| info.name.to_owned());
        assert_eq!(
            info[0],
            JsTableInfo {
                name: "Table1".to_string(),
                sheet_name: "Sheet1".to_string(),
                chart: false,
                language: CodeCellLanguage::Import,
            }
        );
        assert_eq!(
            info[1],
            JsTableInfo {
                name: "Table2".to_string(),
                sheet_name: "Sheet1".to_string(),
                chart: false,
                language: CodeCellLanguage::Import,
            }
        );
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

    #[test]
    fn test_convert_table_ref_to_range() {
        let sheet_id = SheetId::TEST;
        let context = A1Context::test(
            &[("Sheet1", sheet_id)],
            &[("Table1", &["col1", "col2"], Rect::test_a1("A1:B3"))],
        );

        // Test conversion when default sheet matches table's sheet
        assert_eq!(
            context.convert_table_to_range("Table1", sheet_id),
            Ok("A1:B3".to_string())
        );

        // Test conversion when default sheet is different
        assert_eq!(
            context.convert_table_to_range("Table1", SheetId::new()),
            Ok("Sheet1!A1:B3".to_string())
        );

        // Test conversion with non-existent table
        assert_eq!(
            context.convert_table_to_range("NonexistentTable", sheet_id),
            Err("Table NonexistentTable not found".to_string())
        );
    }
}
