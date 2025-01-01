//! Contains context for use by quadratic-rust-client (and core) when using A1.
//! This is needed because rust-client does not have access to the grid, so it
//! needs a mapping of sheet names to ids, table information, and (eventually)
//! named ranges.

use serde::{Deserialize, Serialize};

mod sheet_map;
mod table_map;

pub use sheet_map::*;
pub use table_map::*;

use crate::grid::SheetId;

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
}

#[cfg(test)]
use crate::Rect;

#[cfg(test)]
impl A1Context {
    /// Creates an A1Context for testing.
    ///
    /// sheets: Vec<(sheet_name: &str, sheet_id: SheetId)>
    /// tables: Vec<(table_name: &str, column_names: Vec<&str>, bounds: Rect)>
    pub fn test(sheets: &[(&str, SheetId)], tables: &[(&str, &[&str], Rect)]) -> Self {
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
}
