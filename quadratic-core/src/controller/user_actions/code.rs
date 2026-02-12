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

    /// Starts a transaction to set multiple formulas at once (batched, single transaction)
    pub fn set_formulas(
        &mut self,
        formulas: Vec<(A1Selection, String)>,
        cursor: Option<String>,
    ) -> String {
        let ops = formulas
            .into_iter()
            .flat_map(|(selection, code_string)| {
                self.set_formula_operations(selection, code_string)
            })
            .collect();
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

        // Use a formula that produces multi-cell output so it stays as DataTable (1x1 becomes CellValue::Code)
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "{1;2}".to_owned(), // 1x2 array output
            Some("MyCode".to_string()),
            None,
            false,
        );

        let dt = gc.data_table_at(pos![sheet_id!A1]).unwrap();
        assert_eq!(dt.name(), "MyCode".to_string());

        // Set a code cell with a table name - existing name should be preserved
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "{1;2}".to_owned(),
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

    #[test]
    fn test_set_formulas_batched() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set some initial values
        test_set_values(&mut gc, sheet_id, pos![A1], 1, 5);

        // Set multiple formulas at once using the batched function
        gc.set_formulas(
            vec![
                (A1Selection::test_a1("B1"), "=A1*2".to_owned()),
                (A1Selection::test_a1("B2"), "=A2*3".to_owned()),
                (A1Selection::test_a1("B3"), "=A3+10".to_owned()),
            ],
            None,
        );

        // Verify all formulas were applied correctly
        // A1=0, A2=1, A3=2, A4=3, A5=4
        assert_display_cell_value(&gc, sheet_id, 2, 1, "0"); // B1 = A1*2 = 0*2 = 0
        assert_display_cell_value(&gc, sheet_id, 2, 2, "3"); // B2 = A2*3 = 1*3 = 3
        assert_display_cell_value(&gc, sheet_id, 2, 3, "12"); // B3 = A3+10 = 2+10 = 12
    }

    #[test]
    fn test_set_formulas_single_undo() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set some initial values
        test_set_values(&mut gc, sheet_id, pos![A1], 1, 3);

        // Set multiple formulas at once
        gc.set_formulas(
            vec![
                (A1Selection::test_a1("B1"), "=A1+1".to_owned()),
                (A1Selection::test_a1("B2"), "=A2+1".to_owned()),
                (A1Selection::test_a1("B3"), "=A3+1".to_owned()),
            ],
            None,
        );

        // Verify formulas were applied
        assert_display_cell_value(&gc, sheet_id, 2, 1, "1"); // B1 = A1+1 = 0+1 = 1
        assert_display_cell_value(&gc, sheet_id, 2, 2, "2"); // B2 = A2+1 = 1+1 = 2
        assert_display_cell_value(&gc, sheet_id, 2, 3, "3"); // B3 = A3+1 = 2+1 = 3

        // Single undo should remove all formulas (since they were in one transaction)
        gc.undo(1, None, false);

        // All formula cells should now be blank
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert!(sheet.cell_value(pos![B1]).is_none());
        assert!(sheet.cell_value(pos![B2]).is_none());
        assert!(sheet.cell_value(pos![B3]).is_none());
    }

    #[test]
    fn test_set_formulas_with_ranges() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set some initial values
        test_set_values(&mut gc, sheet_id, pos![A1], 1, 5);

        // Set formulas with a range and a single cell
        gc.set_formulas(
            vec![
                (A1Selection::test_a1("B1:B3"), "=A1".to_owned()), // Range with relative refs
                (A1Selection::test_a1("C1"), "=SUM(A1:A5)".to_owned()), // Single cell
            ],
            None,
        );

        // B1:B3 should have A1, A2, A3 values due to relative reference adjustment
        assert_display_cell_value(&gc, sheet_id, 2, 1, "0"); // B1 = A1 = 0
        assert_display_cell_value(&gc, sheet_id, 2, 2, "1"); // B2 = A2 = 1
        assert_display_cell_value(&gc, sheet_id, 2, 3, "2"); // B3 = A3 = 2

        // C1 should have the sum
        assert_display_cell_value(&gc, sheet_id, 3, 1, "10"); // C1 = SUM(A1:A5) = 0+1+2+3+4 = 10
    }

    #[test]
    fn test_set_formula_with_special_chars() {
        // This test ensures that formulas with array literals and special characters
        // do not cause regex stack overflow. The formula contains special characters
        // like '{', '}', ';', ',' that could previously cause issues if passed to
        // the A1 parser incorrectly.
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Test array literal formula - this should parse without crashing
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "=SUM({1,2;3,4})".to_owned(),
            None,
            None,
            false,
        );

        // The formula should produce the sum of all elements: 1+2+3+4=10
        assert_display_cell_value(&gc, sheet_id, 1, 1, "10");

        // Test more complex formulas with special characters
        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "=IF(TRUE, {1,2,3}, {4,5,6})".to_owned(),
            None,
            None,
            false,
        );

        // Should return the first array element
        assert_display_cell_value(&gc, sheet_id, 2, 1, "1");
    }

    #[test]
    fn test_set_formulas_with_dependencies_in_batch() {
        // Test the case where formulas in a batch depend on each other
        // This is the scenario reported as a bug where only the first formula executes
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set some initial values
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);

        // Set multiple formulas where later formulas depend on earlier ones
        gc.set_formulas(
            vec![
                (A1Selection::test_a1("B1"), "=A1*2".to_owned()), // B1 = 20
                (A1Selection::test_a1("C1"), "=B1+5".to_owned()), // C1 = 25 (depends on B1)
                (A1Selection::test_a1("D1"), "=C1*2".to_owned()), // D1 = 50 (depends on C1)
            ],
            None,
        );

        // Verify ALL formulas were executed correctly, not just the first
        assert_display_cell_value(&gc, sheet_id, 2, 1, "20"); // B1 = A1*2 = 10*2 = 20
        assert_display_cell_value(&gc, sheet_id, 3, 1, "25"); // C1 = B1+5 = 20+5 = 25
        assert_display_cell_value(&gc, sheet_id, 4, 1, "50"); // D1 = C1*2 = 25*2 = 50
    }

    #[test]
    fn test_set_formulas_with_reverse_dependencies_in_batch() {
        // Test the case where formulas are defined in reverse order of dependencies
        // i.e., the dependent formula is defined before the formula it depends on
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set some initial values
        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);

        // Set formulas in reverse dependency order
        gc.set_formulas(
            vec![
                (A1Selection::test_a1("D1"), "=C1*2".to_owned()), // D1 depends on C1 (not yet defined)
                (A1Selection::test_a1("C1"), "=B1+5".to_owned()), // C1 depends on B1 (not yet defined)
                (A1Selection::test_a1("B1"), "=A1*2".to_owned()), // B1 = 20
            ],
            None,
        );

        // Verify all formulas were executed correctly
        // Note: B1, C1, D1 should all have computed values because the system
        // should handle dependency ordering
        assert_display_cell_value(&gc, sheet_id, 2, 1, "20"); // B1 = A1*2 = 10*2 = 20
        assert_display_cell_value(&gc, sheet_id, 3, 1, "25"); // C1 = B1+5 = 20+5 = 25
        assert_display_cell_value(&gc, sheet_id, 4, 1, "50"); // D1 = C1*2 = 25*2 = 50
    }
}
