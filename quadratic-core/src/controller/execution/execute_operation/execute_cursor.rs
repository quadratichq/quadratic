use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
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
    pub fn execute_set_cursor_selection(
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
    pub fn execute_set_cursor_a1(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetCursorA1 { selection } = op);

        // this op should only be called by a user transaction
        if !transaction.is_user() {
            return;
        }

        if cfg!(target_family = "wasm") && !transaction.is_server() {
            if let Ok(json) = serde_json::to_string(&selection) {
                crate::wasm_bindings::js::jsSetCursorSelection(json);
            }
        } else if cfg!(test) {
            transaction.cursor = Some(serde_json::to_string(&selection).unwrap());
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod test {
    use super::*;
    use crate::{controller::GridController, A1Selection};

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
            transaction.cursor,
            Some(serde_json::to_string(&selection).unwrap())
        );
    }
}
