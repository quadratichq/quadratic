use itertools::Itertools;

use crate::{
    SheetPos,
    controller::{GridController, active_transactions::pending_transaction::PendingTransaction},
    formulas::{Ctx, find_cell_references, parse_formula},
    grid::{CellsAccessed, CodeCellLanguage, CodeRun, DataTable, DataTableKind},
};

impl GridController {
    pub(crate) fn run_formula(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
    ) {
        let mut eval_ctx = Ctx::new(self, sheet_pos);
        let parse_ctx = self.a1_context();
        transaction.current_sheet_pos = Some(sheet_pos);

        match parse_formula(&code, parse_ctx, sheet_pos) {
            Ok(parsed) => {
                let output = parsed.eval(&mut eval_ctx).into_non_tuple();
                let errors = output.inner.errors();
                let new_code_run = CodeRun {
                    language: CodeCellLanguage::Formula,
                    code,
                    std_out: None,
                    std_err: (!errors.is_empty())
                        .then(|| errors.into_iter().map(|e| e.to_string()).join("\n")),
                    cells_accessed: eval_ctx.cells_accessed,
                    error: None,
                    return_type: None,
                    line_number: None,
                    output_type: None,
                };
                let new_data_table = DataTable::new(
                    DataTableKind::CodeRun(new_code_run),
                    "Formula1",
                    output.inner,
                    false,
                    None,
                    None,
                    None,
                );
                self.finalize_data_table(transaction, sheet_pos, Some(new_data_table), None);
            }
            Err(error) => {
                let _ = self.code_cell_sheet_error(transaction, &error);
            }
        }
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
        self.finalize_data_table(transaction, sheet_pos, Some(new_data_table), None);
    }
}

#[cfg(test)]
mod test {
    use uuid::Uuid;

    use crate::{
        Array, ArraySize, CellValue, Pos, SheetPos, Value,
        cell_values::CellValues,
        controller::{
            GridController,
            active_transactions::{
                pending_transaction::PendingTransaction, transaction_name::TransactionName,
            },
            operations::operation::Operation,
            transaction_types::{JsCellValueResult, JsCodeResult},
        },
        grid::{CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind},
        number::decimal_from_str,
        test_util::pretty_print_data_table,
    };

    #[test]
    fn test_execute_operation_set_cell_values_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.try_sheet_mut(sheet_id).unwrap();
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(10.into()));
        let sheet_pos = SheetPos {
            x: 2,
            y: 1,
            sheet_id,
        };

        let code_cell = CellValue::Code(CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: "A1 + 1".to_string(),
        });
        gc.start_user_ai_transaction(
            vec![
                Operation::SetCellValues {
                    sheet_pos,
                    values: CellValues::from(code_cell.clone()),
                },
                Operation::ComputeCode { sheet_pos },
            ],
            None,
            TransactionName::Unknown,
            false,
        );

        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(11.into()))
        );
        assert_eq!(sheet.cell_value(Pos { x: 2, y: 1 }), Some(code_cell));
    }

    #[test]
    fn test_multiple_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut(sheet_id).unwrap();

        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(10.into()));
        let sheet_pos = SheetPos {
            x: 2,
            y: 1,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "A1 + 1".to_string(),
            None,
            None,
            false,
        );

        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(11.into()))
        );

        gc.set_code_cell(
            SheetPos {
                x: 3,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "B1 + 1".to_string(),
            None,
            None,
            false,
        );

        let sheet = gc.grid().try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(11.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Number(12.into()))
        );

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "1".into(),
            None,
            false,
        );

        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
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
        gc.undo(None);
        assert_eq!(
            gc.sheet(sheet_id).display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Number(1.into()))
        );

        // redo the spill error
        gc.redo(None);
        assert!(
            gc.sheet(sheet_id)
                .data_table_at(&Pos { x: 2, y: 1 })
                .unwrap()
                .has_spill()
        );

        // undo the spill error
        gc.undo(None);
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
        assert_eq!(
            sheet.cell_value(pos),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "☺".into(),
            }))
        );
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
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(pos),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "{0,1/0;2/0,0}".into(),
            }))
        );
        let result = sheet.data_table_at(&pos).unwrap();
        assert!(!result.has_spill());
        assert!(result.code_run().unwrap().std_err.is_some());
    }
}
