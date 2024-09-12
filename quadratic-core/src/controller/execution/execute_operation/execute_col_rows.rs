use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};

impl GridController {
    pub fn execute_delete_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumn { sheet_id, column } = op.clone() {
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                let reverse = sheet.delete_column(transaction, column);
                transaction.reverse_operations.extend(reverse);
                transaction.forward_operations.push(op);
            }
        }
    }

    pub fn execute_delete_row(&mut self, _transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteRow { .. /*sheet_id, row*/ } = op {}
    }

    pub fn execute_insert_column(&mut self, _transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertColumn { .. /*sheet_id, column*/ } = op {}
    }

    pub fn execute_insert_row(&mut self, _transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertRow { .. /*sheet_id, row*/ } = op {}
    }

    pub fn execute_move_column(&mut self, _transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::MoveColumn {
            ..
            /*sheet_id,
            column,
            new_column,*/
        } = op
        {}
    }

    pub fn execute_move_row(&mut self, _transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::MoveRow {..
            /*sheet_id,
            row,
            new_row,*/
        } = op
        {}
    }
}
