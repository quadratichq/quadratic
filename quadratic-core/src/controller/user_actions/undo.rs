use crate::controller::{
    execution::TransactionType, transaction_summary::TransactionSummary, GridController,
};

impl GridController {
    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    pub fn undo(&mut self, cursor: Option<String>) -> TransactionSummary {
        if let Some(transaction) = self.undo_stack.pop() {
            self.start_undo_transaction(&transaction, TransactionType::Undo, cursor)
        } else {
            TransactionSummary::default()
        }
    }
    pub fn redo(&mut self, cursor: Option<String>) -> TransactionSummary {
        if let Some(transaction) = self.redo_stack.pop() {
            self.start_undo_transaction(&transaction, TransactionType::Redo, cursor)
        } else {
            TransactionSummary::default()
        }
    }
}
