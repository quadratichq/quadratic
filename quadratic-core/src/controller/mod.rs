use std::collections::{HashMap, HashSet};

use self::{active_transactions::ActiveTransactions, transaction::Transaction};
use crate::{
    a1::{A1Context, TableMapEntry},
    grid::{Grid, SheetId},
    viewport::ViewportBuffer,
    Pos,
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
pub mod transaction;
pub mod transaction_types;
pub mod user_actions;

#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct GridController {
    grid: Grid,

    a1_context: A1Context,

    undo_stack: Vec<Transaction>,
    redo_stack: Vec<Transaction>,

    // holds information about transactions in progress
    transactions: ActiveTransactions,

    // the viewport buffer is a shared array buffer that is accessed by the render web worker and the controller
    // contains current viewport position and sheet id, updated by render web worker on viewport change
    viewport_buffer: Option<ViewportBuffer>,
}

impl Default for GridController {
    fn default() -> Self {
        let grid = Grid::default();
        let a1_context = grid.a1_context();
        Self {
            grid,
            a1_context,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            transactions: ActiveTransactions::new(0),
            viewport_buffer: None,
        }
    }
}

impl GridController {
    pub fn from_grid(grid: Grid, last_sequence_num: u64) -> Self {
        let a1_context = grid.a1_context();
        GridController {
            grid,
            a1_context,
            transactions: ActiveTransactions::new(last_sequence_num),
            ..Default::default()
        }
    }

    pub fn upgrade_grid(grid: Grid, last_sequence_num: u64) -> Self {
        let a1_context = grid.a1_context();
        GridController {
            grid,
            a1_context,
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

    pub(crate) fn a1_context(&self) -> &A1Context {
        &self.a1_context
    }

    pub(crate) fn update_a1_context_table_map(
        &mut self,
        code_cells: &HashMap<SheetId, HashSet<Pos>>,
    ) {
        for (sheet_id, positions) in code_cells.iter() {
            let Some(sheet) = self.try_sheet(*sheet_id) else {
                self.a1_context
                    .table_map
                    .tables
                    .retain(|_, table| table.sheet_id != *sheet_id);
                continue;
            };

            let mut to_remove = Vec::new();
            let mut to_insert = Vec::new();

            for pos in positions.iter() {
                let Some(table) = sheet.data_table(*pos) else {
                    to_remove.push(*pos);
                    continue;
                };

                let language = sheet.get_table_language(*pos, table);
                let table_map_entry = TableMapEntry::from_table(*sheet_id, *pos, table, language);
                to_insert.push(table_map_entry);
            }

            for pos in to_remove.into_iter() {
                self.a1_context
                    .table_map
                    .tables
                    .retain(|_, table| table.sheet_id != *sheet_id || table.bounds.min != pos);
            }

            for table_map_entry in to_insert.into_iter() {
                self.a1_context.table_map.insert(table_map_entry);
            }
        }
    }

    pub(crate) fn update_a1_context_sheet_map(&mut self, sheet_id: SheetId) {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            let sheet_name = sheet.name.to_owned();
            self.a1_context
                .sheet_map
                .insert_parts(&sheet_name, sheet_id);
        } else {
            self.a1_context.sheet_map.remove_sheet_id(sheet_id);
        }
    }

    /// Creates a grid controller for testing purposes in both Rust and TS
    pub fn test() -> Self {
        Self::from_grid(Grid::test(), 0)
    }
}
