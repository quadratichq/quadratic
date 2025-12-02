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
        is_ai: bool,
    ) {
        let ops = vec![Operation::ResizeColumns {
            sheet_id,
            column_widths,
        }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ResizeColumns, is_ai);
    }

    pub fn resize_rows(
        &mut self,
        sheet_id: SheetId,
        row_heights: Vec<JsRowHeight>,
        cursor: Option<String>,
        is_ai: bool,
        client_resized: bool,
    ) {
        let ops = vec![Operation::ResizeRows {
            sheet_id,
            row_heights,
            client_resized,
        }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ResizeRows, is_ai);
    }

    pub fn resize_all_columns(
        &mut self,
        sheet_id: SheetId,
        size: f64,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = vec![Operation::DefaultColumnSize { sheet_id, size }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ResizeColumns, is_ai);
    }

    pub fn resize_all_rows(
        &mut self,
        sheet_id: SheetId,
        size: f64,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = vec![Operation::DefaultRowSize { sheet_id, size }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ResizeRows, is_ai);
    }
}
