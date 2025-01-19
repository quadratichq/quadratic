use std::collections::HashSet;

use chrono::Utc;
use itertools::Itertools;
use uuid::Uuid;

use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    error_core,
    formulas::{parse_formula, Ctx},
    grid::{
        js_types::{JsCellValuePos, JsCodeRun},
        CellsAccessed, CodeCellLanguage, CodeRun, CodeRunResult,
    },
    Array, CellValue, RunError, RunErrorMsg, SheetPos, Value,
};

#[derive(Debug, PartialEq)]
struct ParsedAIResearcherCode {
    query: String,
    ref_cell_values: Vec<String>,
    cells_accessed: CellsAccessed,
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
        let bounds = sheet.bounds(true);
        match parse_formula(&code, sheet_pos.into()) {
            Ok(parsed) => {
                if let Value::Tuple(vec) = parsed.eval(&mut ctx, Some(bounds)).inner {
                    if let Some((query, values_array)) = vec.into_iter().next_tuple() {
                        if let Ok(query) = query.into_cell_value() {
                            if query == CellValue::Blank {
                                return Err(RunError {
                                    span: None,
                                    msg: RunErrorMsg::CodeRunError("Query cannot be blank".into()),
                                });
                            }

                            if let CellValue::Text(text) = query.as_ref() {
                                if text.is_empty() {
                                    return Err(RunError {
                                        span: None,
                                        msg: RunErrorMsg::CodeRunError(
                                            "Query cannot be blank".into(),
                                        ),
                                    });
                                }
                            }

                            let mut referenced_cell_has_error = false;

                            let ref_cell_values = values_array
                                .into_cell_values_vec()
                                .into_iter()
                                .map(|v| {
                                    if matches!(v, CellValue::Error(_)) {
                                        referenced_cell_has_error = true;
                                    }
                                    v.to_display()
                                })
                                .collect::<Vec<String>>();

                            if referenced_cell_has_error {
                                return Err(RunError {
                                    span: None,
                                    msg: RunErrorMsg::CodeRunError(
                                        "Error in referenced cell(s)".into(),
                                    ),
                                });
                            }

                            Ok(ParsedAIResearcherCode {
                                query: query.to_display(),
                                ref_cell_values,
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

    pub(crate) fn run_ai_researcher_parallel(&mut self, transaction: &mut PendingTransaction) {
        if transaction.pending_ai_researchers.is_empty() {
            return;
        }

        // all ai researcher requests that are currently pending or running
        let mut all_ai_researchers = HashSet::new();
        all_ai_researchers.extend(transaction.pending_ai_researchers.clone());
        all_ai_researchers.extend(transaction.running_ai_researchers.clone());

        // ai researcher requests that are dependent on other ai researcher request currently pending
        let pending_ai_researchers = transaction.pending_ai_researchers.clone();

        // check and build new ai researcher requests that are dependent on other ai researcher request currently pending
        let mut new_pending_ai_researchers: HashSet<SheetPos> = HashSet::new();

        for pending_ai_researcher in pending_ai_researchers.iter() {
            match self.parse_ai_researcher_code(pending_ai_researcher.to_owned()) {
                Ok(ParsedAIResearcherCode {
                    query,
                    ref_cell_values,
                    cells_accessed,
                }) => {
                    // dependent on another ai researcher request
                    let is_dependent = all_ai_researchers
                        .iter()
                        .any(|ai_researcher| cells_accessed.contains(ai_researcher.to_owned()));
                    if is_dependent {
                        new_pending_ai_researchers.insert(pending_ai_researcher.to_owned());
                        continue;
                    }

                    let mut has_circular_reference = false; // circular reference to itself
                    let mut referenced_cell_has_error = false; // check if referenced cell has error
                    let mut seen_code_cells = HashSet::from([pending_ai_researcher.to_owned()]);
                    let mut cells_accessed_to_check = vec![cells_accessed.clone()];
                    'outer: while let Some(cells_accessed) = cells_accessed_to_check.pop() {
                        if has_circular_reference || referenced_cell_has_error {
                            break;
                        }

                        if cells_accessed.contains(pending_ai_researcher.to_owned()) {
                            has_circular_reference = true;
                            break;
                        }

                        for selection in cells_accessed.to_selections() {
                            let sheet_id = selection.sheet_id;
                            if let Some(sheet) = self.try_sheet(sheet_id) {
                                for rect in sheet.selection_to_rects(&selection) {
                                    for (output_rect, code_run) in
                                        sheet.iter_code_output_in_rect(rect)
                                    {
                                        let code_cell_pos = output_rect.min;
                                        if !seen_code_cells
                                            .insert(code_cell_pos.to_sheet_pos(sheet_id))
                                        {
                                            continue;
                                        }

                                        if !all_ai_researchers
                                            .contains(&code_cell_pos.to_sheet_pos(sheet_id))
                                            && (code_run.spill_error
                                                || code_run.result.as_std_ref().is_err())
                                        {
                                            referenced_cell_has_error = true;
                                            break 'outer;
                                        }

                                        cells_accessed_to_check
                                            .push(code_run.cells_accessed.to_owned());
                                    }
                                }
                            }
                        }
                    }
                    if has_circular_reference || referenced_cell_has_error {
                        let msg = if has_circular_reference {
                            RunErrorMsg::CircularReference
                        } else {
                            RunErrorMsg::CodeRunError(
                                "Error in referenced / dependent cell(s)".into(),
                            )
                        };
                        let run_error = RunError { span: None, msg };

                        transaction
                            .pending_ai_researchers
                            .remove(pending_ai_researcher);
                        transaction.current_sheet_pos = Some(pending_ai_researcher.to_owned());
                        transaction.cells_accessed.clear();
                        let _ = self.code_cell_sheet_error(transaction, &run_error);
                        continue;
                    }

                    self.request_ai_researcher_result(
                        transaction,
                        pending_ai_researcher.to_owned(),
                        query,
                        ref_cell_values,
                        cells_accessed,
                    );
                }
                Err(error) => {
                    transaction
                        .pending_ai_researchers
                        .remove(pending_ai_researcher);
                    transaction.current_sheet_pos = Some(pending_ai_researcher.to_owned());
                    let _ = self.code_cell_sheet_error(transaction, &error);
                }
            }
        }

        // circular reference
        // the ai researcher cells are indirectly dependent on other ai researcher requests
        if pending_ai_researchers == new_pending_ai_researchers
            && transaction.running_ai_researchers.is_empty()
        {
            let run_error = RunError {
                span: None,
                msg: RunErrorMsg::CircularReference,
            };
            for sheet_pos in pending_ai_researchers.iter() {
                transaction.pending_ai_researchers.remove(sheet_pos);
                transaction.current_sheet_pos = Some(sheet_pos.to_owned());
                transaction.cells_accessed.clear();
                let _ = self.code_cell_sheet_error(transaction, &run_error);
            }
        }

        self.send_ai_researcher_state(transaction);

        // for tests, process all running ai researcher requests with a dummy result
        if cfg!(test) {
            transaction
                .running_ai_researchers
                .iter()
                .for_each(|sheet_pos| {
                    let _ = self.receive_ai_researcher_result(
                        transaction.id,
                        sheet_pos.to_owned(),
                        vec![vec!["result".to_string()]],
                        None,
                        None,
                    );
                });
        }
    }

    fn request_ai_researcher_result(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        query: String,
        ref_cell_values: Vec<String>,
        cells_accessed: CellsAccessed,
    ) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || !transaction.is_user() {
            return;
        }

        let mut all_accessed_values: Vec<Vec<Vec<JsCellValuePos>>> = Vec::new();
        for selection in cells_accessed.to_selections() {
            if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                for rect in sheet.selection_to_rects(&selection) {
                    let rect_values = sheet.get_js_cell_value_pos_in_rect(rect, None);
                    all_accessed_values.push(rect_values);
                }
            }
        }

        if let Ok(sheet_pos_str) = serde_json::to_string(&sheet_pos) {
            if let Ok(cells_accessed_values) = serde_wasm_bindgen::to_value(&all_accessed_values) {
                if cfg!(target_family = "wasm") || cfg!(test) {
                    crate::wasm_bindings::js::jsRequestAIResearcherResult(
                        transaction.id.to_string(),
                        sheet_pos_str,
                        query,
                        ref_cell_values.join(", "),
                        cells_accessed_values,
                    );
                }
                transaction.pending_ai_researchers.remove(&sheet_pos);
                transaction.running_ai_researchers.insert(sheet_pos);
                transaction.waiting_for_async = Some(CodeCellLanguage::AIResearcher);
                self.transactions.add_async_transaction(transaction);
            } else {
                let run_error = RunError {
                    span: None,
                    msg: RunErrorMsg::InternalError("Error in cells values context".into()),
                };
                transaction.pending_ai_researchers.remove(&sheet_pos);
                transaction.current_sheet_pos = Some(sheet_pos.to_owned());
                transaction.cells_accessed.clear();
                let _ = self.code_cell_sheet_error(transaction, &run_error);
            }
        } else {
            let run_error = RunError {
                span: None,
                msg: RunErrorMsg::InternalError("Error in sheet pos".into()),
            };
            transaction.pending_ai_researchers.remove(&sheet_pos);
            transaction.current_sheet_pos = Some(sheet_pos.to_owned());
            transaction.cells_accessed.clear();
            let _ = self.code_cell_sheet_error(transaction, &run_error);
        }
    }

    pub fn receive_ai_researcher_result(
        &mut self,
        transaction_id: Uuid,
        sheet_pos: SheetPos,
        cell_values: Vec<Vec<String>>,
        error: Option<String>,
        researcher_response_stringified: Option<String>,
    ) -> error_core::Result<()> {
        if let Ok(mut transaction) = self.transactions.remove_awaiting_async(transaction_id) {
            transaction.current_sheet_pos = Some(sheet_pos);
            transaction.cells_accessed.clear();
            if let Ok(ParsedAIResearcherCode { cells_accessed, .. }) =
                self.parse_ai_researcher_code(sheet_pos.to_owned())
            {
                transaction.cells_accessed = cells_accessed;
            }

            transaction.running_ai_researchers.remove(&sheet_pos);
            if transaction.running_ai_researchers.is_empty() {
                transaction.waiting_for_async = None;
            }

            let result = if !cell_values.is_empty() && !cell_values[0].is_empty() {
                CodeRunResult::Ok(Value::Array(Array::from(cell_values)))
            } else {
                CodeRunResult::Err(RunError {
                    span: None,
                    msg: RunErrorMsg::InternalError("API request failed".into()),
                })
            };

            let new_code_run = CodeRun {
                std_out: researcher_response_stringified,
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
            .running_ai_researchers
            .iter()
            .map(|sheet_pos| JsCodeRun {
                transaction_id: transaction.id.to_string(),
                sheet_pos: sheet_pos.to_owned().into(),
                code: String::new(),
            })
            .sorted_by(|js_code_run_a, js_code_run_b| {
                js_code_run_a.sheet_pos.cmp(&js_code_run_b.sheet_pos)
            })
            .collect::<Vec<JsCodeRun>>();

        let awaiting_execution = transaction
            .pending_ai_researchers
            .iter()
            .map(|sheet_pos| JsCodeRun {
                transaction_id: transaction.id.to_string(),
                sheet_pos: sheet_pos.to_owned().into(),
                code: String::new(),
            })
            .sorted_by(|js_code_run_a, js_code_run_b| {
                js_code_run_a.sheet_pos.cmp(&js_code_run_b.sheet_pos)
            })
            .collect::<Vec<JsCodeRun>>();

        if let Ok(current_string) = serde_json::to_string(&current_code_run) {
            if let Ok(awaiting_execution_string) = serde_json::to_string(&awaiting_execution) {
                if cfg!(target_family = "wasm") || cfg!(test) {
                    crate::wasm_bindings::js::jsAIResearcherState(
                        current_string,
                        awaiting_execution_string,
                    );
                }
            }
        }
    }
}

#[cfg(test)]
mod test {
    use serial_test::{parallel, serial};

    use super::ParsedAIResearcherCode;

    use crate::{
        controller::GridController,
        grid::{js_types::JsCodeRun, CellsAccessed, CodeCellLanguage, CodeRunResult, SheetId},
        wasm_bindings::js::{clear_js_calls, expect_js_call},
        CellValue, RunError, RunErrorMsg, SheetRect,
    };

    fn assert_no_pending_async_transaction(gc: &GridController) {
        let async_transaction = gc
            .transactions
            .get_async_transaction(gc.last_transaction().unwrap().id);
        assert!(async_transaction.is_err());
    }

    #[test]
    #[parallel]
    fn parse_ai_researcher_code() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            pos![A1].to_sheet_pos(sheet_id),
            vec![vec!["1"], vec!["2"], vec!["3"]],
            None,
        );

        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', A1:A3)".to_string(),
            None,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value(pos![B1]),
            Some(CellValue::Text("result".to_string()))
        );

        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![B1].to_sheet_pos(sheet_id));
        let mut cells_accessed = CellsAccessed::new();
        cells_accessed.add_sheet_rect(SheetRect::from_numbers(1, 1, 1, 3, sheet_id));
        assert_eq!(
            parsed_ai_researcher_code,
            Ok(ParsedAIResearcherCode {
                query: "query".to_string(),
                ref_cell_values: vec!["1".to_string(), "2".to_string(), "3".to_string()],
                cells_accessed,
            })
        );
        assert_no_pending_async_transaction(&gc);

        // incorrect argument
        gc.set_code_cell(
            pos![F5].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI()".to_string(),
            None,
        );
        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![F5].to_sheet_pos(sheet_id));
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::InvalidArgument,
            })
        );
        assert_no_pending_async_transaction(&gc);

        // incorrect argument
        gc.set_code_cell(
            pos![G6].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query')".to_string(),
            None,
        );
        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![G6].to_sheet_pos(sheet_id));
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::InvalidArgument,
            })
        );
        assert_no_pending_async_transaction(&gc);

        // incorrect argument
        gc.set_code_cell(
            pos![H7].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI(query, A1:A3)".to_string(),
            None,
        );
        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![H7].to_sheet_pos(sheet_id));
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("Query cannot be blank".into(),),
            })
        );
        assert_no_pending_async_transaction(&gc);

        // incorrect argument
        gc.set_code_cell(
            pos![I8].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI(query, ".to_string(),
            None,
        );
        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![I8].to_sheet_pos(sheet_id));
        assert!(parsed_ai_researcher_code.is_err());
        assert_no_pending_async_transaction(&gc);

        // self circular reference
        gc.set_code_cell(
            pos![J9].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', J9)".to_string(),
            None,
        );
        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![J9].to_sheet_pos(sheet_id));
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("Error in referenced cell(s)".into()),
            })
        );
        assert_no_pending_async_transaction(&gc);

        // different code cell language
        gc.set_code_cell(
            pos![K10].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "1+1".to_string(),
            None,
        );
        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![K10].to_sheet_pos(sheet_id));
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::Unexpected("Expected an AI researcher code cell".into()),
            })
        );
        assert_no_pending_async_transaction(&gc);

        // not a code cell
        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![L11].to_sheet_pos(sheet_id));
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::Unexpected("Expected a code cell".into()),
            })
        );

        // sheet not found
        let parsed_ai_researcher_code =
            gc.parse_ai_researcher_code(pos![M12].to_sheet_pos(SheetId::new()));
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::Unexpected("Sheet not found".into()),
            })
        );
    }

    #[test]
    #[parallel]
    fn run_ai_researcher_parallel_circular_reference_self() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // circular reference to itself
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', A1)".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let code_run = sheet.code_run((1, 1).into());
        assert!(code_run.is_some());
        assert_eq!(
            code_run.unwrap().result,
            CodeRunResult::Err(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("Error in referenced cell(s)".into()),
            })
        );

        assert_no_pending_async_transaction(&gc);
    }

    #[test]
    #[parallel]
    fn run_ai_researcher_parallel_circular_reference_on_dependent_ai_researcher() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', B1)".to_string(),
            None,
        );
        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', A1)".to_string(),
            None,
        );
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', C1)".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let code_run = sheet.code_run((1, 1).into());
        assert!(code_run.is_some());
        assert_eq!(
            code_run.unwrap().result,
            CodeRunResult::Err(RunError {
                span: None,
                msg: RunErrorMsg::CircularReference,
            })
        );

        assert_no_pending_async_transaction(&gc);
    }

    #[test]
    #[parallel]
    fn run_ai_researcher_parallel_circular_reference_on_dependent_code_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![C1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', B1)".to_string(),
            None,
        );
        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "A1".to_string(),
            None,
        );
        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', C1)".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let code_run = sheet.code_run((1, 1).into());
        assert!(code_run.is_some());
        assert_eq!(
            code_run.unwrap().result,
            CodeRunResult::Err(RunError {
                span: None,
                msg: RunErrorMsg::CircularReference,
            })
        );

        assert_no_pending_async_transaction(&gc);
    }

    #[test]
    #[parallel]
    fn run_ai_researcher_parallel_dependent_cells_with_error() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![A1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "1+".to_string(),
            None,
        );
        gc.set_code_cell(
            pos![B1].to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "AI('query', A1)".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let code_run = sheet.code_run((2, 1).into());
        assert!(code_run.is_some());
        assert_eq!(
            code_run.unwrap().result,
            CodeRunResult::Err(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("Error in referenced cell(s)".into()),
            })
        );

        assert_no_pending_async_transaction(&gc);
    }

    #[test]
    #[serial]
    fn run_ai_researcher_parallel_scheduling_dependent_ai_researcher_requests() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(pos![B1].to_sheet_pos(sheet_id), "1".to_string(), None);

        let sheet_pos = pos![B2].to_sheet_pos(sheet_id);
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "AI('query', B1)".to_string(),
            None,
        );
        let prev_transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestAIResearcherResult",
            format!(
                "{},{},{},{}",
                prev_transaction_id,
                serde_json::to_string(&sheet_pos).unwrap(),
                "query",
                "1"
            ),
            false,
        );
        expect_js_call(
            "jsAIResearcherState",
            format!(
                "{},{}",
                serde_json::to_string(&vec![JsCodeRun {
                    transaction_id: prev_transaction_id.to_string(),
                    sheet_pos: sheet_pos.into(),
                    code: String::new()
                }])
                .unwrap(),
                serde_json::to_string(&Vec::<JsCodeRun>::new()).unwrap()
            ),
            true,
        );
        assert_no_pending_async_transaction(&gc);

        let sheet_pos = pos![B3].to_sheet_pos(sheet_id);
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "AI('query', B2)".to_string(),
            None,
        );
        let prev_transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestAIResearcherResult",
            format!(
                "{},{},{},{}",
                prev_transaction_id,
                serde_json::to_string(&sheet_pos).unwrap(),
                "query",
                "result"
            ),
            false,
        );
        expect_js_call(
            "jsAIResearcherState",
            format!(
                "{},{}",
                serde_json::to_string(&vec![JsCodeRun {
                    transaction_id: prev_transaction_id.to_string(),
                    sheet_pos: sheet_pos.into(),
                    code: String::new()
                }])
                .unwrap(),
                serde_json::to_string(&Vec::<JsCodeRun>::new()).unwrap()
            ),
            true,
        );
        assert_no_pending_async_transaction(&gc);

        let sheet_pos = pos![B4].to_sheet_pos(sheet_id);
        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Formula,
            "AI('query', B3)".to_string(),
            None,
        );
        let prev_transaction_id = gc.last_transaction().unwrap().id;
        expect_js_call(
            "jsRequestAIResearcherResult",
            format!(
                "{},{},{},{}",
                prev_transaction_id,
                serde_json::to_string(&sheet_pos).unwrap(),
                "query",
                "result"
            ),
            false,
        );
        expect_js_call(
            "jsAIResearcherState",
            format!(
                "{},{}",
                serde_json::to_string(&vec![JsCodeRun {
                    transaction_id: prev_transaction_id.to_string(),
                    sheet_pos: sheet_pos.into(),
                    code: String::new()
                }])
                .unwrap(),
                serde_json::to_string(&Vec::<JsCodeRun>::new()).unwrap()
            ),
            true,
        );
        assert_no_pending_async_transaction(&gc);

        gc.rerun_all_code_cells(None);
        let prev_transaction_id = gc.last_transaction().unwrap().id;

        // running - B2
        // awaiting execution - B3, B4
        expect_js_call(
            "jsRequestAIResearcherResult",
            format!(
                "{},{},{},{}",
                prev_transaction_id,
                serde_json::to_string(&pos![B2].to_sheet_pos(sheet_id)).unwrap(),
                "query",
                "1"
            ),
            false,
        );
        expect_js_call(
            "jsAIResearcherState",
            format!(
                "{},{}",
                serde_json::to_string(&vec![JsCodeRun {
                    transaction_id: prev_transaction_id.to_string(),
                    sheet_pos: pos![B2].to_sheet_pos(sheet_id).into(),
                    code: String::new()
                }])
                .unwrap(),
                serde_json::to_string(&vec![
                    JsCodeRun {
                        transaction_id: prev_transaction_id.to_string(),
                        sheet_pos: pos![B3].to_sheet_pos(sheet_id).into(),
                        code: String::new()
                    },
                    JsCodeRun {
                        transaction_id: prev_transaction_id.to_string(),
                        sheet_pos: pos![B4].to_sheet_pos(sheet_id).into(),
                        code: String::new()
                    }
                ])
                .unwrap()
            ),
            false,
        );

        // running - B3
        // awaiting execution - B4
        expect_js_call(
            "jsRequestAIResearcherResult",
            format!(
                "{},{},{},{}",
                prev_transaction_id,
                serde_json::to_string(&pos![B3].to_sheet_pos(sheet_id)).unwrap(),
                "query",
                "result"
            ),
            false,
        );
        expect_js_call(
            "jsAIResearcherState",
            format!(
                "{},{}",
                serde_json::to_string(&vec![JsCodeRun {
                    transaction_id: prev_transaction_id.to_string(),
                    sheet_pos: pos![B3].to_sheet_pos(sheet_id).into(),
                    code: String::new()
                }])
                .unwrap(),
                serde_json::to_string(&vec![JsCodeRun {
                    transaction_id: prev_transaction_id.to_string(),
                    sheet_pos: pos![B4].to_sheet_pos(sheet_id).into(),
                    code: String::new()
                }])
                .unwrap()
            ),
            false,
        );

        // running - B4
        // awaiting execution - none
        expect_js_call(
            "jsRequestAIResearcherResult",
            format!(
                "{},{},{},{}",
                prev_transaction_id,
                serde_json::to_string(&pos![B4].to_sheet_pos(sheet_id)).unwrap(),
                "query",
                "result"
            ),
            false,
        );
        expect_js_call(
            "jsAIResearcherState",
            format!(
                "{},{}",
                serde_json::to_string(&vec![JsCodeRun {
                    transaction_id: prev_transaction_id.to_string(),
                    sheet_pos: pos![B4].to_sheet_pos(sheet_id).into(),
                    code: String::new()
                }])
                .unwrap(),
                serde_json::to_string(&Vec::<JsCodeRun>::new()).unwrap()
            ),
            false,
        );
        assert_no_pending_async_transaction(&gc);

        clear_js_calls();
    }
}
