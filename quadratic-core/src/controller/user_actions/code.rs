use crate::{
    controller::{active_transactions::transaction_name::TransactionName, GridController},
    grid::{CodeCellLanguage, SheetId},
    SheetPos,
};

impl GridController {
    /// Starts a transaction to set a code_cell using user's code_string input
    pub fn set_code_cell(
        &mut self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
        cursor: Option<String>,
    ) {
        let ops = self.set_code_cell_operations(sheet_pos, language, code_string);
        self.start_user_transaction(ops, cursor, TransactionName::SetCode);
    }

    /// Reruns code cells in grid.
    pub fn rerun_all_code_cells(&mut self, cursor: Option<String>) {
        let ops = self.rerun_all_code_cells_operations();
        self.start_user_transaction(ops, cursor, TransactionName::RunCode);
    }

    /// Reruns code cells in a sheet.
    pub fn rerun_sheet_code_cells(&mut self, sheet_id: SheetId, cursor: Option<String>) {
        let ops = self.rerun_sheet_code_cells_operations(sheet_id);
        self.start_user_transaction(ops, cursor, TransactionName::RunCode);
    }

    /// Reruns one code cell
    pub fn rerun_code_cell(&mut self, sheet_pos: SheetPos, cursor: Option<String>) {
        let ops = self.rerun_code_cell_operations(sheet_pos);
        self.start_user_transaction(ops, cursor, TransactionName::RunCode);
    }
}
