use crate::{
    CellValue, SheetPos, SheetRect, Value,
    a1::A1Selection,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind},
    util::now,
    wasm_bindings::controller::code::{CodeOperation, CodeRunningState},
};
use anyhow::Result;
impl GridController {
    /// Adds operations to compute cells that are dependents within a SheetRect
    pub fn add_compute_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        output: SheetRect,
        skip_compute: Option<SheetPos>,
    ) {
        if !transaction.is_user_ai() {
            return;
        }

        // Collect new code cell positions to add
        let mut new_code_cell_positions = Vec::new();
        self.get_dependent_code_cells(output)
            .iter()
            .for_each(|sheet_positions| {
                sheet_positions.iter().for_each(|code_cell_sheet_pos| {
                    if !skip_compute
                        .is_some_and(|skip_compute| skip_compute == *code_cell_sheet_pos)
                    {
                        // only add if there isn't already one pending
                        if !transaction.operations.iter().any(|op| match op {
                            Operation::ComputeCode { sheet_pos }
                            | Operation::SetComputeCode { sheet_pos, .. } => {
                                code_cell_sheet_pos == sheet_pos
                            }
                            _ => false,
                        }) {
                            new_code_cell_positions.push(*code_cell_sheet_pos);
                        }
                    }
                });
            });

        if new_code_cell_positions.is_empty() {
            return;
        }

        // Collect all existing ComputeCode operations and their positions
        let mut existing_code_positions = Vec::new();
        let mut non_code_operations = Vec::new();

        for op in transaction.operations.iter() {
            match op {
                Operation::ComputeCode { sheet_pos } => {
                    existing_code_positions.push(*sheet_pos);
                }
                _ => {
                    non_code_operations.push(op.clone());
                }
            }
        }

        // Combine existing and new code positions, then reorder based on dependencies
        let mut all_code_positions = existing_code_positions;
        all_code_positions.extend(new_code_cell_positions);

        // Reorder all code operations based on dependencies
        // Use the order_code_cells method from operations/code_cell.rs
        let ordered_positions = self.order_code_cells(all_code_positions);

        // Rebuild the operations queue:
        // 1. Add all non-code operations first (they maintain their relative order)
        // 2. Add all code operations in dependency order after non-code operations
        let mut new_operations = std::collections::VecDeque::new();

        // Add non-code operations first
        for op in non_code_operations {
            new_operations.push_back(op);
        }

        // Add code operations in dependency order after non-code operations
        for pos in ordered_positions {
            new_operations.push_back(Operation::ComputeCode { sheet_pos: pos });
        }

        transaction.operations = new_operations;
    }

    /// **Deprecated** and replaced with SetChartCellSize
    pub(super) fn execute_set_chart_size(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetChartSize {
            sheet_pos,
            pixel_width,
            pixel_height,
        } = op
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let original = sheet.data_table_result(&data_table_pos)?.chart_pixel_output;
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.chart_pixel_output = Some((pixel_width, pixel_height));
                Ok(())
            })?;

            transaction.add_update_selection(A1Selection::table(sheet_pos, data_table.name()));

            transaction.forward_operations.push(op);
            transaction
                .reverse_operations
                .push(Operation::SetChartSize {
                    sheet_pos,
                    pixel_width: original
                        .map(|(pixel_width, _)| pixel_width)
                        .unwrap_or(pixel_width),
                    pixel_height: original
                        .map(|(_, pixel_height)| pixel_height)
                        .unwrap_or(pixel_height),
                });

            transaction.add_from_code_run(
                sheet_pos.sheet_id,
                sheet_pos.into(),
                data_table.is_image(),
                data_table.is_html(),
            );

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
        }

        Ok(())
    }

    pub(super) fn execute_set_chart_cell_size(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetChartCellSize { sheet_pos, w, h } = op {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let original = sheet.data_table_result(&data_table_pos)?.chart_output;
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.chart_output = Some((w, h));
                Ok(())
            })?;

            transaction.add_update_selection(A1Selection::table(sheet_pos, data_table.name()));

            transaction.add_from_code_run(
                sheet_pos.sheet_id,
                sheet_pos.into(),
                data_table.is_image(),
                data_table.is_html(),
            );

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            self.thumbnail_dirty_sheet_rect(
                transaction,
                SheetRect::from_numbers(
                    sheet_pos.x,
                    sheet_pos.y,
                    w as i64,
                    h as i64,
                    sheet_pos.sheet_id,
                ),
            );
            if transaction.is_user_ai_undo_redo() {
                transaction.forward_operations.push(op);

                transaction
                    .reverse_operations
                    .push(Operation::SetChartCellSize {
                        sheet_pos,
                        w: original.map(|(w, _)| w).unwrap_or(w),
                        h: original.map(|(_, h)| h).unwrap_or(h),
                    });
            }
        }

        Ok(())
    }

    pub(super) fn execute_compute_code(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::ComputeCode { sheet_pos } = op {
            if !transaction.is_user_ai_undo_redo() && !transaction.is_server() {
                dbgjs!("Only user / undo / redo / server transaction should have a ComputeCode");
                return;
            }

            let Some(sheet) = self.try_sheet(sheet_pos.sheet_id) else {
                // sheet may have been deleted in a multiplayer operation
                return;
            };

            let (language, code) = match sheet.code_run_at(&sheet_pos.into()) {
                Some(code_run) => (code_run.language.to_owned(), code_run.code.to_owned()),
                None => {
                    dbgjs!(format!("No code run found at {sheet_pos:?}"));
                    return;
                }
            };

            // Clone for notification
            let language_for_notify = language.clone();
            let code_for_notify = code.clone();

            // Send the current operation
            match language {
                CodeCellLanguage::Python => {
                    self.run_python(transaction, sheet_pos, code);
                    // Notify client about all code operations (current + pending)
                    self.notify_code_running_state(
                        transaction,
                        Some((sheet_pos, language_for_notify, code_for_notify)),
                    );
                }
                CodeCellLanguage::Formula => {
                    // Formulas execute synchronously, so notification happens before execution
                    // via notify_next_operation_if_code in the control loop
                    self.run_formula(transaction, sheet_pos, code);
                }
                CodeCellLanguage::Connection { kind, id } => {
                    // Notify client about all code operations (current + pending) BEFORE starting execution
                    // This ensures the UI is updated before the connection operation starts executing
                    self.notify_code_running_state(
                        transaction,
                        Some((sheet_pos, language_for_notify, code_for_notify)),
                    );
                    self.run_connection(transaction, sheet_pos, code, kind, id);
                }
                CodeCellLanguage::Javascript => {
                    self.run_javascript(transaction, sheet_pos, code);
                    // Notify client about all code operations (current + pending)
                    self.notify_code_running_state(
                        transaction,
                        Some((sheet_pos, language_for_notify, code_for_notify)),
                    );
                }
                CodeCellLanguage::Import => {
                    dbgjs!(format!("Import code run found at {sheet_pos:?}"));
                    // no-op
                }
            }
        }
    }

    /// Executes SetComputeCode operation
    pub(super) fn execute_set_compute_code(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetComputeCode {
            sheet_pos,
            language,
            code,
        } = op
        {
            if !transaction.is_user_ai_undo_redo() && !transaction.is_server() {
                dbgjs!("Only user / undo / redo / server transaction should have a SetComputeCode");
                return;
            }

            // Clone for notification
            let language_for_notify = language.clone();
            let code_for_notify = code.clone();

            // Execute based on language
            match language {
                CodeCellLanguage::Python => {
                    // Set up empty data table first, then trigger async execution
                    let data_table =
                        Self::create_empty_code_data_table(language.clone(), code.clone());
                    self.finalize_data_table(transaction, sheet_pos, Some(data_table), None, true);
                    self.run_python(transaction, sheet_pos, code);
                    self.notify_code_running_state(
                        transaction,
                        Some((sheet_pos, language_for_notify, code_for_notify)),
                    );
                }
                CodeCellLanguage::Formula => {
                    // Formulas execute synchronously - run_formula handles everything
                    self.run_formula(transaction, sheet_pos, code);
                }
                CodeCellLanguage::Connection { ref kind, ref id } => {
                    // Set up empty data table first, then trigger async execution
                    let data_table =
                        Self::create_empty_code_data_table(language.clone(), code.clone());
                    self.finalize_data_table(transaction, sheet_pos, Some(data_table), None, true);
                    self.notify_code_running_state(
                        transaction,
                        Some((sheet_pos, language_for_notify, code_for_notify)),
                    );
                    self.run_connection(transaction, sheet_pos, code, *kind, id.clone());
                }
                CodeCellLanguage::Javascript => {
                    // Set up empty data table first, then trigger async execution
                    let data_table =
                        Self::create_empty_code_data_table(language.clone(), code.clone());
                    self.finalize_data_table(transaction, sheet_pos, Some(data_table), None, true);
                    self.run_javascript(transaction, sheet_pos, code);
                    self.notify_code_running_state(
                        transaction,
                        Some((sheet_pos, language_for_notify, code_for_notify)),
                    );
                }
                CodeCellLanguage::Import => {
                    dbgjs!(format!("Import code run found at {sheet_pos:?}"));
                    // no-op
                }
            }
        }
    }

    /// Creates an empty data table for a code cell (used by SetComputeCode for async languages)
    fn create_empty_code_data_table(language: CodeCellLanguage, code: String) -> DataTable {
        // Use the same naming convention as set_code_cell_operations
        let name = format!("{}1", language.as_string());
        DataTable {
            kind: DataTableKind::CodeRun(CodeRun {
                language,
                code,
                ..Default::default()
            }),
            name: CellValue::Text(name),
            header_is_first_row: false,
            show_name: None,
            show_columns: None,
            column_headers: None,
            sort: None,
            sort_dirty: false,
            display_buffer: None,
            value: Value::Single(CellValue::Blank),
            spill_value: false,
            spill_data_table: false,
            last_modified: now(),
            alternating_colors: true,
            formats: None,
            borders: None,
            chart_pixel_output: None,
            chart_output: None,
        }
    }

    /// Notifies the client about all code operations (currently executing + pending)
    /// If current is None, all operations are pending. If current is Some, that operation is running.
    pub(crate) fn notify_code_running_state(
        &self,
        transaction: &PendingTransaction,
        current: Option<(SheetPos, CodeCellLanguage, String)>,
    ) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            // Store reference to current for later use
            let current_ref = current.as_ref();

            // Serialize current operation if present
            let current_op = current_ref.map(|(sheet_pos, language, _code)| {
                let language_str = language.as_string();
                CodeOperation {
                    x: sheet_pos.x as i32,
                    y: sheet_pos.y as i32,
                    sheet_id: sheet_pos.sheet_id.to_string(),
                    language: language_str,
                }
            });

            // Collect all pending operations
            let mut pending_ops = Vec::new();
            for pending_op in transaction.operations.iter() {
                if let Operation::ComputeCode {
                    sheet_pos: pending_sheet_pos,
                } = pending_op
                {
                    // Skip the currently executing operation if present
                    if let Some((current_sheet_pos, _, _)) = current_ref
                        && *pending_sheet_pos == *current_sheet_pos
                    {
                        continue;
                    }

                    if let Some(pending_sheet) = self.try_sheet(pending_sheet_pos.sheet_id) {
                        let pos = crate::Pos {
                            x: pending_sheet_pos.x,
                            y: pending_sheet_pos.y,
                        };
                        if let Some(pending_code_run) = pending_sheet.code_run_at(&pos)
                            && pending_code_run.language.is_code_language()
                        {
                            // Serialize language as string for JSON
                            let language_str = pending_code_run.language.as_string();
                            pending_ops.push(CodeOperation {
                                x: pending_sheet_pos.x as i32,
                                y: pending_sheet_pos.y as i32,
                                sheet_id: pending_sheet_pos.sheet_id.to_string(),
                                language: language_str,
                            });
                        }
                    }
                }
            }

            // Only send if there are operations (current or pending)
            if current_op.is_some() || !pending_ops.is_empty() {
                let state = CodeRunningState {
                    current: current_op,
                    pending: pending_ops,
                };
                let code_ops_json = serde_json::to_string(&state).unwrap_or_default();
                crate::wasm_bindings::js::jsCodeRunningState(
                    transaction.id.to_string(),
                    code_ops_json,
                );
            }
        }
    }

    /// Notifies the client that all code operations are complete (sends empty state)
    pub(crate) fn notify_code_running_state_clear(&self, transaction: &PendingTransaction) {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            // Send empty state to clear code running state
            let state = CodeRunningState {
                current: None,
                pending: Vec::new(),
            };
            let code_ops_json = serde_json::to_string(&state).unwrap_or_default();
            crate::wasm_bindings::js::jsCodeRunningState(transaction.id.to_string(), code_ops_json);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, SheetPos,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
            operations::operation::Operation,
        },
        grid::CodeCellLanguage,
        test_util::*,
        wasm_bindings::js::{clear_js_calls, expect_js_call_count},
    };

    #[test]
    fn test_simple_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "1".into(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "2".into(), None, false);
        gc.set_code_cell(
            pos![sheet_id!A3],
            CodeCellLanguage::Formula,
            "A1:A2".to_string(),
            None,
            None,
            false,
        );
        assert_display(&gc, pos![sheet_id!A3], "1");
        assert_display(&gc, pos![sheet_id!A4], "2");
    }

    #[test]
    fn test_spilled_output_over_normal_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "one".into(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "two".into(), None, false);
        gc.set_code_cell(
            pos![sheet_id!B1],
            CodeCellLanguage::Formula,
            "A1:A2".to_string(),
            None,
            None,
            false,
        );
        assert_code_language(
            &gc,
            pos![sheet_id!B1],
            CodeCellLanguage::Formula,
            "A1:A2".to_string(),
        );

        assert_display(&gc, pos![sheet_id!A1], "one");
        assert_display(&gc, pos![sheet_id!A2], "two");
        assert_display(&gc, pos![sheet_id!A3], "");

        assert_display(&gc, pos![sheet_id!B1], "one");
        assert_display(&gc, pos![sheet_id!B2], "two");
        assert_display(&gc, pos![sheet_id!B3], "");

        gc.set_cell_value(pos![sheet_id!B2], "cause spill".to_string(), None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos![B2]),
            Some(CellValue::Text("cause spill".into()))
        );

        assert_display(&gc, pos![sheet_id!B1], "");
        assert_eq!(sheet.display_value(pos![B1]), Some(CellValue::Blank));

        let code_cell = sheet.data_table_at(&pos![B1]);
        assert!(code_cell.unwrap().has_spill());
    }

    #[test]
    fn execute_code() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            CodeCellLanguage::Javascript,
            "code".to_string(),
            None,
            None,
            false,
        );
        expect_js_call_count("jsRunJavascript", 1, true);

        gc.set_code_cell(
            (0, 0, sheet_id).into(),
            CodeCellLanguage::Python,
            "code".to_string(),
            None,
            None,
            false,
        );
        expect_js_call_count("jsRunPython", 1, true);

        // formula is already tested since it works solely in Rust
    }

    #[test]
    fn test_execute_set_chart_cell_size() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_chart(pos![A1], 3, 3);

        let mut transaction = PendingTransaction::default();
        gc.execute_set_chart_cell_size(
            &mut transaction,
            Operation::SetChartCellSize {
                sheet_pos: SheetPos {
                    x: 1,
                    y: 1,
                    sheet_id,
                },
                w: 4,
                h: 5,
            },
        )
        .unwrap();

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.data_table_at(&pos![A1]).unwrap().chart_output,
            Some((4, 5))
        );
    }
}
