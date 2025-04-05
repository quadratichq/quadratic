use crate::{
    a1::A1Context, controller::active_transactions::pending_transaction::PendingTransaction,
    grid::Sheet,
};

impl Sheet {
    pub fn delete_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        columns: Vec<i64>,
        a1_context: &A1Context,
    ) {
        let mut columns = columns.clone();
        columns.sort_unstable();
        columns.dedup();
        columns.reverse();

        for column in columns {
            self.delete_column(transaction, column, a1_context);
        }
        self.recalculate_bounds(a1_context);
    }

    pub fn delete_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        rows: Vec<i64>,
        a1_context: &A1Context,
    ) {
        let mut rows = rows.clone();
        rows.sort_unstable();
        rows.dedup();
        rows.reverse();

        for row in rows {
            self.delete_row(transaction, row, a1_context);
        }
        self.recalculate_bounds(a1_context);
    }
}
