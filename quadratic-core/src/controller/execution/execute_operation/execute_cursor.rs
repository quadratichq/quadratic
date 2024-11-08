use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};
use crate::A1Selection;

impl GridController {
    /// **Deprecated** Nov 2024 in favor of [`Self::execute_set_cursor_a1()`].
    pub(crate) fn execute_set_cursor(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetCursor { sheet_rect } = op);

        let selection = A1Selection::from_rect(sheet_rect);
        self.execute_set_cursor_a1(transaction, Operation::SetCursorA1 { selection });
    }

    /// **Deprecated** Nov 2024 in favor of [`Self::execute_set_cursor_a1()`].
    pub fn execute_set_cursor_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetCursorSelection { selection } = op);

        let selection = A1Selection::from(selection);
        self.execute_set_cursor_a1(transaction, Operation::SetCursorA1 { selection });
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
    use std::str::FromStr;

    use super::*;
    use crate::{controller::GridController, grid::SheetId, OldSelection, Pos, Rect, SheetRect};

    #[test]
    fn test_execute_set_cursor() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        let op = Operation::SetCursor {
            sheet_rect: SheetRect {
                sheet_id: SheetId::from_str("00000000-0000-0000-0000-000000000000").unwrap(),
                min: Pos { x: 1, y: 2 },
                max: Pos { x: 3, y: 4 },
            },
        };

        gc.execute_operation(&mut transaction, op);
        assert_eq!(
            transaction.cursor,
            Some(
                r#"{"sheet":{"id":"00000000-0000-0000-0000-000000000000"},"cursor":{"x":1,"y":2},"ranges":[{"start":{"col":{"coord":1,"is_absolute":false},"row":{"coord":2,"is_absolute":false}},"end":{"col":{"coord":3,"is_absolute":false},"row":{"coord":4,"is_absolute":false}}}]}"#.to_string()
            )
        );
    }

    #[test]
    fn test_execute_set_cursor_selection() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        let op = Operation::SetCursorSelection {
            selection: OldSelection {
                sheet_id: SheetId::TEST,
                x: 1,
                y: 2,
                rects: Some(vec![Rect::new(1, 2, 3, 4)]),
                rows: None,
                columns: None,
                all: false,
            },
        };

        gc.execute_operation(&mut transaction, op);
        assert_eq!(
            transaction.cursor,
            Some(
                r#"{"sheet":{"id":"00000000-0000-0000-0000-000000000000"},"cursor":{"x":1,"y":2},"ranges":[{"start":{"col":{"coord":1,"is_absolute":false},"row":{"coord":2,"is_absolute":false}},"end":{"col":{"coord":3,"is_absolute":false},"row":{"coord":4,"is_absolute":false}}}]}"#.to_string()
            )
        );
    }
}
