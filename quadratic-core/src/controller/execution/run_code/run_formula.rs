use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    formulas::{parse_formula, Ctx},
    grid::{CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    util::date_string,
    SheetPos,
};

impl GridController {
    pub(crate) fn run_formula(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        old_code_cell: &CodeCellValue,
    ) {
        let mut ctx = Ctx::new(self.grid(), sheet_pos);
        match parse_formula(&old_code_cell.code_string, sheet_pos.into()) {
            Ok(parsed) => {
                match parsed.eval(&mut ctx) {
                    Ok(value) => {
                        transaction.cells_accessed = ctx.cells_accessed;
                        let new_code_cell_value = CodeCellValue {
                            last_modified: date_string(),
                            output: Some(CodeCellRunOutput {
                                std_out: None,
                                std_err: None,
                                result: CodeCellRunResult::Ok {
                                    output_value: value,
                                    cells_accessed: transaction.cells_accessed.clone(),
                                },
                                spill: false,
                            }),
                            ..old_code_cell.clone()
                        };
                        self.add_code_cell_operations(
                            transaction,
                            sheet_pos,
                            Some(old_code_cell),
                            Some(&new_code_cell_value),
                        );
                        if let Some(sheet) = self.grid.try_sheet_mut_from_id(sheet_pos.sheet_id) {
                            sheet.set_code_cell(sheet_pos.into(), Some(new_code_cell_value));
                        }
                    }
                    Err(error) => {
                        let msg = error.msg.to_string();
                        let line_number = error.span.map(|span| span.start as i64);
                        // there's probably a better way to handle this error
                        let _ = self.code_cell_sheet_error(
                            transaction,
                            msg,
                            // todo: span should be multiline
                            line_number,
                        );
                    }
                }
            }
            Err(e) => {
                let msg = e.to_string();
                // there's probably a better way to handle this error
                let _ = self.code_cell_sheet_error(transaction, msg, None);
            }
        }
    }
}

#[cfg(test)]
mod test {
    use std::{collections::HashSet, str::FromStr};

    use bigdecimal::BigDecimal;
    use uuid::Uuid;

