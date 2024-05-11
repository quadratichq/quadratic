use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};

impl GridController {
    pub fn execute_delete_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumn { sheet_id, column } = op {
            if let Some(sheet) = self.try_sheet(sheet_id) {}
        }
    }

    pub fn execute_delete_row(
        &mut self,
        _transaction: &mut PendingTransaction,
        _op: Operation,
        _row: i64,
    ) {
        todo!()
    }

    pub fn execute_insert_column(
        &mut self,
        _transaction: &mut PendingTransaction,
        _op: Operation,
        _column: i64,
    ) {
        todo!();
    }

    pub fn execute_insert_row(
        &mut self,
        _transaction: &mut PendingTransaction,
        _op: Operation,
        _row: i64,
    ) {
        todo!();
    }

    pub fn execute_move_column(
        &mut self,
        transaction: &mut PendingTransaction,
        _op: Operation,
        _column: i64,
        _to: i64,
    ) {
        todo!();
    }

    pub fn execute_move_row(
        &mut self,
        transaction: &mut PendingTransaction,
        _op: Operation,
        _row: i64,
        _to: i64,
    ) {
        todo!();
    }
}
