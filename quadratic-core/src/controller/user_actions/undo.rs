use uuid::Uuid;

use crate::controller::{GridController, execution::TransactionSource};

impl GridController {
    pub(crate) fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub(crate) fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    pub fn undo(&mut self, count: usize, cursor: Option<String>, is_ai: bool) -> String {
        if self.undo_stack.is_empty() {
            return "No undo available".to_string();
        }

        let mut actual_count = 1;

        if let Some(mut transaction) = self.undo_stack.pop() {
            // we need to assign the transaction a new id to avoid conflicts with the original transaction.
            transaction.id = Uuid::new_v4();
            for _ in 1..count {
                if let Some(next) = self.undo_stack.pop() {
                    transaction.operations.extend(next.operations);
                    actual_count += 1;
                }
            }
            let source = if is_ai {
                TransactionSource::UndoAI
            } else {
                TransactionSource::Undo
            };
            self.start_undo_transaction(transaction, source, cursor);
        }

        if actual_count == count {
            format!("Undo successful, undid {actual_count} transactions")
        } else {
            format!(
                "Undo successful, Undo stack had only {actual_count} transactions, so only undid {actual_count} transactions",
            )
        }
    }

    pub fn redo(&mut self, count: usize, cursor: Option<String>, is_ai: bool) -> String {
        if self.redo_stack.is_empty() {
            return "No redo available".to_string();
        }

        let mut actual_count = 1;

        if let Some(mut transaction) = self.redo_stack.pop() {
            // we need to assign the transaction a new id to avoid conflicts with the original transaction.
            transaction.id = Uuid::new_v4();
            for _ in 1..count {
                if let Some(next) = self.redo_stack.pop() {
                    transaction.operations.extend(next.operations);
                    actual_count += 1;
                }
            }
            let source = if is_ai {
                TransactionSource::RedoAI
            } else {
                TransactionSource::Redo
            };
            self.start_undo_transaction(transaction, source, cursor);
        }

        if actual_count == count {
            format!("Redo successful, redid {actual_count} transactions")
        } else {
            format!(
                "Redo successful, Redo stack had only {actual_count} transactions, so only redid {actual_count} transactions",
            )
        }
    }
}