    use crate::{
        controller::{
            active_transactions::pending_transaction::PendingTransaction,
            operations::operation::Operation, transaction_types::JsCodeResult, GridController,
        },
        grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellValue},
        Array, ArraySize, CellValue, Pos, SheetPos, SheetRect, Value,
    };

    #[test]
    fn test_execute_operation_set_cell_values_formula() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_id);

        let _ = sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(BigDecimal::from(10)));
        let sheet_pos = SheetPos {
            x: 1,
            y: 0,
            sheet_id,
        };
        gc.start_user_transaction(
            vec![Operation::SetCodeCell {
                sheet_pos,
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code_string: "A0 + 1".to_string(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
        );

        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_id);
        assert!(sheet.get_code_cell(Pos { x: 1, y: 0 }).is_some());
        let code_cell = sheet.get_code_cell(Pos { x: 1, y: 0 }).unwrap();
        assert_eq!(code_cell.code_string, "A0 + 1".to_string());
        assert_eq!(
            code_cell.get_output_value(0, 0),
            Some(CellValue::Number(11.into()))
        );
    }

    #[test]
    fn test_multiple_formula() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().try_sheet_mut_from_id(sheet_id).unwrap();

        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Number(BigDecimal::from(10)));
        let sheet_pos = SheetPos {
            x: 1,
            y: 0,
            sheet_id,
        };
        gc.start_user_transaction(
            vec![Operation::SetCodeCell {
                sheet_pos,
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code_string: "A0 + 1".to_string(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(11.into()))
        );

        gc.start_user_transaction(
            vec![Operation::SetCodeCell {
                sheet_pos: SheetPos {
                    x: 2,
                    y: 0,
                    sheet_id,
                },
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code_string: "B0 + 1".to_string(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
        );

        let sheet = gc.grid().try_sheet_from_id(sheet_id).unwrap();
        assert!(sheet.get_code_cell(Pos { x: 2, y: 0 }).is_some());
        let code_cell = sheet.get_code_cell(Pos { x: 2, y: 0 }).unwrap();
        assert_eq!(code_cell.code_string, "B0 + 1".to_string());
        assert_eq!(
            code_cell.get_output_value(0, 0),
            Some(CellValue::Number(12.into()))
        );
        assert_eq!(
            sheet.get_cell_value(Pos { x: 2, y: 0 }),
            Some(CellValue::Number(12.into()))
        );

        gc.start_user_transaction(
            vec![Operation::SetCellValues {
                sheet_rect: SheetRect::single_sheet_pos(SheetPos {
                    x: 0,
                    y: 0,
                    sheet_id,
                }),
                values: CellValue::Number(1.into()).into(),
            }],
            None,
        );

        crate::test_util::print_table(&gc, sheet_id, crate::Rect::from_numbers(0, 0, 3, 1));

        let sheet = gc.grid().try_sheet_from_id(sheet_id).unwrap();
        assert_eq!(
            sheet.get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.get_cell_value(Pos { x: 2, y: 0 }),
            Some(CellValue::Number(3.into()))
        );
    }

    #[test]
    fn test_deleting_to_trigger_compute() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "10".into(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                x: 0,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A0 + 1".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Number(11.into()))
        );

        gc.set_cell_value(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            "".into(),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.get_cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Number(1.into()))
        );
    }

    #[test]
    fn test_js_code_result_to_code_cell_value_single() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let result = JsCodeResult::new_from_rust(
            Uuid::new_v4().into(),
            true,
            None,
            None,
            None,
            Some("$12".into()),
            None,
            None,
            None,
        );
        let mut transaction = PendingTransaction::default();
        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        assert_eq!(
            gc.js_code_result_to_code_cell_value(
                &mut transaction,
                result,
                sheet_pos,
                CodeCellLanguage::Python,
                "".into(),
            )
            .output,
            Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Single(CellValue::Number(12.into())),
                    cells_accessed: HashSet::new()
                },
                spill: false,
            }),
        );
    }

    #[test]
    fn test_js_code_result_to_code_cell_value_array() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let array_output: Vec<Vec<String>> = vec![
            vec!["$1.1".into(), "20%".into()],
            vec!["3".into(), "Hello".into()],
        ];
        let mut transaction = PendingTransaction::default();
        let result = JsCodeResult::new_from_rust(
            transaction.id.to_string(),
            true,
            None,
            None,
            None,
            None,
            Some(array_output),
            None,
            None,
        );

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
        assert_eq!(
            gc.js_code_result_to_code_cell_value(
                &mut transaction,
                result,
                sheet_pos,
                CodeCellLanguage::Python,
                "".into(),
            )
            .output,
            Some(CodeCellRunOutput {
                std_out: None,
                std_err: None,
                result: crate::grid::CodeCellRunResult::Ok {
                    output_value: Value::Array(array),
                    cells_accessed: HashSet::new()
                },
                spill: false,
            }),
        );
    }

    #[test]
    fn test_undo_redo_spill_change() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_values(
            SheetPos {
                x: 0,
                y: 0,
                sheet_id,
            },
            vec![vec!["1", "2", "3"]],
            None,
        );

        // create code that will later have a spill error
        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 0,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "A0:A3".into(),
            None,
        );
        assert_eq!(
            gc.sheet(sheet_id).get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(1.into()))
        );

        // create a spill error for the code
        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            "create spill error".into(),
            None,
        );
        assert!(gc
            .sheet(sheet_id)
            .get_code_cell(Pos { x: 1, y: 0 })
            .unwrap()
            .has_spill_error());
        assert!(gc
            .sheet(sheet_id)
            .get_cell_value(Pos { x: 1, y: 0 })
            .unwrap()
            .is_blank_or_empty_string());

        // undo the spill error
        gc.undo(None);
        assert_eq!(
            gc.sheet(sheet_id).get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(1.into()))
        );

        // redo the spill error
        gc.redo(None);
        assert!(gc
            .sheet(sheet_id)
            .get_code_cell(Pos { x: 1, y: 0 })
            .unwrap()
            .has_spill_error());

        // undo the spill error
        gc.undo(None);
        assert_eq!(
            gc.sheet(sheet_id).get_cell_value(Pos { x: 1, y: 0 }),
            Some(CellValue::Number(1.into()))
        );
    }
}
