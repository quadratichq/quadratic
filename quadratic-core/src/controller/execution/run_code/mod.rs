use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::transaction_summary::TransactionSummary;
use crate::core_error::{CoreError, Result};
use crate::{
    controller::{transaction_types::JsCodeResult, GridController},
    grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellRunResult, CodeCellValue},
    util::date_string,
    Array, CellValue, Error, ErrorMsg, Pos, SheetPos, SheetRect, Span, Value,
};

pub mod get_cells;
pub mod run_formula;
pub mod run_python;

impl GridController {
    /// finalize changes to a code_cell
    pub(crate) fn finalize_code_cell(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        old_code_cell_value: Option<CodeCellValue>,
    ) {
        let sheet_id = sheet_pos.sheet_id;
        let code_cell_value = if let Some(sheet) = self.grid().try_sheet_from_id(sheet_id) {
            sheet.get_code_cell(sheet_pos.into()).cloned()
        } else {
            return;
        };
        let sheet_rect = match (&old_code_cell_value, &code_cell_value) {
            (None, None) => sheet_pos.into(),
            (None, Some(code_cell_value)) => code_cell_value.output_sheet_rect(sheet_pos, false),
            (Some(old_code_cell_value), None) => {
                old_code_cell_value.output_sheet_rect(sheet_pos, false)
            }
            (Some(old_code_cell_value), Some(code_cell_value)) => {
                let old = old_code_cell_value.output_sheet_rect(sheet_pos, false);
                let new = code_cell_value.output_sheet_rect(sheet_pos, false);
                SheetRect {
                    min: sheet_pos.into(),
                    max: Pos {
                        x: old.max.x.max(new.max.x),
                        y: old.max.y.max(new.max.y),
                    },
                    sheet_id,
                }
            }
        };

        transaction.forward_operations.push(Operation::SetCodeCell {
            sheet_pos,
            code_cell_value,
        });
        transaction.reverse_operations.insert(
            0,
            Operation::SetCodeCell {
                sheet_pos,
                code_cell_value: old_code_cell_value,
            },
        );
        self.check_spills(transaction, &sheet_pos.into());

        transaction.sheets_with_dirty_bounds.insert(sheet_id);

        transaction.summary.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(&sheet_rect);
        transaction.summary.code_cells_modified.insert(sheet_id);
        transaction
            .summary
            .add_cell_sheets_modified_rect(&sheet_rect);
    }

    /// continues the calculate cycle after an async call
    pub fn after_calculation_async(
        &mut self,
        transaction: &mut PendingTransaction,
        result: JsCodeResult,
    ) -> Result<TransactionSummary> {
        let current_sheet_pos = match transaction.current_sheet_pos {
            Some(current_sheet_pos) => current_sheet_pos,
            None => {
                return Err(CoreError::TransactionNotFound(
                    "Expected current_sheet_pos to be defined in after_calculation_async".into(),
                ))
            }
        };

        let old_code_cell_value = match self
            .grid()
            .sheet_from_id(current_sheet_pos.sheet_id)
            .get_code_cell(current_sheet_pos.into())
            .cloned()
        {
            Some(old_code_cell_value) => old_code_cell_value,
            None => {
                return Err(CoreError::TransactionNotFound(
                    "Expected current_code_cell to be defined in after_calculation_async".into(),
                ))
            }
        };
        match transaction.waiting_for_async {
            None => {
                return Err(CoreError::TransactionNotFound("Expected transaction to be waiting_for_async to be defined in transaction::complete".into()));
            }
            Some(waiting_for_async) => match waiting_for_async {
                CodeCellLanguage::Python => {
                    let updated_code_cell_value = self.js_code_result_to_code_cell_value(
                        transaction,
                        result,
                        current_sheet_pos,
                        old_code_cell_value.language,
                        old_code_cell_value.code_string,
                    );
                    let old_code_cell_value = if let Some(sheet) =
                        self.grid.try_sheet_mut_from_id(current_sheet_pos.sheet_id)
                    {
                        sheet.set_code_cell(current_sheet_pos.into(), Some(updated_code_cell_value))
                    } else {
                        None
                    };
                    self.finalize_code_cell(transaction, current_sheet_pos, old_code_cell_value);
                    transaction.waiting_for_async = None;
                }
                _ => {
                    return Err(CoreError::UnhandledLanguage(
                        "Transaction.complete called for an unhandled language".into(),
                    ));
                }
            },
        }
        // continue the compute loop after a successful async call
        self.handle_transactions(transaction);
        Ok(transaction.prepare_summary(transaction.complete))
    }

