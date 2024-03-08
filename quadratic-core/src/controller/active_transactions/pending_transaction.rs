//! This module provides a pending transaction
//!
//! It is responsible for:
//! * tracking the state of a pending transaction
//! * converting pending transaction to a completed transaction

use std::collections::{HashSet, VecDeque};

use uuid::Uuid;

use crate::{
    controller::{
        execution::TransactionType, operations::operation::Operation, transaction::Transaction,
        transaction_summary::TransactionSummary,
    },
    grid::{CodeCellLanguage, SheetId},
    SheetPos, SheetRect,
};

#[derive(Debug, Clone, PartialEq)]
pub struct PendingTransaction {
    pub id: Uuid,

    pub cursor: Option<String>,
    pub transaction_type: TransactionType,

    // pending operations
    pub operations: VecDeque<Operation>,

    // undo operations
    pub reverse_operations: Vec<Operation>,

    // list of operations to share with other players
    pub forward_operations: Vec<Operation>,

    // tracks sheets that will need updated bounds calculations
    pub sheets_with_dirty_bounds: HashSet<SheetId>,

    // tracks whether there are any async calls (which changes how the transaction is finalized)
    pub has_async: bool,

    // tracks the TransactionSummary to return to the TS client for (mostly) rendering updates
    pub summary: TransactionSummary,

    // used by Code Cell execution to track dependencies
    pub cells_accessed: HashSet<SheetRect>,

    // save code_cell info for async calls
    pub current_sheet_pos: Option<SheetPos>,

    // whether we are awaiting an async call
    pub waiting_for_async: Option<CodeCellLanguage>,

    // whether transaction is complete
    pub complete: bool,
}

impl Default for PendingTransaction {
    fn default() -> Self {
        PendingTransaction {
            id: Uuid::new_v4(),
            cursor: None,
            transaction_type: TransactionType::User,
            operations: VecDeque::new(),
            reverse_operations: Vec::new(),
            forward_operations: Vec::new(),
            sheets_with_dirty_bounds: HashSet::new(),
            has_async: false,
            summary: TransactionSummary::default(),
            cells_accessed: HashSet::new(),
            current_sheet_pos: None,
            waiting_for_async: None,
            complete: false,
        }
    }
}

impl PendingTransaction {
    pub fn to_transaction(&self, sequence_num: Option<u64>) -> Transaction {
        Transaction {
            id: self.id,
            sequence_num,
            operations: self.operations.clone().into(),
            cursor: self.cursor.clone(),
        }
    }

    /// Creates a transaction to share in multiplayer
    pub fn to_forward_transaction(&self) -> Transaction {
        Transaction {
            id: self.id,
            sequence_num: None,
            operations: self.forward_operations.clone(),
            cursor: None,
        }
    }

    /// Creates a transaction to save to the Undo/Redo stack
    pub fn to_undo_transaction(&self) -> Transaction {
        Transaction {
            id: self.id,
            sequence_num: None,
            operations: self.reverse_operations.clone(),
            cursor: self.cursor.clone(),
        }
    }

    /// returns the TransactionSummary
    pub fn prepare_summary(&mut self, complete: bool) -> TransactionSummary {
        if complete && self.is_user_undo_redo() {
            self.summary.transaction_id = Some(self.id.to_string());
            self.summary.operations = Some(
                serde_json::to_string(&self.forward_operations)
                    .expect("Failed to serialize forward operations"),
            );
        }
        let mut summary = self.summary.clone();
        summary.save = complete;
        self.summary.clear(complete);
        summary
    }

    pub fn is_user(&self) -> bool {
        matches!(self.transaction_type, TransactionType::User)
    }

    pub fn is_undo_redo(&self) -> bool {
        matches!(self.transaction_type, TransactionType::Undo)
            || matches!(self.transaction_type, TransactionType::Redo)
    }

    pub fn is_user_undo_redo(&self) -> bool {
        self.is_user() || self.is_undo_redo()
    }
}

#[cfg(test)]
mod tests {
    use crate::controller::operations::operation::Operation;

    use super::*;

    #[test]
    fn test_to_transaction() {
        let sheet_id = SheetId::new();
        let name = "Sheet 1".to_string();

        let mut transaction = PendingTransaction::default();
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
        transaction.forward_operations = forward_operations.clone();
        let reverse_operations = vec![
            Operation::SetSheetName { sheet_id, name },
            Operation::SetSheetColor {
                sheet_id,
                color: None,
            },
        ];
        transaction.reverse_operations = reverse_operations.clone();
        let forward_transaction = transaction.to_forward_transaction();
        assert_eq!(forward_transaction.id, transaction.id);
        assert_eq!(forward_transaction.operations, forward_operations);
        assert_eq!(forward_transaction.sequence_num, None);

        let reverse_transaction = transaction.to_undo_transaction();
        assert_eq!(reverse_transaction.id, transaction.id);
        assert_eq!(reverse_transaction.operations, reverse_operations);
        assert_eq!(reverse_transaction.sequence_num, None);
    }
}
