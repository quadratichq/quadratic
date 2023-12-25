use self::{
    execution::TransactionType, operations::operation::Operation,
    transaction_summary::TransactionSummary,
};
use crate::{
    grid::{CodeCellLanguage, Grid, SheetId},
    SheetPos, SheetRect,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

pub mod dependencies;
pub mod execution;
pub mod export;
pub mod formula;
pub mod operations;
pub mod sheet_offsets;
pub mod sheets;
pub mod thumbnail;
pub mod transaction_summary;
pub mod transaction_types;
pub mod user_actions;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct Transaction {
    id: Uuid,
    sequence_num: Option<u64>,
    operations: Vec<Operation>,
    cursor: Option<String>,
}

#[derive(Debug, Default, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,
    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,

    // completed Transactions that do not have a sequence number from the server
    // these have been pushed to the undo stack
    unsaved_transactions: Vec<Transaction>,

    // transactions that are awaiting async responses
    // these have not been pushed to the undo stack
    incomplete_transactions: Vec<Transaction>,

    // transaction in progress information
    transaction_in_progress: bool,
    cursor: Option<String>,
    transaction_type: TransactionType,

    // list of pending operations
    operations: Vec<Operation>,

    // undo operations
    reverse_operations: Vec<Operation>,

    // list of operations to share with other players
    forward_operations: Vec<Operation>,

    // transaction id used for multiplayer
    transaction_id: Uuid,

    // tracks sheets that will need updated bounds calculations
    sheets_with_dirty_bounds: HashSet<SheetId>,

    // tracks whether there are any async calls (which changes how the transaction is finalized)
    has_async: bool,

    // returned to the TS client for (mostly) rendering updates
    summary: TransactionSummary,

    // Keeps track of pending async transaction
    // ----------------------------------------

    // used by Code Cell execution to track dependencies
    cells_accessed: HashSet<SheetRect>,

    // save code_cell info for async calls
    current_sheet_pos: Option<SheetPos>,
    waiting_for_async: Option<CodeCellLanguage>,

    // true when transaction completes
    complete: bool,
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
