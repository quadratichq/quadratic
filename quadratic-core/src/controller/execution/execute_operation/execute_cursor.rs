use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CoordinateTypescript {
    x: i64,
    y: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MultiCursorTypescript {
    origin_position: CoordinateTypescript,
    terminal_position: CoordinateTypescript,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CursorTypescript {
    sheet_id: String,
    keyboard_move_position: CoordinateTypescript,
    cursor_position: CoordinateTypescript,
    multi_cursor: MultiCursorTypescript,
}

impl GridController {
    // Changes the cursor for TransactionSummary.
    pub(crate) fn execute_set_cursor(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        // this op should only be called by a user transaction
        if !transaction.is_user() {
            return;
        }
        if let Operation::SetCursor { sheet_rect } = op {
            let x = sheet_rect.min.x;
            let y = sheet_rect.min.y;
            let cursor = CursorTypescript {
                sheet_id: sheet_rect.sheet_id.to_string(),
                keyboard_move_position: CoordinateTypescript { x, y },
                cursor_position: CoordinateTypescript { x, y },
                multi_cursor: MultiCursorTypescript {
                    origin_position: CoordinateTypescript { x, y },
                    terminal_position: CoordinateTypescript {
                        x: sheet_rect.max.x,
                        y: sheet_rect.max.y,
                    },
                },
            };
            if let Ok(json) = serde_json::to_string(&cursor) {
                transaction.summary.cursor = Some(json);
            }
        }
    }
}

#[cfg(test)]
mod test {
    use std::str::FromStr;

    use super::*;
    use crate::{controller::GridController, grid::SheetId, Pos, SheetRect};

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
        gc.execute_set_cursor(&mut transaction, op);
        assert_eq!(
            transaction.summary.cursor,
            Some(
                r#"{"sheetId":"00000000-0000-0000-0000-000000000000","keyboardMovePosition":{"x":1,"y":2},"cursorPosition":{"x":1,"y":2},"multiCursor":{"originPosition":{"x":1,"y":2},"terminalPosition":{"x":3,"y":4}}}"#.to_string()
            )
        );
    }
}
