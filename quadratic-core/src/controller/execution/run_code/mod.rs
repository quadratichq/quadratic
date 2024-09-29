use chrono::Utc;

use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::transaction_types::JsCodeResult;
use crate::controller::GridController;
use crate::error_core::{CoreError, Result};
use crate::grid::js_types::JsHtmlOutput;
use crate::grid::{CodeCellLanguage, CodeRun, CodeRunResult};
use crate::{Array, CellValue, Pos, RunError, RunErrorMsg, SheetPos, SheetRect, Span, Value};

pub mod get_cells;
pub mod run_connection;
pub mod run_formula;
pub mod run_javascript;
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

        let mut update_html = false;
        let mut update_image = false;
        let old_code_run = if let Some(new_code_run) = &new_code_run {
            if new_code_run.is_html()
                && (cfg!(target_family = "wasm") || cfg!(test))
                && !transaction.is_server()
            {
                update_html = true;
            }
            if new_code_run.is_image()
                && (cfg!(target_family = "wasm") || cfg!(test))
                && !transaction.is_server()
            {
                update_image = true;
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
            sheet.code_runs.shift_remove(&pos)
        };
        if old_code_run == new_code_run {
            return;
        }

        if cfg!(target_family = "wasm") || cfg!(test) {
            // if there was html here, send the html update to the client
            if let Some(old_code_run) = &old_code_run {
                if old_code_run.is_html() && !transaction.is_server() {
                    update_html = true;
                }
                if old_code_run.is_image() && !transaction.is_server() {
                    update_image = true;
                }
                // if the code run is being removed, tell the client that there is no longer a code cell
                if new_code_run.is_none() && !transaction.is_server() {
                    crate::wasm_bindings::js::jsUpdateCodeCell(
                        sheet_id.to_string(),
                        sheet_pos.x,
                        sheet_pos.y,
                        None,
                        None,
                    );
                }
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

        if update_html {
            let html = sheet.get_single_html_output(pos).unwrap_or(JsHtmlOutput {
                sheet_id: sheet_id.to_string(),
                x: pos.x,
                y: pos.y,
                html: None,
                w: None,
                h: None,
            });
            if let Ok(html) = serde_json::to_string(&html) {
                crate::wasm_bindings::js::jsUpdateHtml(html);
            } else {
                dbgjs!("Error serializing html");
            }
        }

        if update_image {
            self.send_image(sheet_pos);
        }

        transaction.forward_operations.push(Operation::SetCodeRun {
            sheet_pos,
            code_run: new_code_run,
            index,
        });

        transaction.reverse_operations.push(Operation::SetCodeRun {
            sheet_pos,
            code_run: old_code_run,
            index,
        });

        if transaction.is_user() {
            self.add_compute_operations(transaction, &sheet_rect, Some(sheet_pos));
            self.check_all_spills(transaction, sheet_pos.sheet_id, true);
        }
        transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(&sheet_rect);

        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                if let (Some(code_cell), Some(render_code_cell)) = (
                    sheet.edit_code_value(sheet_pos.into()),
                    sheet.get_render_code_cell(sheet_pos.into()),
                ) {
                    if let (Ok(code_cell), Ok(render_code_cell)) = (
                        serde_json::to_string(&code_cell),
                        serde_json::to_string(&render_code_cell),
                    ) {
                        crate::wasm_bindings::js::jsUpdateCodeCell(
                            sheet_id.to_string(),
                            sheet_pos.x,
                            sheet_pos.y,
                            Some(code_cell),
                            Some(render_code_cell),
                        );
                    }
                }
            }
            self.send_updated_bounds_rect(&sheet_rect, false);
            transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);
            if transaction.is_user() {
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    let rows = sheet.get_rows_with_wrap_in_rect(&sheet_rect.into());
                    if !rows.is_empty() {
                        let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                        resize_rows.extend(rows);
                    }
                }
            }
        }
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
        match &transaction.waiting_for_async {
            None => {
                return Err(CoreError::TransactionNotFound("Expected transaction to be waiting_for_async to be defined in transaction::complete".into()));
            }
            Some(waiting_for_async) => match waiting_for_async {
                CodeCellLanguage::Python | CodeCellLanguage::Javascript => {
                    let new_code_run = self.js_code_result_to_code_cell_value(
                        transaction,
                        result,
                        current_sheet_pos,
                    );

                    transaction.waiting_for_async = None;
                    self.finalize_code_run(
                        transaction,
                        current_sheet_pos,
                        Some(new_code_run),
                        None,
                    );
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
        error: &RunError,
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
        let CellValue::Code(code_cell_value) = code_cell else {
            // code may have been replaced while waiting for async operation
            return Ok(());
        };

        let result = CodeRunResult::Err(error.clone());

        let new_code_run = match sheet.code_run(pos) {
            Some(old_code_run) => {
                CodeRun {
                    formatted_code_string: old_code_run.formatted_code_string.clone(),
                    result,
                    return_type: None,
                    line_number: old_code_run.line_number,
                    output_type: old_code_run.output_type.clone(),
                    std_out: None,
                    std_err: Some(error.msg.to_string()),
                    spill_error: false,
                    last_modified: Utc::now(),

                    // keep the old cells_accessed to better rerun after an error
                    cells_accessed: old_code_run.cells_accessed.clone(),
                }
            }
            None => CodeRun {
                formatted_code_string: None,
                result,
                return_type: None,
                line_number: error
                    .span
                    .map(|span| span.line_number_of_str(&code_cell_value.code) as u32),
                output_type: None,
                std_out: None,
                std_err: Some(error.msg.to_string()),
                spill_error: false,
                last_modified: Utc::now(),
                cells_accessed: transaction.cells_accessed.clone(),
            },
        };
        transaction.waiting_for_async = None;
        self.finalize_code_run(transaction, sheet_pos, Some(new_code_run), None);

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
                return_type: None,
                line_number: js_code_result.line_number,
                output_type: js_code_result.output_display_type,
                std_out: None,
                std_err: None,
                spill_error: false,
                last_modified: Utc::now(),
                cells_accessed: transaction.cells_accessed.clone(),
            };
        };
        let result = if js_code_result.success {
            let result = if let Some(array_output) = js_code_result.output_array {
                let (array, ops) = Array::from_string_list(start.into(), sheet, array_output);
                transaction.reverse_operations.extend(ops);
                if let Some(array) = array {
                    Value::Array(array)
                } else {
                    Value::Single("".into())
                }
            } else if let Some(output_value) = js_code_result.output_value {
                let (cell_value, ops) =
                    CellValue::from_js(&output_value[0], &output_value[1], start.into(), sheet)
                        .unwrap_or_else(|e| {
                            dbgjs!(format!("Cannot parse {:?}: {}", output_value, e));
                            (CellValue::Blank, vec![])
                        });
                transaction.reverse_operations.extend(ops);
                Value::Single(cell_value)
            } else {
                Value::Single(CellValue::Blank)
            };
            CodeRunResult::Ok(result)
        } else {
            let error_msg = js_code_result
                .std_err
                .clone()
                .unwrap_or_else(|| "Unknown Error".into());
            let msg = RunErrorMsg::PythonError(error_msg.into());
            let span = js_code_result.line_number.map(|line_number| Span {
                start: line_number,
                end: line_number,
            });
            CodeRunResult::Err(RunError { span, msg })
        };

        let return_type = match result {
            CodeRunResult::Ok(Value::Single(ref cell_value)) => Some(cell_value.type_name().into()),
            CodeRunResult::Ok(Value::Array(_)) => Some("array".into()),
            CodeRunResult::Ok(Value::Tuple(_)) => Some("tuple".into()),
            CodeRunResult::Err(_) => None,
        };

        let code_run = CodeRun {
            formatted_code_string: None,
            result,
            return_type,
            line_number: js_code_result.line_number,
            output_type: js_code_result.output_display_type,
            std_out: js_code_result.std_out,
            std_err: js_code_result.std_err,
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

    use serial_test::{parallel, serial};

    use super::*;
    use crate::wasm_bindings::js::expect_js_call_count;
    use crate::CodeCellValue;

    #[test]
    #[parallel]
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
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            spill_error: false,
        };
        gc.finalize_code_run(transaction, sheet_pos, Some(new_code_run.clone()), None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.code_run(sheet_pos.into()), Some(&new_code_run));

        // todo: need a way to test the js functions as that replaced these
        // let summary = transaction.send_transaction(true);
        // assert_eq!(summary.code_cells_modified.len(), 1);
        // assert!(summary.code_cells_modified.contains(&sheet_id));
        // assert!(summary.generate_thumbnail);

        // replace the code_run with another code_run
        // manually create the transaction
        let transaction = &mut PendingTransaction::default();

        // test finalize_code_cell
        let new_code_run = CodeRun {
            formatted_code_string: None,
            std_err: None,
            std_out: None,
            result: CodeRunResult::Ok(Value::Single(CellValue::Text("replace me".to_string()))),
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
            last_modified: Utc::now(),
            cells_accessed: HashSet::new(),
            spill_error: false,
        };
        gc.finalize_code_run(transaction, sheet_pos, Some(new_code_run.clone()), None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.code_run(sheet_pos.into()), Some(&new_code_run));

        // todo: need a way to test the js functions as that replaced these
        // let summary = transaction.send_transaction(true);
        // assert_eq!(summary.code_cells_modified.len(), 1);
        // assert!(summary.code_cells_modified.contains(&sheet_id));
        // assert!(summary.generate_thumbnail);

        // remove the code_run
        let transaction = &mut PendingTransaction::default();
        gc.finalize_code_run(transaction, sheet_pos, None, None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.code_run(sheet_pos.into()), None);

        // todo: need a way to test the js functions as that replaced these
        // let summary = transaction.send_transaction(true);
        // assert_eq!(summary.code_cells_modified.len(), 1);
        // assert!(summary.code_cells_modified.contains(&sheet_id));
        // assert!(summary.generate_thumbnail);
    }

    #[test]
    #[serial]
    fn code_run_image() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 0,
            y: 0,
            sheet_id,
        };
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Javascript,
            "code".to_string(),
            None,
        );
        let transaction = gc.last_transaction().unwrap();
        let result = JsCodeResult {
            transaction_id: transaction.id.to_string(),
            success: true,
            std_out: None,
            std_err: None,
            line_number: None,
            output_value: Some(vec!["test".into(), "image".into()]),
            output_array: None,
            output_display_type: None,
            cancel_compute: None,
        };
        gc.calculation_complete(result).unwrap();
        expect_js_call_count("jsSendImage", 1, true);
    }
}
