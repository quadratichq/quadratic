use std::collections::HashSet;

use chrono::Utc;

use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    grid::{CodeRun, CodeRunResult},
    SheetPos,
};

impl GridController {
    pub(crate) fn run_connector(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
    ) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            crate::wasm_bindings::js::jsConnector(code);
        }

        transaction.current_sheet_pos = Some(sheet_pos);
        let value = crate::Value::Single(crate::CellValue::Text("hello".to_string()));

        let new_code_run = CodeRun {
            std_out: None,
            std_err: None,
            formatted_code_string: None,
            spill_error: false,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            result: CodeRunResult::Ok(value),
            return_type: None,
            line_number: None,
            output_type: None,
        };
        self.finalize_code_run(transaction, sheet_pos, Some(new_code_run), None);
    }
}
