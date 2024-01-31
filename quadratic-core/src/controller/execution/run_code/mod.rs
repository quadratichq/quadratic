use chrono::Utc;

use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::error_core::{CoreError, Result};
use crate::grid::CodeRunResult;
use crate::{
    controller::{transaction_types::JsCodeResult, GridController},
    grid::{CodeCellLanguage, CodeRun},
    Array, CellValue, Pos, RunError, RunErrorMsg, SheetPos, SheetRect, Span, Value,
};

pub mod get_cells;
pub mod run_formula;
pub mod run_python;

impl GridController {
    /// finalize changes to a code_run
    pub(crate) fn finalize_code_run(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        new_code_run: Option<CodeRun>,
        index: Option<usize>,
    ) {
        let sheet_id = sheet_pos.sheet_id;
        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            // sheet may have been deleted
            return;
        };
        let pos: Pos = sheet_pos.into();

        // index for SetCodeRun is either set by execute_set_code_run or calculated
        let index = index.unwrap_or(
            sheet
                .code_runs
                .iter()
                .position(|(p, _)| p == &pos)
                .unwrap_or(sheet.code_runs.len()),
        );

        let old_code_run = if let Some(new_code_run) = &new_code_run {
            if new_code_run.is_html() {
                transaction.summary.html.insert(sheet_id);
            }
            let (old_index, old_code_run) = sheet.code_runs.insert_full(pos, new_code_run.clone());

            // keep the orderings of the code runs consistent, particularly when undoing/redoing
            let index = if index > sheet.code_runs.len() - 1 {
                sheet.code_runs.len() - 1
            } else {
                index
            };
            sheet.code_runs.move_index(old_index, index);
            old_code_run
        } else {
            sheet.code_runs.remove(&pos)
        };

        if let Some(old_code_run) = &old_code_run {
            if old_code_run.is_html() {
                transaction.summary.html.insert(sheet_id);
            }
        }

