use crate::{
    controller::active_transactions::pending_transaction::PendingTransaction, grid::Sheet,
};

impl Sheet {
    pub fn move_cols(&mut self, transaction: &mut PendingTransaction, from: Vec<i64>, to: i64) {
        // let value_ops = self.reverse_values_ops_for_column()
    }

    pub fn move_rows(&mut self, transaction: &mut PendingTransaction, from: Vec<i64>, to: i64) {}
}
