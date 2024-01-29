use crate::{
    controller::{transaction_summary::TransactionSummary, GridController},
    grid::{CodeCellLanguage, SheetId},
    SheetPos,
};

impl GridController {
    /// Starts a transaction to set a code_cell using user's code_string input
    ///
    /// Returns a [`TransactionSummary`].
    pub fn set_code_cell(
        &mut self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
        cursor: Option<String>,
    ) -> TransactionSummary {
        let ops = self.set_code_cell_operations(sheet_pos, language, code_string);
        self.start_user_transaction(ops, cursor)
    }

    /// Reruns code cells in grid.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn rerun_all_code_cells(&mut self) -> TransactionSummary {
        let ops = self.rerun_all_code_cells_operations();
        self.start_user_transaction(ops, None)
    }

    /// Reruns code cells in a sheet.
    ///
    /// Returns a [`TransactionSummary`].
    pub fn rerun_sheet_code_cells(&mut self, sheet_id: SheetId) -> TransactionSummary {
        let ops = self.rerun_sheet_code_cells_operations(sheet_id);
        self.start_user_transaction(ops, None)
    }
}
