use chrono::Utc;
use itertools::Itertools;
use uuid::Uuid;

use crate::{
    controller::{active_transactions::pending_transaction::PendingTransaction, GridController},
    error_core::{CoreError, Result},
    formulas::{parse_formula, Ctx},
    grid::{CodeCellLanguage, CodeRun, CodeRunResult},
    CellValue, RunError, RunErrorMsg, SheetPos, Value,
};

impl GridController {
    pub(crate) fn run_ai_researcher(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        code: String,
    ) {
        let mut ctx = Ctx::new(self.grid(), sheet_pos);
        transaction.current_sheet_pos = Some(sheet_pos);
        match parse_formula(&code, sheet_pos.into()) {
            Ok(parsed) => {
                if let Value::Tuple(vec) = parsed.eval(&mut ctx).inner {
                    if let Some((query, values_array)) = vec.into_iter().next_tuple() {
                        if let Ok(query) = query.into_cell_value() {
                            let query = query.to_display();
                            let ref_cell_values = values_array
                                .into_cell_values_vec()
                                .into_iter()
                                .map(|v| v.to_display())
                                .join(", ");
                            transaction.cells_accessed = ctx.cells_accessed;
                            self.request_ai_researcher_result(transaction, query, ref_cell_values);
                        } else {
                            let _ = self.code_cell_sheet_error(
                                transaction,
                                &RunError {
                                    span: None,
                                    msg: RunErrorMsg::Unexpected(
                                        "Expected a prompt value in the first element of the tuple"
                                            .into(),
                                    ),
                                },
                            );
                        }
                    } else {
                        let _ = self.code_cell_sheet_error(
                            transaction,
                            &RunError {
                                span: None,
                                msg: RunErrorMsg::Unexpected(
                                    "Expected a tuple with two elements (prompt and values_array)"
                                        .into(),
                                ),
                            },
                        );
                    }
                } else {
                    let _ = self.code_cell_sheet_error(
                        transaction,
                        &RunError {
                            span: None,
                            msg: RunErrorMsg::Unexpected("Expected a tuple from AI formula".into()),
                        },
                    );
                }
            }
            Err(error) => {
                dbgjs!(format!("error: {:?}", error));
                let _ = self.code_cell_sheet_error(transaction, &error);
            }
        }
    }

    pub fn request_ai_researcher_result(
        &mut self,
        transaction: &mut PendingTransaction,
        query: String,
        ref_cell_values: String,
    ) {
        if (!cfg!(target_family = "wasm") && !cfg!(test)) || !transaction.is_user() {
            return;
        }

        crate::wasm_bindings::js::jsRequestAIResearcherResult(
            transaction.id.to_string(),
            query,
            ref_cell_values,
        );

        if !cfg!(test) {
            transaction.waiting_for_async = Some(CodeCellLanguage::AIResearcher);
            self.transactions.add_async_transaction(transaction);
        }
    }

    pub fn response_ai_researcher_result(
        &mut self,
        transaction_id: Uuid,
        result: Option<String>,
        error: Option<String>,
    ) -> Result<()> {
        if let Ok(mut transaction) = self.transactions.remove_awaiting_async(transaction_id) {
            let sheet_pos =
                match transaction.current_sheet_pos {
                    Some(current_sheet_pos) => current_sheet_pos,
                    None => return Err(CoreError::TransactionNotFound(
                        "Expected current_sheet_pos to be defined in response_ai_researcher_result"
                            .into(),
                    )),
                };

            let result = match result {
                Some(result) => {
                    CodeRunResult::Ok(Value::Single(CellValue::parse_from_str(&result)))
                }
                None => CodeRunResult::Err(RunError {
                    span: None,
                    msg: RunErrorMsg::InternalError("Error from AI Researcher".into()),
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
            transaction.waiting_for_async = None;
            self.start_transaction(&mut transaction);
            self.finalize_transaction(transaction);
        }
        Ok(())
    }
}
