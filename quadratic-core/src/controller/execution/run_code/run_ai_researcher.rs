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

#[derive(Debug, PartialEq)]
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
        if transaction.pending_ai_researcher.is_empty() {
            return;
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
                    dbgjs!(format!(
                        "query: {:?}, ref_cell_values: {:?}, cells_accessed: {:?}",
                        query, ref_cell_values, cells_accessed
                    ));
                    let mut referenced_cell_has_error = false;
                    let mut has_circular_reference = false;
                    let mut is_dependent = false;

                    let mut seen_code_cells = HashSet::new();
                    seen_code_cells.insert(sheet_pos.to_owned());
                    let mut cells_accessed_to_check = cells_accessed.iter().collect::<Vec<_>>();

                    // check if this ai researcher code cell is dependent on
                    // 1. any other code cell that has an error
                    // 2. another ai researcher request
                    // 3. has a circular reference
                    while let Some(cell_accessed) = cells_accessed_to_check.pop() {
                        if referenced_cell_has_error || has_circular_reference || is_dependent {
                            break;
                        }

                        // circular reference to itself
                        has_circular_reference |= cell_accessed
                            .intersects(SheetRect::single_sheet_pos(sheet_pos.to_owned()));
                        dbgjs!(format!(
                            "has_circular_reference: {:?}",
                            has_circular_reference
                        ));
                        dbgjs!(format!("cell_accessed: {:?}", cell_accessed));
                        dbgjs!(format!("sheet_pos: {:?}", sheet_pos));

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
        if pending_ai_researcher == dependent_ai_researcher
            && transaction.running_ai_researcher.is_empty()
        {
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

        // default response from client, for tests
        if cfg!(test) {
            let _ = self.receive_ai_researcher_result(
                transaction.id,
                sheet_pos,
                Some("result".to_string()),
                None,
            );
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

#[cfg(test)]
mod test {
    use std::collections::HashSet;

    use serial_test::parallel;

    use super::ParsedAIResearcherCode;

    use crate::{
        controller::GridController,
        grid::{CodeCellLanguage, CodeRunResult, SheetId},
        CellValue, RunError, RunErrorMsg, SheetPos, SheetRect, Span,
    };

    #[test]
    #[parallel]
    fn parse_ai_researcher_code() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["1"], vec!["2"], vec!["3"]],
            None,
        );

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 4,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "AI('query', B1:B3)".to_string(),
            None,
        );

        assert_eq!(
            gc.sheet(sheet_id).get_code_cell_value((1, 4).into()),
            Some(CellValue::Text("result".to_string()))
        );

        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 1,
            y: 4,
            sheet_id,
        });
        assert_eq!(
            parsed_ai_researcher_code,
            Ok(ParsedAIResearcherCode {
                query: "query".to_string(),
                ref_cell_values: vec!["1".to_string(), "2".to_string(), "3".to_string()],
                cells_accessed: HashSet::from([
                    SheetRect::new(1, 1, 1, 1, sheet_id),
                    SheetRect::new(1, 2, 1, 2, sheet_id),
                    SheetRect::new(1, 3, 1, 3, sheet_id),
                ]),
            })
        );

        // incorrect argument
        gc.set_code_cell(
            SheetPos {
                x: 5,
                y: 5,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "AI()".to_string(),
            None,
        );
        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 5,
            y: 5,
            sheet_id,
        });
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::InvalidArgument,
            })
        );

        // incorrect argument
        gc.set_code_cell(
            SheetPos {
                x: 6,
                y: 6,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "AI('query')".to_string(),
            None,
        );
        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 6,
            y: 6,
            sheet_id,
        });
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::InvalidArgument,
            })
        );

        // incorrect argument
        gc.set_code_cell(
            SheetPos {
                x: 7,
                y: 7,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "AI(query, B1:B3)".to_string(),
            None,
        );
        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 7,
            y: 7,
            sheet_id,
        });
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: Some(Span { start: 3, end: 4 }),
                msg: RunErrorMsg::Expected {
                    expected: "right paren or expression or nothing".into(),
                    got: None,
                },
            })
        );

        // incorrect argument
        gc.set_code_cell(
            SheetPos {
                x: 8,
                y: 8,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "AI(query, ".to_string(),
            None,
        );
        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 8,
            y: 8,
            sheet_id,
        });
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: Some(Span { start: 3, end: 4 }),
                msg: RunErrorMsg::Expected {
                    expected: "right paren or expression or nothing".into(),
                    got: None,
                },
            })
        );

        // self circular reference
        gc.set_code_cell(
            SheetPos {
                x: 9,
                y: 9,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "AI('query', J9)".to_string(),
            None,
        );
        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 9,
            y: 9,
            sheet_id,
        });
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("Error in referenced cell(s)".into(),),
            })
        );

        // different code cell language
        gc.set_code_cell(
            SheetPos {
                x: 10,
                y: 10,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "1+1".to_string(),
            None,
        );
        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 10,
            y: 10,
            sheet_id,
        });
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::Unexpected("Expected an AI researcher code cell".into()),
            })
        );

        // not a code cell
        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 11,
            y: 11,
            sheet_id,
        });
        assert_eq!(
            parsed_ai_researcher_code,
            Err(RunError {
                span: None,
                msg: RunErrorMsg::Unexpected("Expected a code cell".into()),
            })
        );

        // sheet not found
        let parsed_ai_researcher_code = gc.parse_ai_researcher_code(SheetPos {
            x: 12,
            y: 12,
            sheet_id: SheetId::new(),
        });
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
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "AI('query', B1)".to_string(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let code_run = sheet.code_run((1, 1).into());
        assert_eq!(code_run.is_some(), true);
        assert_eq!(
            code_run.unwrap().result,
            CodeRunResult::Err(RunError {
                span: None,
                msg: RunErrorMsg::CodeRunError("Error in referenced cell(s)".into(),),
            })
        );
    }
}
