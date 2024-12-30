use serde::{Deserialize, Serialize};

use crate::{
    grid::{DataTable, SheetId},
    Pos, Rect,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableMapEntry {
    pub sheet_id: SheetId,
    pub table_name: String,
    pub visible_columns: Vec<String>,
    pub all_columns: Vec<String>,
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
            visible_columns: table.columns_map(false),
            all_columns: table.columns_map(true),
            bounds: table.output_rect(pos, true),
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
}

#[cfg(test)]
impl TableMap {
    /// Inserts a test table into the table map.
    ///
    /// if all_columns is None, then it uses visible_columns.
    pub fn test_insert(
        &mut self,
        sheet_id: SheetId,
        table_name: &str,
        visible_columns: &[&str],
        all_columns: Option<&[&str]>,
        bounds: Rect,
    ) {
        let visible_columns: Vec<String> = visible_columns.iter().map(|c| c.to_string()).collect();
        self.tables.push(TableMapEntry {
            sheet_id,
            table_name: table_name.to_string(),
            visible_columns: visible_columns.clone(),
            all_columns: all_columns.map_or(visible_columns, |c| {
                c.iter().map(|c| c.to_string()).collect()
            }),
            bounds,
        });
    }
}