        let sheet_rect = match (&old_code_run, &new_code_run) {
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

        transaction.forward_operations.push(Operation::SetCodeRun {
            sheet_pos,
            code_run: new_code_run,
            index,
        });

        transaction.reverse_operations.insert(
            0,
            Operation::SetCodeRun {
                sheet_pos,
                code_run: old_code_run,
                index,
            },
        );

        if transaction.is_user() {
            self.add_compute_operations(transaction, &sheet_rect, Some(sheet_pos));
            self.check_all_spills(transaction, sheet_pos.sheet_id);
        }

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
        match transaction.waiting_for_async {
            None => {
                return Err(CoreError::TransactionNotFound("Expected transaction to be waiting_for_async to be defined in transaction::complete".into()));
            }
            Some(waiting_for_async) => match waiting_for_async {
                CodeCellLanguage::Python => {
                    let new_code_run = self.js_code_result_to_code_cell_value(
                        transaction,
                        result,
                        current_sheet_pos,
                    );

                    self.finalize_code_run(
                        transaction,
                        current_sheet_pos,
                        Some(new_code_run),
                        None,
                    );
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
        self.start_transaction(transaction);
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
        let sheet_id = sheet_pos.sheet_id;
        let pos = Pos::from(sheet_pos);
        let Some(sheet) = self.try_sheet(sheet_id) else {
            // sheet may have been deleted before the async operation completed
            return Ok(());
        };

        // ensure the code_cell still exists
        let Some(code_cell) = sheet.cell_value(pos) else {
            // cell may have been deleted before the async operation completed
            return Ok(());
        };
        if !matches!(code_cell, CellValue::Code(_)) {
            // code may have been replaced while waiting for async operation
            return Ok(());
        }

        let msg = RunErrorMsg::PythonError(error_msg.clone().into());
        let span = line_number.map(|line_number| Span {
            start: line_number as u32,
            end: line_number as u32,
        });
        let error = RunError { span, msg };
        let result = CodeRunResult::Err(error);

        let new_code_run = match sheet.code_run(pos) {
            Some(old_code_run) => {
                CodeRun {
                    formatted_code_string: old_code_run.formatted_code_string.clone(),
                    result,
                    std_out: None,
                    std_err: Some(error_msg),
                    spill_error: false,
                    last_modified: Utc::now(),

                    // keep the old cells_accessed to better rerun after an error
                    cells_accessed: old_code_run.cells_accessed.clone(),
                }
            }
            None => CodeRun {
                formatted_code_string: None,
                result,
                std_out: None,
                std_err: Some(error_msg),
                spill_error: false,
                last_modified: Utc::now(),
                cells_accessed: transaction.cells_accessed.clone(),
            },
        };
        self.finalize_code_run(transaction, sheet_pos, Some(new_code_run), None);
        transaction
            .summary
            .code_cells_modified
            .insert(sheet_pos.sheet_id);
        transaction.waiting_for_async = None;
        Ok(())
    }

    // Returns a CodeCellValue from a JsCodeResult.
    pub(super) fn js_code_result_to_code_cell_value(
        &mut self,
        transaction: &mut PendingTransaction,
        js_code_result: JsCodeResult,
        start: SheetPos,
    ) -> CodeRun {
        let Some(sheet) = self.try_sheet_mut(start.sheet_id) else {
            // todo: this is probably not the best place to handle this
            // sheet may have been deleted before the async operation completed
            return CodeRun {
                formatted_code_string: None,
                result: CodeRunResult::Err(RunError {
                    span: None,
                    msg: RunErrorMsg::PythonError(
                        "Sheet was deleted before the async operation completed".into(),
                    ),
                }),
                std_out: None,
                std_err: None,
                spill_error: false,
                last_modified: Utc::now(),
                cells_accessed: transaction.cells_accessed.clone(),
            };
        };
        let result = if js_code_result.success() {
            let result = if let Some(array_output) = js_code_result.array_output() {
                let (array, ops) = Array::from_string_list(start.into(), sheet, array_output);
                transaction.reverse_operations.splice(0..0, ops);
                if let Some(array) = array {
                    Value::Array(array)
                } else {
                    Value::Single("".into())
                }
            } else if let Some(output_value) = js_code_result.output_value() {
                let (cell_value, ops) = CellValue::from_string(&output_value, start.into(), sheet);
                transaction.reverse_operations.splice(0..0, ops);
                Value::Single(cell_value)
            } else {
                unreachable!("js_code_result_to_code_cell_value: no output")
            };
            CodeRunResult::Ok(result)
        } else {
            let error_msg = js_code_result
                .error_msg()
                .unwrap_or_else(|| "Unknown Python Error".into());
            let msg = RunErrorMsg::PythonError(error_msg.into());
            let span = js_code_result.line_number().map(|line_number| Span {
                start: line_number,
                end: line_number,
            });
            CodeRunResult::Err(RunError { span, msg })
        };
        let code_run = CodeRun {
            formatted_code_string: js_code_result.formatted_code().clone(),
            result,
            std_out: js_code_result.input_python_std_out(),
            std_err: js_code_result.error_msg(),
            spill_error: false,
            last_modified: Utc::now(),
            cells_accessed: transaction.cells_accessed.clone(),
        };
        transaction.cells_accessed.clear();
        code_run
    }
}

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use crate::{controller::transaction_summary::CellSheetsModified, CodeCellValue};

    use super::*;

    #[test]
    fn test_finalize_code_cell() {
        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];

        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };

        // manually set the CellValue::Code
        let sheet = gc.try_sheet_mut(sheet_id).unwrap();
        sheet.set_cell_value(
            sheet_pos.into(),
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Python,
                code: "delete me".to_string(),
            }),
        );

        // manually create the transaction
        let transaction = &mut PendingTransaction::default();

        // test finalize_code_cell
        let new_code_run = CodeRun {
            formatted_code_string: None,
            std_err: None,
            std_out: None,
            result: CodeRunResult::Ok(Value::Single(CellValue::Text("delete me".to_string()))),
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            spill_error: false,
        };
        gc.finalize_code_run(transaction, sheet_pos, Some(new_code_run.clone()), None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.code_run(sheet_pos.into()), Some(&new_code_run));
        let summary = transaction.prepare_summary(true);
        assert_eq!(summary.code_cells_modified.len(), 1);
        assert!(summary.code_cells_modified.contains(&sheet_id));
        assert!(summary.generate_thumbnail);
        assert_eq!(summary.cell_sheets_modified.len(), 1);
        assert!(summary
            .cell_sheets_modified
            .iter()
            .any(|c| c == &CellSheetsModified::new(sheet_pos)));

        // replace the code_run with another code_run
        // manually create the transaction
        let transaction = &mut PendingTransaction::default();

        // test finalize_code_cell
        let new_code_run = CodeRun {
            formatted_code_string: None,
            std_err: None,
            std_out: None,
            result: CodeRunResult::Ok(Value::Single(CellValue::Text("replace me".to_string()))),
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            spill_error: false,
        };
        gc.finalize_code_run(transaction, sheet_pos, Some(new_code_run.clone()), None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.code_run(sheet_pos.into()), Some(&new_code_run));
        let summary = transaction.prepare_summary(true);
        assert_eq!(summary.code_cells_modified.len(), 1);
        assert!(summary.code_cells_modified.contains(&sheet_id));
        assert!(summary.generate_thumbnail);
        assert_eq!(summary.cell_sheets_modified.len(), 1);
        assert!(summary
            .cell_sheets_modified
            .iter()
            .any(|c| c == &CellSheetsModified::new(sheet_pos)));

        // remove the code_run
        let transaction = &mut PendingTransaction::default();
        gc.finalize_code_run(transaction, sheet_pos, None, None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.code_run(sheet_pos.into()), None);
        let summary = transaction.prepare_summary(true);
        assert_eq!(summary.code_cells_modified.len(), 1);
        assert!(summary.code_cells_modified.contains(&sheet_id));
        assert!(summary.generate_thumbnail);
        assert_eq!(summary.cell_sheets_modified.len(), 1);
        assert!(summary
            .cell_sheets_modified
            .iter()
            .any(|c| c == &CellSheetsModified::new(sheet_pos)));
    }
}
