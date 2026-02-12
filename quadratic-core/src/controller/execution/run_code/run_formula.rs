use itertools::Itertools;

use crate::{
    SheetPos,
    controller::{GridController, active_transactions::pending_transaction::PendingTransaction},
    formulas::{Ctx, Formula, find_cell_references, parse_formula},
    grid::{
        CellsAccessed, CodeCellLanguage, CodeRun, DataTable, DataTableKind,
        data_table::DataTableTemplate,
    },
};

impl GridController {
    /// Runs a formula, using a cached AST if available, otherwise parsing the code.
    pub(crate) fn run_formula_with_cached_ast(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
        cached_ast: Option<Formula>,
    ) {
        self.run_formula_internal(transaction, sheet_pos, code, None, cached_ast);
    }

    /// Runs a formula with a template, parsing fresh.
    pub(crate) fn run_formula_with_template(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
        template: Option<&DataTableTemplate>,
    ) {
        self.run_formula_internal(transaction, sheet_pos, code, template, None);
    }

    fn run_formula_internal(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
        template: Option<&DataTableTemplate>,
        cached_ast: Option<Formula>,
    ) {
        let mut eval_ctx = Ctx::new(self, sheet_pos);
        let parse_ctx = self.a1_context();
        transaction.current_sheet_pos = Some(sheet_pos);

        // Use cached AST if available, otherwise parse
        let parsed = if let Some(ast) = cached_ast {
            ast
        } else {
            match parse_formula(&code, parse_ctx, sheet_pos) {
                Ok(p) => p,
                Err(error) => {
                    let _ = self.code_cell_sheet_error(transaction, &error);
                    return;
                }
            }
        };

        let output = parsed.eval(&mut eval_ctx).into_non_tuple();
        let errors = output.inner.errors();
        let new_code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code,
            formula_ast: Some(parsed), // Store the AST for future runs
            std_out: None,
            std_err: (!errors.is_empty())
                .then(|| errors.into_iter().map(|e| e.to_string()).join("\n")),
            cells_accessed: eval_ctx.take_cells_accessed(),
            error: None,
            return_type: None,
            line_number: None,
            output_type: None,
        };

        // Apply template properties if provided, otherwise use defaults
        let (show_name, show_columns, header_is_first_row, chart_output) = if let Some(t) = template
        {
            (
                t.show_name,
                t.show_columns,
                t.header_is_first_row,
                t.chart_output,
            )
        } else {
            (None, None, false, None)
        };

        let mut new_data_table = DataTable::new(
            DataTableKind::CodeRun(new_code_run),
            "Formula1",
            output.inner,
            header_is_first_row,
            show_name,
            show_columns,
            chart_output,
        );

        // Apply additional template properties not in DataTable::new
        if let Some(t) = template {
            new_data_table.alternating_colors = t.alternating_colors;
            new_data_table.chart_pixel_output = t.chart_pixel_output;
        }

        self.finalize_data_table(transaction, sheet_pos, Some(new_data_table), None, false);
    }

    pub(crate) fn add_formula_without_eval(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: &str,
        name: &str,
    ) {
        let parse_ctx = self.a1_context();
        transaction.current_sheet_pos = Some(sheet_pos);

        let mut cells_accessed = CellsAccessed::default();
        let cell_references = find_cell_references(code, parse_ctx, sheet_pos);
        for cell_ref in cell_references {
            if let Ok(cell_ref) = cell_ref.inner {
                cells_accessed.add(cell_ref.sheet_id, cell_ref.cells);
            }
        }

        let new_code_run = CodeRun {
            language: CodeCellLanguage::Formula,
            code: code.to_string(),
            cells_accessed,
            ..CodeRun::default()
        };
        let new_data_table = DataTable::new(
            DataTableKind::CodeRun(new_code_run),
            name,
            "".into(),
            false,
            None,
            None,
            None,
        );
        self.finalize_data_table(transaction, sheet_pos, Some(new_data_table), None, false);
    }
}

#[cfg(test)]
mod test {
    use uuid::Uuid;

    use crate::{
        Array, ArraySize, CellValue, Pos, RunErrorMsg, SheetPos, Value, assert_code_language,
        controller::{
            GridController,
            active_transactions::pending_transaction::PendingTransaction,
            transaction_types::{JsCellValueResult, JsCodeResult},
        },
        grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
        number::decimal_from_str,
        test_util::pretty_print_data_table,
    };

