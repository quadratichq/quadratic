use std::collections::VecDeque;

use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};

impl GridController {
    pub fn execute_delete_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumn { sheet_id, column } = op {
            if (transaction.is_user_undo_redo()) {
                let mut operations = VecDeque::new();
                let (forward, reverse) = self.delete_column_operations(sheet_id, column);
                operations.extend(forward.clone());
                operations.extend(transaction.operations.drain(..));
                transaction.operations = operations;
                transaction.reverse_operations.extend(reverse);
                transaction.forward_operations.extend(forward);
            }

            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.delete_column(column);
            }
        }
    }

    pub fn execute_delete_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        todo!()
    }

    pub fn execute_insert_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        todo!();
    }

    pub fn execute_insert_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        todo!();
    }

    pub fn execute_move_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        todo!();
    }

    pub fn execute_move_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        todo!();
    }
}
