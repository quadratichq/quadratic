use self::{active_transactions::ActiveTransactions, transaction::Transaction};
use crate::{
    SheetPos,
    a1::A1Context,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        tracked_transaction::TrackedTransactions,
    },
    grid::{DataTable, Grid, RegionMap, SheetId},
    viewport::ViewportBuffer,
};
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
pub mod test_util;
pub mod thumbnail;
pub mod tracked_transaction;
pub mod transaction;
pub mod transaction_types;
pub mod user_actions;

#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,

    a1_context: A1Context,

    cells_accessed_cache: RegionMap,

    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,

    // holds information about transactions in progress
    transactions: ActiveTransactions,

    // the viewport buffer is a shared array buffer that is accessed by the render web worker and the controller
    // contains current viewport position and sheet id, updated by render web worker on viewport change
    viewport_buffer: Option<ViewportBuffer>,

    // tracks all transactions that have been applied since the user joined the
    // file
    tracked_transactions: TrackedTransactions,
}

impl Default for GridController {
    fn default() -> Self {
        let grid = Grid::default();
        let a1_context = grid.expensive_make_a1_context();
        let cells_accessed_cache = grid.expensive_make_cells_accessed_cache(&a1_context);
        Self {
            grid,
            a1_context,
            cells_accessed_cache,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            transactions: ActiveTransactions::new(0),
            viewport_buffer: None,
            tracked_transactions: Default::default(),
        }
    }
}

impl GridController {
    pub fn from_grid(grid: Grid, last_sequence_num: u64) -> Self {
        let a1_context = grid.expensive_make_a1_context();
        let cells_accessed_cache = grid.expensive_make_cells_accessed_cache(&a1_context);
        GridController {
            grid,
            a1_context,
            cells_accessed_cache,
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

    // get the last active transaction for testing purposes
    pub fn last_transaction(&self) -> Option<&Transaction> {
        self.active_transactions()
            .unsaved_transactions
            .last()
            .map(|t| &t.forward)
    }

    pub fn a1_context(&self) -> &A1Context {
        &self.a1_context
    }

    pub fn cells_accessed(&self) -> &RegionMap {
        &self.cells_accessed_cache
    }

    pub(crate) fn update_a1_context_table_map(&mut self, transaction: &mut PendingTransaction) {
        let code_cells_a1_context = std::mem::take(&mut transaction.code_cells_a1_context);
        for (sheet_id, positions) in code_cells_a1_context.into_iter() {
            let Some(sheet) = self.grid.try_sheet(sheet_id) else {
                self.a1_context.table_map.remove_sheet(sheet_id);
                continue;
            };

            for pos in positions.into_iter() {
                let Some(table) = sheet.data_table_at(&pos) else {
                    self.a1_context.table_map.remove_at(sheet_id, pos);
                    continue;
                };

                if !self
                    .a1_context()
                    .table_map
                    .contains_name(table.name(), None)
                {
                    self.a1_context.table_map.remove_at(sheet_id, pos);
                }

                self.a1_context.table_map.insert_table(sheet_id, pos, table);
            }
        }

        if transaction.complete {
            self.a1_context.table_map.sort();
        }
    }

    pub(crate) fn update_a1_context_sheet_map(&mut self, sheet_id: SheetId) {
        self.a1_context.sheet_map.remove_sheet_id(sheet_id);

        if let Some(sheet) = self.try_sheet(sheet_id) {
            let sheet_name = sheet.name.to_owned();
            self.a1_context
                .sheet_map
                .insert_parts(&sheet_name, sheet_id);
        }
    }

    pub(crate) fn update_cells_accessed_cache(
        &mut self,
        sheet_pos: SheetPos,
        data_table: &Option<DataTable>,
    ) {
        self.cells_accessed_cache.remove_pos(sheet_pos);
        if let Some(code_run) = data_table.as_ref().and_then(|dt| dt.code_run()) {
            for (sheet_id, rect) in code_run
                .cells_accessed
                .iter_rects_unbounded(&self.a1_context)
            {
                self.cells_accessed_cache
                    .insert(sheet_pos, (sheet_id, rect));
            }
        }
    }

    /// Creates a grid controller for testing purposes in both Rust and TS
    pub fn test() -> Self {
        Self::from_grid(Grid::test(), 0)
    }

    pub fn new_blank() -> Self {
        Self::from_grid(Grid::new_blank(), 0)
    }
}

impl GridController {
    /// Returns the undo stack for testing purposes
    pub fn undo_stack(&self) -> &Vec<Transaction> {
        &self.undo_stack
    }

    /// Returns the redo stack for testing purposes
    pub fn redo_stack(&self) -> &Vec<Transaction> {
        &self.redo_stack
    }
}
