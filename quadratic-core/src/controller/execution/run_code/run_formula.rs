use itertools::Itertools;

use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    formulas::{parse_formula, Ctx},
    grid::{CodeRun, DataTable, DataTableKind},
    SheetPos,
};

impl GridController {
    pub(crate) fn run_formula(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
    ) {
        let mut ctx = Ctx::new(self.grid(), sheet_pos);
        transaction.current_sheet_pos = Some(sheet_pos);

        if let Some(sheet) = self.grid().try_sheet(sheet_pos.sheet_id) {
            let bounds = sheet.bounds(true);
            match parse_formula(&code, sheet_pos.into()) {
                Ok(parsed) => {
                    let output = parsed.eval(&mut ctx, Some(bounds)).into_non_tuple();
                    let errors = output.inner.errors();
                    transaction.cells_accessed = ctx.cells_accessed;
                    let new_code_run = CodeRun {
                        std_out: None,
                        std_err: (!errors.is_empty())
                            .then(|| errors.into_iter().map(|e| e.to_string()).join("\n")),
                        formatted_code_string: None,
                        cells_accessed: transaction.cells_accessed.clone(),
                        error: None,
                        return_type: None,
                        line_number: None,
                        output_type: None,
                    };
                    let new_data_table = DataTable::new(
                        DataTableKind::CodeRun(new_code_run),
                        "Formula 1",
                        output.inner,
                        false,
                        false,
                        false,
                        None,
                    );
                    self.finalize_code_run(transaction, sheet_pos, Some(new_data_table), None);
                }
                Err(error) => {
                    let _ = self.code_cell_sheet_error(transaction, &error);
                }
            }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod test {
    use std::str::FromStr;

    use bigdecimal::BigDecimal;
    use uuid::Uuid;

    use crate::{
        cell_values::CellValues,
        controller::{
            active_transactions::{
                pending_transaction::PendingTransaction, transaction_name::TransactionName,
            },
            operations::operation::Operation,
            transaction_types::JsCodeResult,
            GridController,
        },
        grid::{CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind},
        Array, ArraySize, CellValue, Pos, SheetPos, Value,
    };

    #[test]
    fn test_execute_operation_set_cell_values_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.try_sheet_mut(sheet_id).unwrap();
        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(BigDecimal::from(10)));
        let sheet_pos = SheetPos {
            x: 2,
            y: 1,
            sheet_id,
        };

        let code_cell = CellValue::Code(CodeCellValue {
            language: CodeCellLanguage::Formula,
            code: "A1 + 1".to_string(),
        });
        gc.start_user_transaction(
            vec![
                Operation::SetCellValues {
                    sheet_pos,
                    values: CellValues::from(code_cell.clone()),
                },
                Operation::ComputeCode { sheet_pos },
            ],
            None,
            TransactionName::Unknown,
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

        sheet.set_cell_value(Pos { x: 1, y: 1 }, CellValue::Number(BigDecimal::from(10)));
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
            output_value: Some(vec!["$12".into(), "number".into()]),
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
        );
        let code_run = CodeRun {
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
                false,
                false,
                None,
            )
            .with_last_modified(result.last_modified),
        );
    }

    #[test]
    fn test_js_code_result_to_code_cell_value_array() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let array_output: Vec<Vec<Vec<String>>> = vec![
            vec![
                vec!["$1.1".into(), "number".into()],
                vec!["20%".into(), "number".into()],
            ],
            vec![
                vec!["3".into(), "number".into()],
                vec!["Hello".into(), "text".into()],
            ],
        ];
        let mut transaction = PendingTransaction::default();
        let result = JsCodeResult {
            transaction_id: transaction.id.to_string(),
            success: true,
            output_array: Some(array_output),
            output_display_type: Some("array".into()),
            ..Default::default()
        };

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        let mut array = Array::new_empty(ArraySize::new(2, 2).unwrap());
        let _ = array.set(
            0,
            0,
            CellValue::Number(BigDecimal::from_str("1.1").unwrap()),
        );
        let _ = array.set(
            1,
            0,
            CellValue::Number(BigDecimal::from_str("0.2").unwrap()),
        );
        let _ = array.set(0, 1, CellValue::Number(BigDecimal::from_str("3").unwrap()));
        let _ = array.set(1, 1, CellValue::Text("Hello".into()));

        let result = gc.js_code_result_to_code_cell_value(
            &mut transaction,
            result,
            sheet_pos,
            CodeCellLanguage::Javascript,
        );
        let code_run = CodeRun {
            formatted_code_string: None,
            return_type: Some("array".into()),
            output_type: Some("array".into()),
            ..Default::default()
        };
        assert_eq!(
            result,
            DataTable::new(
                DataTableKind::CodeRun(code_run),
                "JavaScript1",
                Value::Array(array),
                false,
                false,
                false,
                None,
            )
            .with_last_modified(result.last_modified),
        );
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
            vec![vec!["1", "2", "3"]],
            None,
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
        );
        assert!(
            gc.sheet(sheet_id)
                .data_table(Pos { x: 2, y: 1 })
                .unwrap()
                .spill_error
        );
        assert!(gc
            .sheet(sheet_id)
            .display_value(Pos { x: 2, y: 1 })
            .unwrap()
            .is_blank_or_empty_string());

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
                .data_table(Pos { x: 2, y: 1 })
                .unwrap()
                .spill_error
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

        gc.set_code_cell(sheet_pos, CodeCellLanguage::Formula, "☺".into(), None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(pos),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "☺".into(),
            }))
        );
        let result = sheet.data_table(pos).unwrap();
        assert!(!result.spill_error);
        assert!(result.code_run().unwrap().std_err.is_some());

        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "{0,1/0;2/0,0}".into(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(pos),
            Some(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "{0,1/0;2/0,0}".into(),
            }))
        );
        let result = sheet.data_table(pos).unwrap();
        assert!(!result.spill_error);
        assert!(result.code_run().unwrap().std_err.is_some());
    }
}
