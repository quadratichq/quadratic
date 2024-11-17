use std::collections::HashSet;

use chrono::Utc;
use itertools::Itertools;
use uuid::Uuid;

use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    error_core,
    formulas::{parse_formula, Ctx},
    grid::{js_types::JsCodeRun, CodeCellLanguage, CodeRun, CodeRunResult},
    CellValue, RunError, RunErrorMsg, SheetPos, SheetRect, Value,
};

struct ParsedAIResearcherCode {
    query: String,
    ref_cell_values: Vec<String>,
    cells_accessed: HashSet<SheetRect>,
}

impl GridController {
    fn parse_ai_researcher_code(
        &mut self,
        sheet_pos: SheetPos,
    ) -> Result<ParsedAIResearcherCode, RunError> {
        let sheet_id = sheet_pos.sheet_id;
        let Some(sheet) = self.try_sheet(sheet_id) else {
            // sheet may have been deleted in a multiplayer operation
            return Err(RunError {
                span: None,
                msg: RunErrorMsg::Unexpected("Sheet not found".into()),
            });
        };

        // We need to get the corresponding CellValue::Code
        let (language, code) = match sheet.cell_value(sheet_pos.to_owned().into()) {
            Some(CellValue::Code(value)) => (value.language, value.code),

            // handles the case where run_ai_researcher is running on a non-code cell (maybe changed b/c of a MP operation?)
            _ => {
                return Err(RunError {
                    span: None,
                    msg: RunErrorMsg::Unexpected("Expected a code cell".into()),
                })
            }
        };

        if language != CodeCellLanguage::AIResearcher {
            // handles the case where run_ai_researcher is running on a non ai researcher code cell (maybe changed b/c of a MP operation?)
            return Err(RunError {
                span: None,
                msg: RunErrorMsg::Unexpected("Expected an AI researcher code cell".into()),
            });
        }

        let mut ctx = Ctx::new(self.grid(), sheet_pos);
        match parse_formula(&code, sheet_pos.into()) {
            Ok(parsed) => {
                if let Value::Tuple(vec) = parsed.eval(&mut ctx).inner {
                    if let Some((query, values_array)) = vec.into_iter().next_tuple() {
                        if let Ok(query) = query.into_cell_value() {
                            Ok(ParsedAIResearcherCode {
                                query: query.to_display(),
                                ref_cell_values: values_array
                                    .into_cell_values_vec()
                                    .into_iter()
                                    .map(|v| v.to_display())
                                    .collect::<Vec<String>>(),
                                cells_accessed: ctx.cells_accessed,
                            })
                        } else {
                            Err(RunError {
                                span: None,
                                msg: RunErrorMsg::InvalidArgument,
                            })
                        }
                    } else {
                        Err(RunError {
                            span: None,
                            msg: RunErrorMsg::InvalidArgument,
                        })
                    }
                } else {
                    Err(RunError {
                        span: None,
                        msg: RunErrorMsg::InvalidArgument,
                    })
                }
            }
            Err(error) => {
                dbgjs!(format!(
                    "[run_ai_researcher] error in parse_ai_researcher_code: code {:?}, error {:?}",
                    code, error
                ));
                Err(error)
            }
        }
    }

    pub(crate) fn run_ai_researcher_parallel(
        &mut self,
        transaction: &mut PendingTransaction,
    ) -> bool {
        if transaction.pending_ai_researcher.is_empty() {
            return false;
        }

        // all ai researcher requests that are currently pending or running
        let mut all_ai_researcher = HashSet::new();
        all_ai_researcher.extend(transaction.pending_ai_researcher.clone());
        all_ai_researcher.extend(transaction.running_ai_researcher.clone());

        // ai researcher requests that are dependent on other ai researcher request currently pending
        let pending_ai_researcher = transaction.pending_ai_researcher.clone();

        let mut dependent_ai_researcher: HashSet<SheetPos> = HashSet::new();
        for sheet_pos in pending_ai_researcher.iter() {
            match self.parse_ai_researcher_code(sheet_pos.to_owned()) {
                Ok(ParsedAIResearcherCode {
                    query,
                    ref_cell_values,
                    cells_accessed,
                }) => {
                    // check if the current ai researcher request is dependent on any other ai researcher request that is currently pending or running
                    let mut referenced_cell_has_error = false;
                    let mut has_circular_reference = false;
                    let mut is_dependent = false;
                    let mut seen_code_cells = HashSet::new();
                    seen_code_cells.insert(sheet_pos.to_owned());
                    let mut cells_accessed_to_check = cells_accessed.iter().collect::<Vec<_>>();
                    while let Some(cell_accessed) = cells_accessed_to_check.pop() {
                        if referenced_cell_has_error || has_circular_reference || is_dependent {
                            break;
                        }

                        // circular reference to itself
                        has_circular_reference |= cell_accessed
                            .intersects(SheetRect::single_sheet_pos(sheet_pos.to_owned()));

                        // dependent on another ai researcher request
                        is_dependent |= all_ai_researcher.iter().any(|ai_researcher| {
                            cell_accessed
                                .intersects(SheetRect::single_sheet_pos(ai_researcher.to_owned()))
                        });

                        let sheet_id = cell_accessed.sheet_id;
                        if let Some(sheet) = self.try_sheet(sheet_id) {
                            for (output_rect, code_run) in
                                sheet.iter_code_output_in_rect(cell_accessed.to_owned().into())
                            {
                                let code_cell_pos = output_rect.min;
                                if !seen_code_cells.insert(code_cell_pos.to_sheet_pos(sheet_id)) {
                                    continue;
                                }

                                if code_run.spill_error || code_run.result.as_std_ref().is_err() {
                                    referenced_cell_has_error = true;
                                    break;
                                }

                                let new_cells_accessed = code_run
                                    .cells_accessed
                                    .difference(&cells_accessed)
                                    .collect::<Vec<_>>();
                                cells_accessed_to_check.extend(new_cells_accessed);
                            }
                        }
                    }

                    if referenced_cell_has_error {
                        transaction.pending_ai_researcher.remove(sheet_pos);
                        let run_error = RunError {
                            span: None,
                            msg: RunErrorMsg::CodeRunError("Error in referenced cell(s)".into()),
                        };
                        transaction.current_sheet_pos = Some(sheet_pos.to_owned());
                        let _ = self.code_cell_sheet_error(transaction, &run_error);
                    } else if has_circular_reference {
                        transaction.pending_ai_researcher.remove(sheet_pos);
                        let run_error = RunError {
                            span: None,
                            msg: RunErrorMsg::CircularReference,
                        };
                        transaction.current_sheet_pos = Some(sheet_pos.to_owned());
                        let _ = self.code_cell_sheet_error(transaction, &run_error);
                    } else if is_dependent {
                        dependent_ai_researcher.insert(sheet_pos.to_owned());
                    } else {
                        self.request_ai_researcher_result(
                            transaction,
                            sheet_pos.to_owned(),
                            query,
                            ref_cell_values,
                        );
                    }
                }
                Err(error) => {
                    transaction.pending_ai_researcher.remove(sheet_pos);
                    transaction.current_sheet_pos = Some(sheet_pos.to_owned());
                    let _ = self.code_cell_sheet_error(transaction, &error);
                }
            }
        }

        // circular reference
        // the ai researcher cells are dependent on other ai researcher requests
        if pending_ai_researcher == dependent_ai_researcher {
            let run_error = RunError {
                span: None,
                msg: RunErrorMsg::CircularReference,
            };
            for sheet_pos in pending_ai_researcher.iter() {
                transaction.pending_ai_researcher.remove(sheet_pos);
                transaction.current_sheet_pos = Some(sheet_pos.to_owned());
                let _ = self.code_cell_sheet_error(transaction, &run_error);
            }
        }

        self.send_ai_researcher_state(transaction);
        !transaction.running_ai_researcher.is_empty()
    }