    pub(super) fn code_cell_sheet_error(
        &mut self,
        transaction: &mut PendingTransaction,
        error_msg: String,
        line_number: Option<i64>,
    ) -> Result<()> {
        let sheet_pos = match transaction.current_sheet_pos {
            Some(sheet_pos) => sheet_pos,
            None => {
                return Err(CoreError::TransactionNotFound(
                    "Expected current_sheet_pos to be defined in transaction::code_cell_error"
                        .into(),
                ))
            }
        };
        let update_code_cell_value = self
            .grid()
            .sheet_from_id(sheet_pos.sheet_id)
            .get_code_cell(sheet_pos.into())
            .cloned();
        match update_code_cell_value {
            None => {
                return Err(CoreError::TransactionNotFound(
                    "Expected current_code_cell to be defined in transaction::code_cell_error"
                        .into(),
                ));
            }
            Some(update_code_cell_value) => {
                let mut code_cell_value = update_code_cell_value.clone();
                code_cell_value.last_modified = date_string();
                let msg = ErrorMsg::PythonError(error_msg.clone().into());
                let span = line_number.map(|line_number| Span {
                    start: line_number as u32,
                    end: line_number as u32,
                });
                let error = Error { span, msg };
                let result = CodeCellRunResult::Err { error };
                code_cell_value.output = Some(CodeCellRunOutput {
                    std_out: None,
                    std_err: Some(error_msg),
                    result,
                    spill: false,
                });

                self.finalize_code_cell(transaction, sheet_pos, Some(code_cell_value));
                transaction
                    .summary
                    .code_cells_modified
                    .insert(sheet_pos.sheet_id);
                transaction.waiting_for_async = None;
                Ok(())
            }
        }
    }

    // Returns a CodeCellValue from a JsCodeResult.
    pub(super) fn js_code_result_to_code_cell_value(
        &mut self,
        transaction: &mut PendingTransaction,
        js_code_result: JsCodeResult,
        start: SheetPos,
        language: CodeCellLanguage,
        code_string: String,
    ) -> CodeCellValue {
        let sheet = self.grid_mut().sheet_mut_from_id(start.sheet_id);
        let result = if js_code_result.success() {
            CodeCellRunResult::Ok {
                output_value: if let Some(array_output) = js_code_result.array_output() {
                    let (array, ops) = Array::from_string_list(start.into(), sheet, array_output);
                    transaction.reverse_operations.splice(0..0, ops);
                    if let Some(array) = array {
                        Value::Array(array)
                    } else {
                        Value::Single("".into())
                    }
                } else if let Some(output_value) = js_code_result.output_value() {
                    let (cell_value, ops) =
                        CellValue::from_string(&output_value, start.into(), sheet);
                    transaction.reverse_operations.splice(0..0, ops);
                    Value::Single(cell_value)
                } else {
                    unreachable!()
                },
                cells_accessed: transaction.cells_accessed.clone().into_iter().collect(),
            }
        } else {
            let error_msg = js_code_result
                .error_msg()
                .unwrap_or_else(|| "Unknown Python Error".into());
            let msg = ErrorMsg::PythonError(error_msg.into());
            let span = js_code_result.line_number().map(|line_number| Span {
                start: line_number,
                end: line_number,
            });
            CodeCellRunResult::Err {
                error: Error { span, msg },
            }
        };
        transaction.cells_accessed.clear();
        CodeCellValue {
            language,
            code_string,
            formatted_code_string: js_code_result.formatted_code().clone(),
            output: Some(CodeCellRunOutput {
                std_out: js_code_result.input_python_std_out(),
                std_err: js_code_result.error_msg(),
                result,
                spill: false,
            }),
            last_modified: date_string(),
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
            operations::operation::Operation,
            transaction_types::{CellForArray, JsCodeResult, JsComputeGetCells},
            GridController,
        },
        grid::{CodeCellLanguage, CodeCellRunOutput, CodeCellValue},
        Array, ArraySize, CellValue, Pos, Rect, SheetPos, SheetRect, Value,
    };

