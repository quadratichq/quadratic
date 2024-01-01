use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::error_core::{CoreError, Result};
use crate::{
    controller::{transaction_types::JsCodeResult, GridController},
    grid::{CodeCellLanguage, CodeRun, CodeRun, CodeRunOutput},
    util::date_string,
    Array, CellValue, Pos, RunError, RunErrorMsg, SheetPos, SheetRect, Span, Value,
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
        old_code_cell_value: Option<CodeRun>,
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
    ) -> Result<()> {
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

                    // set the new value. Just return if the sheet is not defined (as it may have been deleted by a concurrent user)
                    let old_code_cell_value = if let Some(sheet) =
                        self.try_sheet_mut_from_id(current_sheet_pos.sheet_id)
                    {
                        sheet.set_code_result(
                            current_sheet_pos.into(),
                            Some(updated_code_cell_value),
                        )
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
        Ok(())
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
            None => Err(CoreError::TransactionNotFound(
                "Expected current_code_cell to be defined in transaction::code_cell_error".into(),
            )),
            Some(update_code_cell_value) => {
                let mut code_cell_value = update_code_cell_value.clone();
                code_cell_value.last_modified = date_string();
                let msg = RunErrorMsg::PythonError(error_msg.clone().into());
                let span = line_number.map(|line_number| Span {
                    start: line_number as u32,
                    end: line_number as u32,
                });
                let error = RunError { span, msg };
                let result = CodeRun::Err { error };
                code_cell_value.output = Some(CodeRunOutput {
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
    ) -> CodeRun {
        let sheet = self.grid_mut().sheet_mut_from_id(start.sheet_id);
        let result = if js_code_result.success() {
            CodeRun::Ok {
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
            let msg = RunErrorMsg::PythonError(error_msg.into());
            let span = js_code_result.line_number().map(|line_number| Span {
                start: line_number,
                end: line_number,
            });
            CodeRun::Err {
                error: RunError { span, msg },
            }
        };
        transaction.cells_accessed.clear();
        CodeRun {
            language,
            code_string,
            formatted_code_string: js_code_result.formatted_code().clone(),
            output: Some(CodeRunOutput {
                std_out: js_code_result.input_python_std_out(),
                std_err: js_code_result.error_msg(),
                result,
                spill: false,
            }),
            last_modified: date_string(),
        }
    }
}
