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

    pub fn set_chart_dimensions(
        &mut self,
        sheet_pos: SheetPos,
        width: i32,
        height: i32,
        cursor: Option<String>,
    ) {
        let ops = self.set_chart_dimensions_operations(sheet_pos, width, height);
        self.start_user_transaction(ops, cursor, TransactionName::SetFormats);
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_grid_formula_results() {
        let mut g = GridController::default();

        let sheet_id = g.sheet_ids()[0];

        g.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "=2 / {1;2;0}".to_owned(),
            None,
        );
        g.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "=A1:A3".to_owned(),
            None,
        );
        g.set_cell_value(pos![C1].to_sheet_pos(sheet_id), "meow".to_string(), None);
        g.rerun_all_code_cells(None);

        let sheet = g.try_sheet(sheet_id).unwrap();
        let get_cell = |pos| {
            let val = sheet.get_cell_for_formula(pos);
            println!("{pos} contains {val:?}", pos = pos.a1_string());
            val
        };

        assert!(matches!(get_cell(pos![A1]), crate::CellValue::Number(_)));
        assert!(matches!(get_cell(pos![A2]), crate::CellValue::Number(_)));
        assert!(matches!(get_cell(pos![A3]), crate::CellValue::Error(_)));
        assert!(matches!(get_cell(pos![B1]), crate::CellValue::Number(_)));
        assert!(matches!(get_cell(pos![B2]), crate::CellValue::Number(_)));
        assert!(matches!(get_cell(pos![B3]), crate::CellValue::Error(_)));
        assert!(matches!(get_cell(pos![C1]), crate::CellValue::Text(_)));
        assert!(matches!(get_cell(pos![C2]), crate::CellValue::Blank));
    }
}