    /// Sets up a GridController with a code cell at (1, 0) and a cell value at (0, 0)
    /// Returns the GridController with the transaction in progress
    fn setup_python(
        gc: Option<GridController>,
        code_string: String,
        cell_value: CellValue,
    ) -> GridController {
        let mut gc = gc.unwrap_or_default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.grid_mut().sheet_mut_from_id(sheet_id);
        let cell_value_pos = Pos { x: 0, y: 0 };
        let code_cell_pos = SheetPos {
            x: 1,
            y: 0,
            sheet_id,
        };
        sheet.set_cell_value(cell_value_pos, cell_value.clone());

        gc.start_user_transaction(
            vec![Operation::SetCodeCell {
                sheet_pos: code_cell_pos,
                code_cell_value: Some(CodeCellValue {
                    language: CodeCellLanguage::Python,
                    code_string: code_string.clone(),
                    formatted_code_string: None,
                    output: None,
                    last_modified: String::new(),
                }),
            }],
            None,
        );

        let transaction = gc.async_transactions().get(0).unwrap();

        // code should be at (1, 0)
        let code_cell = gc
            .js_get_code_string(sheet_id.to_string(), &code_cell_pos.into())
            .unwrap();
        assert_eq!(code_cell.code_string(), code_string);
        assert_eq!(code_cell.language(), CodeCellLanguage::Python);

        // pending transaction
        assert!(!transaction.complete);
        assert_eq!(
            transaction.waiting_for_async,
            Some(CodeCellLanguage::Python)
        );
        assert_eq!(transaction.operations.len(), 0);

        // pull out the code cell
        let cells_for_array = gc.calculation_get_cells(JsComputeGetCells::new(
            transaction.id.to_string(),
            Rect::single_pos(cell_value_pos),
            None,
            None,
        ));

        // inspect the cell_value cell at (0, 0)
        assert_eq!(cells_for_array.as_ref().unwrap().get_cells().len(), 1);
        assert_eq!(
            *cells_for_array.as_ref().unwrap().get_cells(),
            vec![CellForArray::new(
                cell_value_pos.x,
                cell_value_pos.y,
                Some(cell_value.to_string())
            )]
        );

        gc
    }

    fn test_python(
        gc: Option<GridController>,
        code_string: String,
        cell_value: CellValue,
        expected: String,
        array_output: Option<String>,
    ) -> (GridController, CodeCellValue) {
        let mut gc = setup_python(gc, code_string, cell_value);
        let sheet_id = gc.sheet_ids()[0];

        // mock the python result
        let result = JsCodeResult::new(
            Uuid::new_v4().into(),
            true,
            None,
            None,
            None,
            Some(expected.clone()),
            array_output,
            None,
            None,
        );

        // complete the transaction and verify the result
        let summary = gc.calculation_complete(result).unwrap();
        assert!(summary.save);
        assert_eq!(summary.code_cells_modified, HashSet::from([sheet_id]));

        let code_cell_value = gc
            .sheet(sheet_id)
            .get_code_cell(Pos { x: 1, y: 0 })
            .unwrap()
            .to_owned();

        (gc, code_cell_value)
    }

    fn python_array(
        gc: GridController,
        array: Vec<i32>,
        start_x: u32,
    ) -> (GridController, CodeCellValue) {
        let cell_value = CellValue::Blank;
        let numbers = array
            .iter()
            .map(|x| x.to_string())
            .collect::<Vec<String>>()
            .join(",");
        let strings = numbers.replace(',', r#"",""#);
        let code_string = format!("[{}]", numbers);
        let expected = code_string.clone();
        let array_output = format!(r#"[["{}"]]"#, strings);

        // maintain ownership of gc so that we can reuse for smaller array
        let (gc, code_cell_value) = test_python(
            Some(gc),
            code_string,
            cell_value.clone(),
            expected.clone(),
            Some(array_output),
        );
        let assert_at_pos = |x: u32, y: u32, value: u32| {
            assert_eq!(
                code_cell_value.get_output_value(x, y),
                Some(CellValue::Number(BigDecimal::from(value)))
            );
        };

        for (x, number) in array.iter().enumerate() {
            assert_at_pos(x as u32 + start_x, 0, *number as u32);
        }

        (gc, code_cell_value)
    }

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
