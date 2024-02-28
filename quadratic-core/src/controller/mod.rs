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
    pub fn from_grid(grid: Grid, last_sequence_num: u64) -> Self {
        let grid = GridController {
            grid,
            transactions: ActiveTransactions::new(last_sequence_num),
            ..Default::default()
        };
        // collect sheet info to send to the client
        if !cfg!(test) && !cfg!(feature = "multiplayer") && !cfg!(feature = "files") {
            if let Ok(sheet_info) = serde_json::to_string(
                &grid
                    .sheet_ids()
                    .iter()
                    .filter_map(|sheet_id| {
                        let sheet = grid.try_sheet(*sheet_id)?;
                        let bounds = sheet.bounds(false);
                        let bounds_without_formatting = sheet.bounds(true);
                        if let Ok(offsets) = serde_json::to_string(&sheet.offsets) {
                            Some(SheetInfo {
                                sheet_id: sheet_id.to_string(),
                                name: sheet.name.clone(),
                                color: sheet.color.clone(),
                                order: sheet.order.clone(),
                                offsets,
                                bounds,
                                bounds_without_formatting,
                            })
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>(),
            ) {
                crate::wasm_bindings::js::jsSheetInfo(sheet_info);
            }
        }
        grid
    }

    pub fn grid(&self) -> &Grid {
        &self.grid
    }

    pub fn grid_mut(&mut self) -> &mut Grid {
        &mut self.grid
    }

    pub fn test() -> Self {
        Self::from_grid(Grid::new(), 0)
    }
}
