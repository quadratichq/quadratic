use self::{
    execution::TransactionType, operations::operation::Operation, transaction::Transaction,
    transaction_summary::TransactionSummary,
};
use crate::{
    grid::{CodeCellLanguage, Grid, Sheet, SheetId},
    SheetPos, SheetRect,
};
use chrono::{DateTime, Utc};
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
pub mod transaction;
pub mod transaction_summary;
pub mod transaction_types;
pub mod user_actions;

#[derive(Debug, Default, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,
    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,

    // completed user Transactions that do not have a sequence number from the server
    // Vec<(forward_transaction, reverse_transaction)>
    unsaved_transactions: Vec<(Transaction, Transaction)>,

    // sorted list of Transactions we received from multiplayer that are after our last_sequence_num (we are missing some transactions)
    last_need_request_transactions_time: Option<DateTime<Utc>>,
    out_of_order_transactions: Vec<Transaction>,

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

    pub last_sequence_num: u64,
}

impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new(), 0)
    }
    pub fn from_grid(grid: Grid, last_sequence_num: u64) -> Self {
        GridController {
            grid,
            last_sequence_num,
            ..Default::default()
        }
    }
    pub fn grid(&self) -> &Grid {
        &self.grid
    }
    pub fn grid_mut(&mut self) -> &mut Grid {
        &mut self.grid
    }
    pub fn try_sheet_from_id(&self, sheet_id: SheetId) -> Option<&Sheet> {
        self.grid.try_sheet_from_id(sheet_id)
    }
    pub fn try_sheet_mut_from_id(&mut self, sheet_id: SheetId) -> Option<&mut Sheet> {
        self.grid.try_sheet_mut_from_id(sheet_id)
    }
}
