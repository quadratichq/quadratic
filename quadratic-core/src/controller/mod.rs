pub mod active_transactions;
pub mod dependencies;
pub mod execution;
pub mod export;
pub mod formula;
pub mod operations;
pub mod send_render;
pub mod sheet_offsets;
pub mod sheets;
pub mod thumbnail;
pub mod transaction;
pub mod transaction_types;
pub mod user_actions;
pub mod viewport;

use crate::grid::Grid;
use active_transactions::ActiveTransactions;
use transaction::Transaction;
use wasm_bindgen::prelude::*;

#[derive(Debug, Default, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,
    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,

    // holds information about transactions in progress
    transactions: ActiveTransactions,
}

impl GridController {
    pub fn from_grid(grid: Grid, last_sequence_num: u64) -> Self {
        GridController {
            grid,
            transactions: ActiveTransactions::new(last_sequence_num),
            ..Default::default()
        }
    }

    pub fn upgrade_grid(grid: Grid, last_sequence_num: u64) -> Self {
        GridController {
            grid,
            transactions: ActiveTransactions::new(last_sequence_num),
            ..Default::default()
        }
    }

    pub fn grid(&self) -> &Grid {
        &self.grid
    }

    pub fn grid_mut(&mut self) -> &mut Grid {
        &mut self.grid
    }

    pub fn into_grid(self) -> Grid {
        self.grid
    }

    pub fn new() -> Self {
        Self::from_grid(Grid::new(), 0)
    }

    /// Creates a grid controller for testing purposes in both Rust and TS
    pub fn test() -> Self {
        Self::from_grid(Grid::test(), 0)
    }

    // get the last active transaction for testing purposes
    pub fn last_transaction(&self) -> Option<&Transaction> {
        self.active_transactions()
            .unsaved_transactions
            .last()
            .map(|t| &t.forward)
    }

    #[cfg(test)]
    pub fn new_blank() -> Self {
        Self::from_grid(Grid::new_blank(), 0)
    }
}
