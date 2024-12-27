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
    pub fn table(&self, table_name: &str) -> Option<&TableMapEntry> {
        self.tables
            .iter()
            .find(|table| &table.table_name == table_name)
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