    #[test]
    fn test_multiple_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(pos![sheet_id!A1], "10".into(), None, false);
        gc.set_code_cell(
            pos![sheet_id!B1],
            CodeCellLanguage::Formula,
            "A1 + 1".to_string(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.try_sheet(sheet_id).unwrap().display_value(pos![B1]),
            Some(CellValue::Number(11.into()))
        );

        gc.set_code_cell(
            pos![sheet_id!C1],
            CodeCellLanguage::Formula,
            "B1 + 1".to_string(),
            None,
            None,
            false,
        );

        let sheet = gc.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![B1]),
            Some(CellValue::Number(11.into()))
        );
        assert_eq!(
            sheet.display_value(pos![C1]),
            Some(CellValue::Number(12.into()))
        );

        gc.set_cell_value(pos![sheet_id!A1], "1".into(), None, false);

        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(pos![B1]),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(pos![C1]),
            Some(CellValue::Number(3.into()))
        );
    }

    #[test]
    fn test_deleting_to_trigger_compute() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "10".into(),
            None,
            false,
        );
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 2,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A1 + 1".into(),
            None,
            None,
            false,
        );

        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(11.into()))
        );

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "".into(),
            None,
            false,
        );
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.display_value(Pos { x: 1, y: 1 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Number(1.into()))
        );
    }

    #[test]
    fn test_js_code_result_to_code_cell_value_single() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let result = JsCodeResult {
            transaction_id: Uuid::new_v4().into(),
            success: true,
            output_value: Some(JsCellValueResult("$12".into(), 2)),
            output_display_type: Some("number".into()),
            ..Default::default()
        };
        let mut transaction = PendingTransaction::default();
        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };

        // need the result to ensure last_modified is the same
        let result = gc.js_code_result_to_code_cell_value(
            &mut transaction,
            result,
            sheet_pos,
            CodeCellLanguage::Javascript,
            r#"return "12";"#.to_string(),
        );
        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: r#"return "12";"#.to_string(),
            return_type: Some("number".into()),
            output_type: Some("number".into()),
            ..Default::default()
        };
        assert_eq!(
            result,
            DataTable::new(
                DataTableKind::CodeRun(code_run),
                "JavaScript1",
                Value::Single(CellValue::Number(12.into())),
                false,
                None,
                None,
                None,
            )
            .with_last_modified(result.last_modified)
        );
    }

    #[test]
    fn test_js_code_result_to_code_cell_value_array() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let array_output: Vec<Vec<JsCellValueResult>> = vec![
            vec![
                JsCellValueResult("$1.1".into(), 2),
                JsCellValueResult("20%".into(), 2),
            ],
            vec![
                JsCellValueResult("3".into(), 2),
                JsCellValueResult("Hello".into(), 1),
            ],
        ];
        let mut transaction = PendingTransaction::default();
        let result = JsCodeResult {
            transaction_id: transaction.id.to_string(),
            success: true,
            output_array: Some(array_output),
            output_display_type: Some("array".into()),
            has_headers: false,
            ..Default::default()
        };

        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };
        let mut array = Array::new_empty(ArraySize::new(2, 2).unwrap());
        array
            .set(
                0,
                0,
                CellValue::Number(decimal_from_str("1.1").unwrap()),
                false,
            )
            .unwrap();
        array
            .set(
                1,
                0,
                CellValue::Number(decimal_from_str("0.2").unwrap()),
                false,
            )
            .unwrap();
        array
            .set(
                0,
                1,
                CellValue::Number(decimal_from_str("3").unwrap()),
                false,
            )
            .unwrap();
        array
            .set(1, 1, CellValue::Text("Hello".into()), false)
            .unwrap();

        let result = gc.js_code_result_to_code_cell_value(
            &mut transaction,
            result,
            sheet_pos,
            CodeCellLanguage::Javascript,
            r#"return [[1.1, 0.2], [3, "Hello"]];"#.to_string(),
        );
        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: r#"return [[1.1, 0.2], [3, "Hello"]];"#.to_string(),
            return_type: Some("array".into()),
            output_type: Some("array".into()),
            ..Default::default()
        };

        let mut expected_result = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "JavaScript1",
            array.into(),
            false,
            None,
            None,
            None,
        );
        let column_headers =
            expected_result.default_header_with_name(|i| format!("{}", i - 1), None);
        expected_result = expected_result
            .with_column_headers(column_headers)
            .with_last_modified(result.last_modified);

        pretty_print_data_table(&result, None, None);
        pretty_print_data_table(&expected_result, None, None);

        assert_eq!(result, expected_result);
    }

    #[test]
    fn test_undo_redo_spill_change() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["1".into(), "2".into(), "3".into()]],
            None,
            false,
        );

        // create code that will later have a spill error
        gc.set_code_cell(
            SheetPos {
                x: 2,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A1:A4".into(),
            None,
            None,
            false,
        );
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(1.into()))
        );

        // create a spill error for the code
        gc.set_cell_value(
            SheetPos {
                x: 2,
                y: 2,
                sheet_id,
            },
            "create spill error".into(),
            None,
            false,
        );
        assert!(
            gc.sheet(sheet_id)
                .data_table_at(&Pos { x: 2, y: 1 })
                .unwrap()
                .has_spill()
        );
        assert!(
            gc.sheet(sheet_id)
                .display_value(Pos { x: 2, y: 1 })
                .unwrap()
                .is_blank_or_empty_string()
        );

        // undo the spill error
        gc.undo(1, None, false);
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(1.into()))
        );

        // redo the spill error
        gc.redo(1, None, false);
        assert!(
            gc.sheet(sheet_id)
                .data_table_at(&Pos { x: 2, y: 1 })
                .unwrap()
                .has_spill()
        );

        // undo the spill error
        gc.undo(1, None, false);
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
    }

    #[test]
    fn test_formula_error() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        let pos: Pos = sheet_pos.into();

        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "☺".into(),
            None,
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        let result = sheet.data_table_at(&pos).unwrap();
        assert!(!result.has_spill());
        assert!(result.code_run().unwrap().std_err.is_some());

        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "{0,1/0;2/0,0}".into(),
            None,
            None,
            false,
        );
        assert_code_language(
            &gc,
            sheet_pos,
            CodeCellLanguage::Formula,
            "{0,1/0;2/0,0}".into(),
        );
        let sheet = gc.sheet(sheet_id);
        let result = sheet.data_table_at(&pos).unwrap();
        assert!(!result.has_spill());
        assert!(result.code_run().unwrap().std_err.is_some());
    }

    #[test]
    fn test_formula_unbounded_column_row_trigger() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set initial values in column B
        gc.set_cell_value(pos![sheet_id!B1], "10".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B2], "20".into(), None, false);

        // Create formula that sums entire column B (formula at A1, outside column B)
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "SUM(B:B)".to_string(),
            None,
            None,
            false,
        );

        // Verify initial result
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![A1]),
            Some(CellValue::Number(30.into()))
        );

        // Add a new value to column B - formula should recalculate
        gc.set_cell_value(pos![sheet_id!B3], "15".into(), None, false);

        // Verify formula was triggered and recalculated
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![A1]),
            Some(CellValue::Number(45.into()))
        );

        // Test unbounded row reference (formula at A5, outside row 4)
        gc.set_cell_value(pos![sheet_id!A4], "5".into(), None, false);
        gc.set_cell_value(pos![sheet_id!B4], "10".into(), None, false);

        gc.set_code_cell(
            pos![sheet_id!A5],
            CodeCellLanguage::Formula,
            "SUM(4:4)".to_string(),
            None,
            None,
            false,
        );

        // Verify initial row sum result
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![A5]),
            Some(CellValue::Number(15.into())) // 5 + 10
        );

        // Add a new value to row 4 - formula should recalculate
        gc.set_cell_value(pos![sheet_id!C4], "7".into(), None, false);

        // Verify formula was triggered
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![A5]),
            Some(CellValue::Number(22.into())) // 5 + 10 + 7
        );
    }

    #[test]
    fn test_self_referential_formula_does_not_hang() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set =SUM(A1) at A1 - this references itself
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "SUM(A1)".to_string(),
            None,
            None,
            false,
        );

        // Should complete (not hang) and produce an error
        let sheet = gc.sheet(sheet_id);
        let display = sheet.display_value(pos![A1]);

        // Should have a value (error value, not blank from hanging)
        assert!(
            display.is_some(),
            "Formula should produce a value, not hang"
        );

        // Verify the error is CircularReference
        if let Some(CellValue::Error(err)) = display {
            assert_eq!(err.msg, RunErrorMsg::CircularReference);
        } else {
            panic!("Expected CircularReference error, got {:?}", display);
        }

        // Verify subsequent operations still work
        gc.set_cell_value(pos![sheet_id!B1], "test".into(), None, false);
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B1]),
            Some(CellValue::Text("test".into()))
        );
    }

    #[test]
    fn test_self_referential_range_formula_does_not_hang() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set =SUM(A:A) at A1 - this references entire column A including A1
        gc.set_code_cell(
            pos![sheet_id!A1],
            CodeCellLanguage::Formula,
            "SUM(A:A)".to_string(),
            None,
            None,
            false,
        );

        // Should complete (not hang) and produce an error
        let sheet = gc.sheet(sheet_id);
        let display = sheet.display_value(pos![A1]);

        // Should have a value (error value, not blank from hanging)
        assert!(
            display.is_some(),
            "Formula should produce a value, not hang"
        );

        // Verify the error is CircularReference
        if let Some(CellValue::Error(err)) = display {
            assert_eq!(err.msg, RunErrorMsg::CircularReference);
        } else {
            panic!("Expected CircularReference error, got {:?}", display);
        }

        // Verify subsequent operations still work
        gc.set_cell_value(pos![sheet_id!B1], "test".into(), None, false);
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![B1]),
            Some(CellValue::Text("test".into()))
        );
    }
}
