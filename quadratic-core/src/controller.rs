use std::collections::HashSet;

use indexmap::IndexSet;
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::{
    grid::{CodeCellLanguage, Grid, SheetId},
    Pos, Rect, SheetPos, SheetRect,
};

use self::{
    execution::TransactionType, operations::operation::Operation,
    transaction_summary::TransactionSummary,
};

pub mod dependencies;
pub mod execution;
pub mod export;
pub mod formula;
pub mod operations;
pub mod sheet_offsets;
pub mod sheets;
pub mod spills;
pub mod thumbnail;
pub mod transaction_summary;
pub mod transaction_types;
pub mod update_code_cell_value;
pub mod user_actions;

#[derive(Debug, Default, Clone, PartialEq)]
pub struct Transaction {
    operations: Vec<Operation>,
    cursor: Option<String>,
}

#[derive(Debug, Default, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,
    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,

    // current transaction tracking information
    // -----------------------------------
    transaction_in_progress: bool,
    cursor: Option<String>,
    transaction_type: TransactionType,

    // queue of cells to compute
    cells_to_compute: IndexSet<SheetPos>,

    // track changes
    cells_updated: IndexSet<SheetRect>,

    // used by Code Cell execution to track dependencies
    cells_accessed: HashSet<SheetPos>,

    // returned to the TS client for (mostly) rendering updates
    summary: TransactionSummary,

    // tracks sheets that will need updated bounds
    sheets_with_dirty_bounds: HashSet<SheetId>,

    // tracks whether there are any async calls (which changes how the transaction is finalized)
    has_async: bool,

    // save code_cell info for async calls
    current_sheet_pos: Option<SheetPos>,
    waiting_for_async: Option<CodeCellLanguage>,

    // true when transaction completes
    complete: bool,

    // undo operations
    reverse_operations: Vec<Operation>,

    // operations for multiplayer
    forward_operations: Vec<Operation>,

    // temporary changes to the Grid to assist in calculation of spills
    temporary_code_cells: TemporaryCodeCells,
}

impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new())
    }
    pub fn from_grid(grid: Grid) -> Self {
        GridController {
            grid,
            ..Default::default()
        }
    }
    pub fn grid(&self) -> &Grid {
        &self.grid
    }
    pub fn grid_mut(&mut self) -> &mut Grid {
        &mut self.grid
    }
}
