use self::{active_transactions::ActiveTransactions, transaction::Transaction};
use crate::{grid::Grid, viewport::ViewportBuffer};
use wasm_bindgen::prelude::*;
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

    // the viewport buffer is a shared array buffer that is accessed by the render web worker and the controller
    // contains current viewport position and sheet id, updated by render web worker on viewport change
    viewport_buffer: Option<ViewportBuffer>,
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

    // create a new gc for testing purposes with a viewport buffer
    pub fn test_with_viewport_buffer() -> Self {
        let mut gc = Self::from_grid(Grid::test(), 0);
        gc.viewport_buffer = Some(ViewportBuffer::default());
        gc
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
