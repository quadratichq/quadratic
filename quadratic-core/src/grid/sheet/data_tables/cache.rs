//! This is a subset of the cache of data tables that is used by both
//! SheetDataTables and the client. Only SheetDataTables can modify the cache.

use crate::{Pos, grid::Contiguous2D};

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct SheetDataTablesCache {
    // boolean map indicating presence of single cell data table at a position
    // this takes spills and errors into account, which are also single cell tables
    // NOTE: the bool cannot be false
    pub(crate) single_cell_tables: Contiguous2D<Option<bool>>,

    // position map indicating presence of multi-cell data table at a position
    // each position value is the root cell position of the data table
    // this accounts for table spills hence values cannot overlap
    pub(crate) multi_cell_tables: Contiguous2D<Option<Pos>>,
}
