#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::grid::Grid;

use self::transactions::Transaction;

pub mod auto_complete;
pub mod cells;
pub mod clipboard;
pub mod code_cell_value;
pub mod compute;
pub mod dependencies;
pub mod formatting;
pub mod import;
pub mod operations;
pub mod sheet_offsets;
pub mod sheets;
pub mod transaction;
pub mod transaction_summary;
pub mod transactions;

#[derive(Debug, Default, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,

    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,
}
impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new())
    }
    pub fn from_grid(grid: Grid) -> Self {
        GridController {
            grid,

            undo_stack: vec![],
            redo_stack: vec![],
        }
    }
    pub fn grid(&self) -> &Grid {
        &self.grid
    }
}
