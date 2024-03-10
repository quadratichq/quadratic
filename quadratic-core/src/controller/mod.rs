use self::{active_transactions::ActiveTransactions, transaction::Transaction};
use crate::{grid::Grid, wasm_bindings::controller::sheet_info::SheetInfo};
use wasm_bindgen::prelude::*;
pub mod active_transactions;
pub mod dependencies;
pub mod execution;
pub mod export;
pub mod formula;
pub mod operations;
pub mod send_render;
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
    pub fn from_grid(grid: Grid, last_sequence_num: u64, initialize: bool) -> Self {
        let grid = GridController {
            grid,
            transactions: ActiveTransactions::new(last_sequence_num),
            ..Default::default()
        };

        // collect sheet info to send to the client
        if initialize && cfg!(target_family = "wasm") {
            if let Ok(sheet_info) = serde_json::to_string(
                &grid
                    .sheet_ids()
                    .iter()
                    .filter_map(|sheet_id| {
                        let sheet = grid.try_sheet(*sheet_id)?;
                        Some(SheetInfo::from(sheet))
                    })
                    .collect::<Vec<_>>(),
            ) {
                crate::wasm_bindings::js::jsSheetInfo(sheet_info);
            }
        }
        grid
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

    // create a new gc for testing purposes in both Rust and TS
    pub fn test() -> Self {
        Self::from_grid(Grid::new(), 0, false)
    }

    // get the last active transaction for testing purposes
    pub fn last_transaction(&self) -> Option<&Transaction> {
        if let Some(last) = self.active_transactions().unsaved_transactions.last() {
            Some(&last.forward)
        } else {
            None
        }
    }
}
