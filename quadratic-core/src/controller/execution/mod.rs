/// This module handles the application of operations to the Grid.
///
pub mod control_transaction;
pub mod execute_operation;
pub mod receive_multiplayer;
pub mod run_code;
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
                serde_json::to_string(&self.to_undo_transaction())
                    .expect("Failed to serialize forward operations"),
            );
        }
        let summary = self.summary.clone();
        self.summary.clear(self.complete);
        summary
    }

    fn to_forward_transaction(&self) -> Transaction {
        Transaction {
            id: self.transaction_id,
            sequence_num: None,
            operations: self.forward_operations.clone().into_iter().collect(),
            cursor: None,
        }
    }

    /// Creates a transaction to save to the Undo/Redo stack
    fn to_undo_transaction(&self) -> Transaction {
        Transaction {
            id: self.transaction_id,
            sequence_num: None,
            operations: self.reverse_operations.clone().into_iter().rev().collect(),
            cursor: self.cursor.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::controller::operations::operation::Operation;

    use super::*;

    #[test]
    fn test_to_transaction() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid.try_sheet_from_id(sheet_id).unwrap();
        let name = sheet.name.clone();

        let transaction_id = Uuid::new_v4();
        gc.transaction_id = transaction_id;
        let forward_operations = vec![
            Operation::SetSheetName {
                sheet_id,
                name: "new name".to_string(),
            },
            Operation::SetSheetColor {
                sheet_id,
                color: Some("red".to_string()),
            },
        ];
        gc.forward_operations = forward_operations.clone();
        let reverse_operations = vec![
            Operation::SetSheetName { sheet_id, name },
            Operation::SetSheetColor {
                sheet_id,
                color: None,
            },
        ];
        gc.reverse_operations = reverse_operations.clone();
        let forward_transaction = gc.to_forward_transaction();
        assert_eq!(forward_transaction.id, transaction_id);
        assert_eq!(forward_transaction.operations, forward_operations);
        assert_eq!(forward_transaction.sequence_num, None);

        let reverse_transaction = gc.to_undo_transaction();
        assert_eq!(reverse_transaction.id, transaction_id);
        assert_eq!(
            reverse_transaction.operations,
            reverse_operations
                .iter()
                .map(|s| s.clone())
                .rev()
                .collect::<Vec<_>>()
        );
        assert_eq!(reverse_transaction.sequence_num, None);
    }
}
