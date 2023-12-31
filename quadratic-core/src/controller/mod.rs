use self::{active_transactions::ActiveTransactions, transaction::Transaction};
use crate::grid::{Grid, Sheet, SheetId};
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

pub mod active_transactions;
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

    // holds information about transactions in progress
    transactions: ActiveTransactions,
}

impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new(), 0)
    }

    pub fn from_grid(grid: Grid, last_sequence_num: u64) -> Self {
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

    pub fn try_sheet_from_id(&self, sheet_id: SheetId) -> Option<&Sheet> {
        self.grid.try_sheet_from_id(sheet_id)
    }

    pub fn try_sheet_mut_from_id(&mut self, sheet_id: SheetId) -> Option<&mut Sheet> {
        self.grid.try_sheet_mut_from_id(sheet_id)
    }
}
