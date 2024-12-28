//! A map of table names and columns to positions on the sheet. This allows
//! JsSelection to properly return positions w/o needing to call into core.

use serde::{Deserialize, Serialize};

use super::*;
use crate::grid::SheetId;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMapEntry {
    pub sheet_id: SheetId,
    pub table_name: String,
    pub column_names: Vec<String>,
    pub bounds: Rect,
}

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct TableMap {
    pub tables: Vec<TableMapEntry>,
}

impl TableMap {
    /// Finds a table by name.
    pub fn table(&self, table_name: &str) -> Option<&TableMapEntry> {
        self.tables
            .iter()
            .find(|table| &table.table_name == table_name)
    }

    /// Returns a list of all table names in the table map.
    pub fn table_names(&self) -> Vec<String> {
        self.tables.iter().map(|t| t.table_name.clone()).collect()
    }

    #[cfg(test)]
    pub fn test(table_names: &[(&str, Rect)]) -> Self {
        let mut tables = vec![];
        for (table_name, bounds) in table_names {
            tables.push(TableMapEntry {
                sheet_id: SheetId::test(),
                table_name: table_name.to_string(),
                column_names: vec![],
                bounds: bounds.clone(),
            });
        }
        Self { tables }
    }
}

impl Grid {
    pub fn table_map(&self) -> TableMap {
        let mut tables = vec![];
        for sheet in self.sheets.iter() {
            let sheet_id = sheet.id.clone();
            sheet.data_tables.iter().for_each(|(pos, table)| {
                if !table.has_error() && !table.spill_error {
                    tables.push(TableMapEntry {
                        sheet_id,
                        table_name: table.name.clone(),
                        column_names: table.columns_map(),
                        bounds: table.output_rect(*pos, true),
                    });
                }
            });
        }
        TableMap { tables }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_table_map_find_table() {
        let mut table_map = TableMap::default();
        let entry = TableMapEntry {
            sheet_id: SheetId::default(),
            table_name: "test_table".to_string(),
            column_names: vec!["col1".to_string(), "col2".to_string()],
            bounds: Rect::test_a1("A1:B2"),
        };
        table_map.tables.push(entry);

        // Test finding existing table
        let found = table_map.table("test_table");
        assert!(found.is_some());
        let found = found.unwrap();
        assert_eq!(found.table_name, "test_table");
        assert_eq!(found.column_names, vec!["col1", "col2"]);

        // Test finding non-existent table
        assert!(table_map.table("nonexistent").is_none());
    }

    #[test]
    fn test_table_map_list_tables() {
        let mut table_map = TableMap::default();
        table_map.tables.push(TableMapEntry {
            sheet_id: SheetId::default(),
            table_name: "table1".to_string(),
            column_names: vec!["col1".to_string()],
            bounds: Rect::test_a1("A1:A2"),
        });
        table_map.tables.push(TableMapEntry {
            sheet_id: SheetId::default(),
            table_name: "table2".to_string(),
            column_names: vec!["col1".to_string()],
            bounds: Rect::test_a1("B1:B2"),
        });

        let table_names = table_map.table_names();
        assert_eq!(table_names, vec!["table1", "table2"]);
    }

    #[test]
    fn test_table_map_test_helper() {
        let test_tables = vec![
            ("table1", Rect::test_a1("A1:B2")),
            ("table2", Rect::test_a1("C3:D4")),
        ];

        let table_map = TableMap::test(&test_tables);

        assert_eq!(table_map.tables.len(), 2);
        assert_eq!(table_map.tables[0].table_name, "table1");
        assert_eq!(table_map.tables[0].bounds, Rect::test_a1("A1:B2"));
        assert_eq!(table_map.tables[1].table_name, "table2");
        assert_eq!(table_map.tables[1].bounds, Rect::test_a1("C3:D4"));

        // Verify other fields are set correctly
        assert!(table_map.tables[0].column_names.is_empty());
        assert_eq!(table_map.tables[0].sheet_id, SheetId::test());
    }
}
