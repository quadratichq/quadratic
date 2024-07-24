use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    grid::{CodeCellLanguage, ConnectionKind},
    SheetPos,
};

impl GridController {
    pub(crate) fn run_connection(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
        kind: ConnectionKind,
        id: String,
    ) {
        // send the request to get the sql data via the connector to the host
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            crate::wasm_bindings::js::jsConnection(
                transaction.id.to_string(),
                sheet_pos.x as i32,
                sheet_pos.y as i32,
                sheet_pos.sheet_id.to_string(),
                code,
                kind,
                id.to_owned(),
            );
        }

        // stop the computation cycle until async returns
        transaction.current_sheet_pos = Some(sheet_pos);
        transaction.waiting_for_async = Some(CodeCellLanguage::Connection { kind, id });
        self.transactions.add_async_transaction(transaction);
    }
}
