use crate::{
    SheetPos,
    a1::A1Selection,
    controller::{GridController, active_transactions::transaction_name::TransactionName},
    grid::{CodeCellLanguage, SheetId},
};

impl GridController {
    /// Starts a transaction to set a code_cell using user's code_string input
    pub fn set_code_cell(
        &mut self,
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
        code_cell_name: Option<String>,
        cursor: Option<String>,
        is_ai: bool,
    ) -> String {
        let ops = self.set_code_cell_operations(sheet_pos, language, code_string, code_cell_name);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetCode, is_ai)
    }

    /// Starts a transaction to set a formula in a range of cells (this is always triggered by the AI)
    pub fn set_formula(
        &mut self,
        selection: A1Selection,
        code_string: String,
        cursor: Option<String>,
    ) -> String {
        let ops = self.set_formula_operations(selection, code_string);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetCode, true)
    }

    /// Reruns code cells in grid.
    pub fn rerun_all_code_cells(&mut self, cursor: Option<String>, is_ai: bool) -> String {
        let ops = self.rerun_all_code_cells_operations();
        self.start_user_ai_transaction(ops, cursor, TransactionName::RunCode, is_ai)
    }

    /// Reruns code cells in a sheet.
    pub fn rerun_sheet_code_cells(
        &mut self,
        sheet_id: SheetId,
        cursor: Option<String>,
        is_ai: bool,
    ) -> String {
        let ops = self.rerun_sheet_code_cells_operations(sheet_id);
        self.start_user_ai_transaction(ops, cursor, TransactionName::RunCode, is_ai)
    }

    /// Reruns one code cell
    pub fn rerun_code_cell(
        &mut self,
        selection: A1Selection,
        cursor: Option<String>,
        is_ai: bool,
    ) -> String {
        let ops = self.rerun_code_cell_operations(selection);
        self.start_user_ai_transaction(ops, cursor, TransactionName::RunCode, is_ai)
    }

    pub fn set_chart_size(
        &mut self,
        sheet_pos: SheetPos,
        columns: u32,
        rows: u32,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = self.set_chart_size_operations(sheet_pos, columns, rows);
        self.start_user_ai_transaction(ops, cursor, TransactionName::SetFormats, is_ai);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_util::*;

    #[test]
    fn test_grid_formula_results() {
        let mut g = GridController::default();

        let sheet_id = g.sheet_ids()[0];

        g.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "=2 / {1;2;0}".to_owned(),
            None,
            None,
            false,
        );
        g.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "=A1:A3".to_owned(),
            None,
            None,
            false,
        );
        g.set_cell_value(
            pos![C1].to_sheet_pos(sheet_id),
            "meow".to_string(),
            None,
            false,
        );
        g.rerun_all_code_cells(None, false);

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

    #[test]
    fn test_set_code_cell_with_table_name() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set a code cell with a table name
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "=SUM(1, 2)".to_owned(),
            Some("MyCode".to_string()),
            None,
            false,
        );

        let dt = gc.data_table_at(pos![sheet_id!A1]).unwrap();
        assert_eq!(dt.name(), "MyCode".to_string());

        // Set a code cell with a table name
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "=SUM(1, 2)".to_owned(),
            Some("NameShouldNotChange".to_string()),
            None,
            false,
        );

        let dt = gc.data_table_at(pos![sheet_id!A1]).unwrap();
        assert_eq!(dt.name(), "MyCode".to_string());
    }

    #[test]
    fn test_set_formula() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_set_values(&mut gc, sheet_id, pos![A1], 1, 5);

        gc.set_formula(A1Selection::test_a1("B1:B5"), "=A1".to_owned(), None);
        assert_cell_value_col(&gc, sheet_id, 2, 1, 5, vec!["0", "1", "2", "3", "4"]);

        gc.set_formula(A1Selection::test_a1("C1:C5"), "=A$1".to_owned(), None);
        assert_cell_value_col(&gc, sheet_id, 3, 1, 5, vec!["0", "0", "0", "0", "0"]);
    }

    #[test]
    fn test_set_formula_inside_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 5, 5);

        let ops = gc.set_formula_operations(A1Selection::test_a1("B1:B5"), "=A1".to_owned());
        assert!(ops.is_empty());

        let ops = gc.set_formula_operations(A1Selection::test_a1("A10:A11"), "=A1".to_owned());
        // 2 formulas × 1 SetComputeCode op each = 2 ops
        assert_eq!(ops.len(), 2);
    }
}
