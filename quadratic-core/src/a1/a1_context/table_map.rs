use serde::{Deserialize, Serialize};

use crate::{
    grid::{DataTable, SheetId},
    Pos, Rect,
};

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
    pub fn insert(&mut self, sheet_id: SheetId, pos: Pos, table: &DataTable) {
        self.tables.push(TableMapEntry {
            sheet_id,
            table_name: table.name.clone(),
            column_names: table.columns_map(),
            bounds: table.output_rect(pos, true),
        });
    }

    /// Finds a table by name.
    pub fn try_table(&self, table_name: &str) -> Option<&TableMapEntry> {
        self.tables
            .iter()
            .find(|table| &table.table_name == table_name)
    }

    /// Returns a list of all table names in the table map.
    pub fn table_names(&self) -> Vec<String> {
        self.tables.iter().map(|t| t.table_name.clone()).collect()
    }
}

#[cfg(test)]
impl TableMap {
    pub fn test_insert(
        &mut self,
        sheet_id: SheetId,
        table_name: &str,
        column_names: &[&str],
        bounds: Rect,
    ) {
        self.tables.push(TableMapEntry {
            sheet_id,
            table_name: table_name.to_string(),
            column_names: column_names.iter().map(|c| c.to_string()).collect(),
            bounds,
        });
    }
}
