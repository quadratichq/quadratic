use crate::{
    controller::{
        GridController, active_transactions::transaction_name::TransactionName,
        operations::operation::Operation,
    },
    grid::{
        SheetId,
        js_types::{JsColumnWidth, JsRowHeight},
    },
};

impl GridController {
    pub fn resize_columns(
        &mut self,
        sheet_id: SheetId,
        column_heights: Vec<JsColumnWidth>,
        cursor: Option<String>,
    ) {
        let ops = vec![Operation::ResizeColumns {
            sheet_id,
            column_heights,
        }];
        self.start_user_transaction(ops, cursor, TransactionName::ResizeColumns);
    }

    pub fn resize_rows(
        &mut self,
        sheet_id: SheetId,
        row_heights: Vec<JsRowHeight>,
        cursor: Option<String>,
    ) {
        let ops = vec![Operation::ResizeRows {
            sheet_id,
            row_heights,
        }];
        self.start_user_transaction(ops, cursor, TransactionName::ResizeRows);
    }
}
