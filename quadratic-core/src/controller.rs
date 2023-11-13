#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::{computation::TransactionInProgress, grid::Grid};

use self::{dependencies::Dependencies, transactions::Transaction};

pub mod auto_complete;
pub mod borders;
pub mod cells;
pub mod clipboard;
pub mod dependencies;
pub mod formatting;
pub mod formula;
pub mod import;
pub mod operation;
pub mod operations;
pub mod sheet_offsets;
pub mod sheets;
pub mod transaction_summary;
pub mod transaction_types;
pub mod transactions;
pub mod update_code_cell_value;

#[derive(Debug, Default, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,

    dependencies: Dependencies,
    transaction_in_progress: Option<TransactionInProgress>,

    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,
}
impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new())
    }
    pub fn from_grid(grid: Grid) -> Self {
        let dependencies = Dependencies::new(&grid);
        GridController {
            grid,
            dependencies,
            transaction_in_progress: None,
            undo_stack: vec![],
            redo_stack: vec![],
        }
    }
    pub fn grid(&self) -> &Grid {
        &self.grid
    }
    pub fn grid_mut(&mut self) -> &mut Grid {
        &mut self.grid
    }
}

#[cfg(test)]
impl GridController {
    pub fn get_transaction_in_progress(&self) -> Option<&TransactionInProgress> {
        self.transaction_in_progress.as_ref()
    }
}
