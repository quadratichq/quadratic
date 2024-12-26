//! A map of table names and columns to positions on the sheet. This allows
//! JsSelection to properly return positions w/o needing to call into core.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::*;
use crate::Rect;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct TableMapEntry {
    sheet_id: String,
    table_name: String,
    column_names: Vec<String>,
    bounds: Rect,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct TableMap(Vec<TableMapEntry>);

impl Grid {
    pub fn table_map(&self) -> TableMap {
        let mut tables = vec![];
        for sheet in self.sheets.iter() {
            let sheet_id = sheet.id.clone();
            sheet.data_tables.iter().for_each(|(pos, table)| {
                if !table.has_error() && !table.spill_error {
                    tables.push(TableMapEntry {
                        sheet_id: sheet_id.to_string(),
                        table_name: table.name.clone(),
                        column_names: table.columns_map(),
                        bounds: table.output_rect(*pos, true),
                    });
                }
            });
        }
        TableMap(tables)
    }
}
