use uuid::Uuid;

use super::GridController;
use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    error_core::Result,
    grid::{js_types::JsRowHeight, SheetId},
};

impl GridController {
    pub fn start_auto_resize_row_heights(
        &self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        rows: Vec<i64>,
    ) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || !transaction.is_user() {
            return;
        }

        if let Some(sheet) = self.try_sheet(sheet_id) {
            let auto_resize_rows = sheet.get_auto_resize_rows(rows);
            if auto_resize_rows.is_empty() {
                return;
            }
            if let Ok(rows_string) = serde_json::to_string(&auto_resize_rows) {
                crate::wasm_bindings::js::jsRequestRowHeights(
                    transaction.id.to_string(),
                    sheet_id.to_string(),
                    rows_string,
                );
                // don't set has_async in test mode,
                // as we will not receive renderer callback during tests and the transaction will never complete
                if !cfg!(test) {
                    transaction.has_async = true;
                }
            } else {
                dbgjs!("[control_transactions] start_auto_resize_row_heights: Failed to serialize auto resize rows");
            }
        } else {
            dbgjs!("[control_transactions] start_auto_resize_row_heights: Sheet not found");
        }
    }

    pub fn complete_auto_resize_row_heights(
        &mut self,
        transaction_id: Uuid,
        sheet_id: SheetId,
        row_heights: Vec<JsRowHeight>,
    ) -> Result<()> {
        let mut transaction = self.transactions.remove_awaiting_async(transaction_id)?;
        if !row_heights.is_empty() {
            transaction.operations.push_back(Operation::ResizeRows {
                sheet_id,
                row_heights,
            });
        }
        transaction.has_async = false;
        self.start_transaction(&mut transaction);
        self.finalize_transaction(&mut transaction);
        Ok(())
    }
}

#[cfg(test)]
mod tests {}