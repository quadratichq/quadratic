use std::collections::HashSet;

use indexmap::IndexSet;
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::grid::{CellRef, CodeCellLanguage, Grid, RegionRef, SheetId};

use self::{
    operation::Operation, transaction_in_progress::TransactionType,
    transaction_summary::TransactionSummary,
};

pub mod auto_complete;
pub mod borders;
pub mod cells;
pub mod clipboard;
pub mod dependencies;
pub mod export;
pub mod formatting;
pub mod formula;
pub mod import;
pub mod operation;
pub mod operations;
pub mod sheet_offsets;
pub mod sheets;
pub mod spills;
pub mod thumbnail;
pub mod transaction_in_progress;
pub mod transaction_summary;
pub mod transaction_types;
pub mod undo;
pub mod update_code_cell_value;

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

    // transaction in progress information
    transaction_in_progress: bool,
    cursor: Option<String>,
    transaction_type: TransactionType,

    // queue of cells to compute
    cells_to_compute: IndexSet<CellRef>,

    // track changes
    cells_updated: IndexSet<RegionRef>,
    cells_accessed: HashSet<CellRef>,
    summary: TransactionSummary,
    sheets_with_changed_bounds: HashSet<SheetId>,

    // tracks whether there are any async calls (which changes how the transaction is finalized)
    has_async: bool,

    // save code_cell info for async calls
    current_cell_ref: Option<CellRef>,
    waiting_for_async: Option<CodeCellLanguage>,

    // true when transaction completes
    complete: bool,

    // undo operations
    reverse_operations: Vec<Operation>,

    // operations for multiplayer
    forward_operations: Vec<Operation>,
}

impl GridController {
    pub fn new() -> Self {
        Self::from_grid(Grid::new())
    }
    pub fn from_grid(grid: Grid) -> Self {
        GridController {
            grid,

            transaction_in_progress: false,
            reverse_operations: vec![],
            cells_updated: IndexSet::new(),
            cells_to_compute: IndexSet::new(),
            cursor: None,
            cells_accessed: HashSet::new(),
            summary: TransactionSummary::default(),
            sheets_with_changed_bounds: HashSet::new(),
            transaction_type: TransactionType::Normal,
            has_async: false,
            current_cell_ref: None,
            waiting_for_async: None,
            complete: false,
            forward_operations: vec![],

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
