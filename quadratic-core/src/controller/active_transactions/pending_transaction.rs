//! This module provides a pending transaction
//!
//! It is responsible for:
//! * tracking the state of a pending transaction
//! * converting pending transaction to a completed transaction

use std::collections::{HashMap, HashSet, VecDeque};

use uuid::Uuid;

use crate::{
    controller::{
        execution::TransactionType, operations::operation::Operation, transaction::Transaction,
    },
    grid::{CodeCellLanguage, SheetId},
    SheetPos, SheetRect,
};

use super::transaction_name::TransactionName;

#[derive(Debug, Clone, PartialEq)]
pub struct PendingTransaction {
    pub id: Uuid,

    // a name for the transaction for user display purposes
    pub transaction_name: TransactionName,

    // cursor sent as part of this transaction
    pub cursor: Option<String>,

    pub transaction_type: TransactionType,

    // pending operations
    pub operations: VecDeque<Operation>,

    // undo operations
    pub reverse_operations: Vec<Operation>,

    // list of operations to share with other players
    pub forward_operations: Vec<Operation>,

    // tracks whether there are any async calls (which changes how the transaction is finalized)
    pub has_async: i64,

    // used by Code Cell execution to track dependencies
    pub cells_accessed: HashSet<SheetRect>,

    // save code_cell info for async calls
    pub current_sheet_pos: Option<SheetPos>,

    // whether we are awaiting an async call
    pub waiting_for_async: Option<CodeCellLanguage>,

    // whether transaction is complete
    pub complete: bool,

    // whether to generate a thumbnail after transaction completes
    pub generate_thumbnail: bool,

    // cursor saved for an Undo or Redo
    pub cursor_undo_redo: Option<String>,

    pub resize_rows: HashMap<SheetId, HashSet<i64>>,
}

impl Default for PendingTransaction {
    fn default() -> Self {
        PendingTransaction {
            id: Uuid::new_v4(),
            transaction_name: TransactionName::Unknown,
            // sheet_id: None,
            // rect: None,
            cursor: None,
            transaction_type: TransactionType::User,
            operations: VecDeque::new(),
            reverse_operations: Vec::new(),
            forward_operations: Vec::new(),
            has_async: 0,
            cells_accessed: HashSet::new(),
            current_sheet_pos: None,
            waiting_for_async: None,
            complete: false,
            generate_thumbnail: false,
            cursor_undo_redo: None,
            resize_rows: HashMap::new(),
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

    /// Sends the transaction to the multiplayer server (if needed)
    pub fn send_transaction(&self) {
        if self.complete
            && self.is_user_undo_redo()
            && (cfg!(target_family = "wasm") || cfg!(test))
            && !self.is_server()
        {
            let transaction_id = self.id.to_string();
            match serde_json::to_string(&self.forward_operations) {
                Ok(ops) => {
                    crate::wasm_bindings::js::jsSendTransaction(transaction_id, ops);
                }
                Err(e) => {
                    dbgjs!(format!("Failed to serialize forward operations: {}", e));
                }
            };

            if self.is_undo_redo() {
                if let Some(cursor) = &self.cursor_undo_redo {
                    crate::wasm_bindings::js::jsSetCursor(cursor.clone());
                }
            }

            if self.generate_thumbnail {
                crate::wasm_bindings::js::jsGenerateThumbnail();
            }
        }
    }

    pub fn is_server(&self) -> bool {
        matches!(self.transaction_type, TransactionType::Server)
    }

    pub fn is_user(&self) -> bool {
        matches!(self.transaction_type, TransactionType::User)
            || matches!(self.transaction_type, TransactionType::Unsaved)
    }

    pub fn is_undo_redo(&self) -> bool {
        matches!(self.transaction_type, TransactionType::Undo)
            || matches!(self.transaction_type, TransactionType::Redo)
    }

    pub fn is_user_undo_redo(&self) -> bool {
        self.is_user() || self.is_undo_redo()
    }

    pub fn is_multiplayer(&self) -> bool {
        matches!(self.transaction_type, TransactionType::Multiplayer)
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::operations::operation::Operation, grid::SheetId};

    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
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
        transaction
            .forward_operations
            .clone_from(&forward_operations);
        let reverse_operations = vec![
            Operation::SetSheetName { sheet_id, name },
            Operation::SetSheetColor {
                sheet_id,
                color: None,
            },
        ];
        transaction
            .reverse_operations
            .clone_from(&reverse_operations);
        let forward_transaction = transaction.to_forward_transaction();
        assert_eq!(forward_transaction.id, transaction.id);
        assert_eq!(forward_transaction.operations, forward_operations);
        assert_eq!(forward_transaction.sequence_num, None);

        let reverse_transaction = transaction.to_undo_transaction();
        assert_eq!(reverse_transaction.id, transaction.id);
        assert_eq!(reverse_transaction.operations, reverse_operations);
        assert_eq!(reverse_transaction.sequence_num, None);
    }

    #[test]
    fn is_user() {
        let transaction = PendingTransaction {
            transaction_type: TransactionType::User,
            ..Default::default()
        };
        assert!(transaction.is_user());

        let transaction = PendingTransaction {
            transaction_type: TransactionType::Unsaved,
            ..Default::default()
        };
        assert!(transaction.is_user());

        let transaction = PendingTransaction {
            transaction_type: TransactionType::Server,
            ..Default::default()
        };
        assert!(!transaction.is_user());
    }
}
