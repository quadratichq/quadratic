pub mod compute;
pub mod control_transaction;
pub mod eval_formula;
/// This module handles the application of operations to the Grid.
///
pub mod execute_operation;
pub mod get_cells;
use serde::{Deserialize, Serialize};

use crate::controller::{transaction_summary::TransactionSummary, GridController};

use super::Transaction;

#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TransactionType {
    #[default]
    Unset,
    Normal,
    Undo,
    Redo,
    Multiplayer,
}

impl GridController {
    /// Clear the `cells_to_compute` attribute
    pub fn clear_cells_to_compute(&mut self) {
        self.cells_to_compute.clear();
    }

    /// recalculate bounds for changed sheets
    pub fn transaction_updated_bounds(&mut self) {
        self.sheets_with_changed_bounds
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
            self.summary.forward_operations = Some(
                serde_json::to_string(&self.forward_operations)
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
            operations: self.reverse_operations.clone().into_iter().rev().collect(),
            cursor: self.cursor.clone(),
        }
    }
}