    fn request_ai_researcher_result(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        query: String,
        ref_cell_values: Vec<String>,
    ) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || !transaction.is_user() {
            return;
        }

        if let Ok(sheet_pos_str) = serde_json::to_string(&sheet_pos) {
            crate::wasm_bindings::js::jsRequestAIResearcherResult(
                transaction.id.to_string(),
                sheet_pos_str,
                query,
                ref_cell_values.join(", "),
            );
            transaction.pending_ai_researcher.remove(&sheet_pos);
            transaction.running_ai_researcher.insert(sheet_pos);
            transaction.waiting_for_async = Some(CodeCellLanguage::AIResearcher);
            self.transactions.add_async_transaction(transaction);
        }
    }

    pub fn receive_ai_researcher_result(
        &mut self,
        transaction_id: Uuid,
        sheet_pos: SheetPos,
        result: Option<String>,
        error: Option<String>,
    ) -> error_core::Result<()> {
        if let Ok(mut transaction) = self.transactions.remove_awaiting_async(transaction_id) {
            transaction.current_sheet_pos = Some(sheet_pos);
            transaction.cells_accessed.clear();
            if let Ok(ParsedAIResearcherCode { cells_accessed, .. }) =
                self.parse_ai_researcher_code(sheet_pos.to_owned())
            {
                transaction.cells_accessed = cells_accessed;
            }

            transaction.running_ai_researcher.remove(&sheet_pos);
            if transaction.running_ai_researcher.is_empty() {
                transaction.waiting_for_async = None;
            }

            let result = match result {
                Some(result) => {
                    CodeRunResult::Ok(Value::Single(CellValue::parse_from_str(&result)))
                }
                None => CodeRunResult::Err(RunError {
                    span: None,
                    msg: RunErrorMsg::InternalError("API request failed".into()),
                }),
            };

            let new_code_run = CodeRun {
                std_out: None,
                std_err: error,
                formatted_code_string: None,
                spill_error: false,
                last_modified: Utc::now(),
                cells_accessed: transaction.cells_accessed.clone(),
                result,
                return_type: None,
                line_number: None,
                output_type: None,
            };

            self.finalize_code_run(&mut transaction, sheet_pos, Some(new_code_run), None);
            self.send_ai_researcher_state(&transaction);

            self.start_transaction(&mut transaction);
            self.finalize_transaction(transaction);
        } else {
            dbgjs!("[run_ai_researcher] receive_ai_researcher_result: transaction not found");
        }

        Ok(())
    }

    fn send_ai_researcher_state(&mut self, transaction: &PendingTransaction) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || !transaction.is_user() {
            return;
        }

        let current_code_run = transaction
            .running_ai_researcher
            .iter()
            .map(|sheet_pos| JsCodeRun {
                transaction_id: transaction.id.to_string(),
                sheet_pos: sheet_pos.to_owned().into(),
                code: String::new(),
            })
            .collect::<Vec<JsCodeRun>>();

        let awaiting_execution = transaction
            .pending_ai_researcher
            .iter()
            .map(|sheet_pos| JsCodeRun {
                transaction_id: transaction.id.to_string(),
                sheet_pos: sheet_pos.to_owned().into(),
                code: String::new(),
            })
            .collect::<Vec<JsCodeRun>>();

        if let Ok(current_string) = serde_json::to_string(&current_code_run) {
            if let Ok(awaiting_execution_string) = serde_json::to_string(&awaiting_execution) {
                crate::wasm_bindings::js::jsAIResearcherState(
                    current_string,
                    awaiting_execution_string,
                );
            }
        }
    }
}
