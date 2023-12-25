/// This module handles the application of operations to the Grid.
///
pub mod control_transaction;
pub mod execute_offsets;
pub mod execute_operation;
pub mod execute_set_borders;
pub mod execute_set_cell_formats;
pub mod execute_set_cell_values;
pub mod execute_set_code_cell;
pub mod execute_sheets;
pub mod get_cells;
pub mod receive_multiplayer;
pub mod run;
pub mod run_formula;
pub mod run_python;
pub mod spills;

use super::Transaction;
use crate::controller::{transaction_summary::TransactionSummary, GridController};
use serde::{Deserialize, Serialize};

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TransactionType {
    #[default]
    Unset,
    User,
    Undo,
    Redo,
    Multiplayer,
}

impl GridController {
    /// recalculate bounds for changed sheets
    pub fn transaction_updated_bounds(&mut self) {
        self.sheets_with_dirty_bounds
            .clone()
            .iter()
            .for_each(|sheet_id| {
                let sheet = self.grid_mut().sheet_mut_from_id(*sheet_id);
                sheet.recalculate_bounds();
            });
    }

    /// returns the TransactionSummary
    pub fn prepare_transaction_summary(&mut self) -> TransactionSummary {
        if self.complete {
            self.summary.transaction = Some(
                serde_json::to_string(&self.to_transaction())
                    .expect("Failed to serialize forward operations"),
            );
        }
        let summary = self.summary.clone();
        self.summary.clear(self.complete);
        summary
    }

    /// Creates a transaction to save to the Undo/Redo stack
    fn to_transaction(&self) -> Transaction {
        Transaction {
            id: self.transaction_id,
            sequence_num: None,
            operations: self.reverse_operations.clone().into_iter().rev().collect(),
            cursor: self.cursor.clone(),
        }
    }
}
