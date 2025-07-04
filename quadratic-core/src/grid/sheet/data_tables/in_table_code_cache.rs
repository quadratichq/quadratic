//! This is a cache of all in-table code tables within the sheet.
//!
//! This is only defined for the sheet-level of tables.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::{
    Pos, SheetPos, TablePos,
    grid::{Contiguous2D, sheet::data_tables::SheetDataTables},
};

#[derive(Debug, Default, Serialize, Deserialize, Clone, PartialEq)]
pub(crate) struct InTableCodeTables {
    // list of tables that have code
    pub(crate) tables_with_code: HashSet<Pos>,

    // this is used to find the in-table code table that contains the single
    // cell table
    //
    // since it's a single cell table, it's actual position is its position
    // within the sheet subtracted by its parent position
    pub(crate) single_cell_in_table_code_tables: Contiguous2D<Option<Pos>>,

    // holds the TablePos for each multi-cell in-table code table
    pub(crate) multi_cell_in_table_code_tables: Contiguous2D<Option<TablePos>>,
}

impl InTableCodeTables {
    /// Adds a table to the cache.
    pub(crate) fn add_table(&mut self, sheet_pos: SheetPos, tables: &SheetDataTables) {
        self.tables_with_code.insert(sheet_pos.into());
        tables
            .cache
            .merge_single_cell(sheet_pos, &mut self.single_cell_in_table_code_tables);
    }
}
