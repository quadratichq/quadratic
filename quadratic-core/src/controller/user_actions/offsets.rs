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
        column_widths: Vec<JsColumnWidth>,
        cursor: Option<String>,
    ) {
        let ops = vec![Operation::ResizeColumns {
            sheet_id,
            column_widths,
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

    pub fn resize_all_columns(&mut self, sheet_id: SheetId, size: f64, cursor: Option<String>) {
        let ops = vec![Operation::DefaultColumnSize { sheet_id, size }];
        self.start_user_transaction(ops, cursor, TransactionName::ResizeColumns);
    }

    pub fn resize_all_rows(&mut self, sheet_id: SheetId, size: f64, cursor: Option<String>) {
        let ops = vec![Operation::DefaultRowSize { sheet_id, size }];
        self.start_user_transaction(ops, cursor, TransactionName::ResizeRows);
    }
}
