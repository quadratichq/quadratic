use crate::controller::{
    GridController, active_transactions::pending_transaction::PendingTransaction,
    operations::operation::Operation,
};

impl GridController {
    /// **Deprecated** Nov 2024 in favor of [`Self::execute_set_cursor_a1()`].
    pub(crate) fn execute_set_cursor(
        &mut self,
        _transaction: &mut PendingTransaction,
        _op: Operation,
    ) {
        // Since it's deprecated and is only used in User transactions, we can safely ignore it.

        // old code:
        // unwrap_op!(let SetCursor { sheet_rect } = op);

        // let selection = A1Selection::from_rect(sheet_rect);
        // self.execute_set_cursor_a1(transaction, Operation::SetCursorA1 { selection });
    }

    /// **Deprecated** Nov 2024 in favor of [`Self::execute_set_cursor_a1()`].
    pub(crate) fn execute_set_cursor_selection(
        &mut self,
        _transaction: &mut PendingTransaction,
        _op: Operation,
    ) {
        // Since it's deprecated and is only used in User transactions, we can safely ignore it.

        // old code:
        // unwrap_op!(let SetCursorSelection { selection } = op);

        // let selection = A1Selection::from(selection);
        // self.execute_set_cursor_a1(transaction, Operation::SetCursorA1 { selection });
    }

    /// Applies an [`Operation::SetCursorA1`] to `transaction`.
    pub(crate) fn execute_set_cursor_a1(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetCursorA1 { selection } = op);

        // this op should only be called by a user transaction
        if transaction.is_user_ai() && (cfg!(target_family = "wasm") || cfg!(test)) {
            transaction.add_update_selection(selection);
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{a1::A1Selection, controller::GridController};

    #[test]
    fn test_execute_set_cursor_a1() {
        let mut gc = GridController::test();
        let selection = A1Selection::test_a1("A1:B2");

        let mut transaction = PendingTransaction::default();
        let op = Operation::SetCursorA1 {
            selection: selection.clone(),
        };

        gc.execute_set_cursor_a1(&mut transaction, op);

        assert_eq!(
            transaction.update_selection,
            Some(serde_json::to_string(&selection).unwrap())
        );
    }
}
