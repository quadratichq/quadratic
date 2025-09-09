use uuid::Uuid;

use crate::controller::{GridController, execution::TransactionSource};

impl GridController {
    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    // undo multiple transactions (used by ai)
    pub fn undo_count(&mut self, count: usize, cursor: Option<String>) -> Option<String> {
        if self.undo_stack.is_empty() {
            return Some("No undo available".to_string());
        }
        if let Some(mut transaction) = self.undo_stack.pop() {
            // we need to assign the transaction a new id to avoid conflicts with the original transaction.
            transaction.id = Uuid::new_v4();
            for _ in 1..count {
                if let Some(next) = self.undo_stack.pop() {
                    transaction.operations.extend(next.operations);
                }
            }
            self.start_undo_transaction(transaction, TransactionSource::Undo, cursor);
        }
        None
    }

    pub fn undo(&mut self, cursor: Option<String>) -> Option<String> {
        if self.undo_stack.is_empty() {
            return Some("No undo available".to_string());
        }
        if let Some(mut transaction) = self.undo_stack.pop() {
            // we need to assign the transaction a new id to avoid conflicts with the original transaction.
            transaction.id = Uuid::new_v4();
            self.start_undo_transaction(transaction, TransactionSource::Undo, cursor);
        }
        None
    }
    pub fn redo(&mut self, cursor: Option<String>) -> Option<String> {
        if self.redo_stack.is_empty() {
            return Some("No redo available".to_string());
        }
        if let Some(mut transaction) = self.redo_stack.pop() {
            // we need to assign the transaction a new id to avoid conflicts with the original transaction.
            transaction.id = Uuid::new_v4();
            self.start_undo_transaction(transaction, TransactionSource::Redo, cursor);
        }
        None
    }
}
