use std::collections::HashSet;

use crate::cell_values::CellValues;
use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::transaction_types::JsCodeResult;
use crate::error_core::{CoreError, Result};
use crate::grid::{CodeCellLanguage, CodeRun, DataTable, DataTableKind, unique_data_table_name};
use crate::{Array, CellValue, Pos, RunError, RunErrorMsg, SheetPos, SheetRect, Span, Value};

pub mod get_cells;
pub mod run_connection;
pub mod run_formula;
pub mod run_javascript;
pub mod run_python;

// this should be kept in sync with HtmlCell.ts and aiToolsSpec.ts
const DEFAULT_HTML_WIDTH: f32 = 600.0;
const DEFAULT_HTML_HEIGHT: f32 = 460.0;

impl GridController {
    /// Finalize changes to a data table.
    ///
    /// This function is called after a code run has completed and the data
    /// table has been updated. It ensures that the data table is updated in the
    /// grid, and that the necessary client updates are added to the
    /// transaction.
    ///
    /// This also maintains any old values from the data table, such as the
    /// user-defined chart size.
    pub(crate) fn finalize_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_pos: SheetPos,
        mut new_data_table: Option<DataTable>,
        index: Option<usize>,
        ignore_old_data_table: bool,
    ) {
        transaction.current_sheet_pos = None;
        transaction.cells_accessed.clear();
        transaction.waiting_for_async_code_cell = false;

        self.update_cells_accessed_cache(sheet_pos, &new_data_table);

        let data_table_pos = sheet_pos.into();
        let Some(sheet) = self.grid.try_sheet_mut(sheet_pos.sheet_id) else {
            // sheet may have been deleted
            return;
        };

        let old_data_table = sheet.data_table_at(&data_table_pos);

        // preserve some settings from the previous code run
        if !ignore_old_data_table
            && let (Some(old_data_table), Some(new_data_table)) =
                (old_data_table, &mut new_data_table)
        {
            // for python dataframes, we don't want preserve the show_columns setting
            // for other data tables types, we want to preserve most settings
            if !new_data_table.is_dataframe()
                && !new_data_table.is_list()
                && !new_data_table.is_series()
                && !new_data_table.is_html_or_image()
            {
                // since we don't automatically apply the first row as headers in JS,
                // we need to do it manually here
                if old_data_table.header_is_first_row {
                    new_data_table.apply_first_row_as_header();
                }
            }

            new_data_table.alternating_colors = old_data_table.alternating_colors;
            new_data_table.name = old_data_table.name.to_owned();
            new_data_table.show_name = old_data_table.show_name.to_owned();
            new_data_table.show_columns = old_data_table.show_columns.to_owned();

            // if the width of the old and new data tables are the same,
            // then we can preserve other user-selected properties
            if old_data_table.output_size().w == new_data_table.output_size().w {
                new_data_table.formats = old_data_table.formats.to_owned();
                new_data_table.borders = old_data_table.borders.to_owned();

                // actually apply the sort if it's set
                if let Some(sort) = old_data_table.sort.to_owned() {
                    new_data_table.sort = Some(sort);

                    if let Err(e) = new_data_table.sort_all() {
                        dbgjs!(format!("Error sorting data table: {}", e));
                    }
                }
            }

            // If there is an existing chart, then we keep its
            // chart_output setting since it may have been set by the user.
            // TODO (DF): we should be tracking whether a user set this, and
            // if not, we should use the pixel output.
            if let Some((w, h)) = old_data_table.chart_output
                && w > 0
                && h > 0
            {
                new_data_table.chart_output = old_data_table.chart_output.to_owned();
            }
        }

        // enforce unique data table names
        if let Some(new_data_table) = &mut new_data_table {
            let unique_name = unique_data_table_name(
                new_data_table.name(),
                false,
                Some(sheet_pos),
                &self.a1_context,
            );
            new_data_table.name = unique_name.into();
        }

        let sheet_rect = match (&old_data_table, &new_data_table) {
            (None, None) => sheet_pos.into(),
            (None, Some(code_cell_value)) => code_cell_value.output_sheet_rect(sheet_pos, false),
            (Some(old_code_cell_value), None) => {
                old_code_cell_value.output_sheet_rect(sheet_pos, false)
            }
            (Some(old_code_cell_value), Some(code_cell_value)) => {
                let old = old_code_cell_value.output_sheet_rect(sheet_pos, false);
                let new = code_cell_value.output_sheet_rect(sheet_pos, false);
                SheetRect::new_pos_span(
                    data_table_pos,
                    Pos {
                        x: old.max.x.max(new.max.x),
                        y: old.max.y.max(new.max.y),
                    },
                    sheet_pos.sheet_id,
                )
            }
        };

        if !transaction.is_server() {
            // update fills if needed in either old or new data table
            if new_data_table.as_ref().is_some_and(|dt| {
                dt.formats
                    .as_ref()
                    .is_some_and(|formats| formats.has_fills())
            }) || old_data_table.as_ref().is_some_and(|dt| {
                dt.formats
                    .as_ref()
                    .is_some_and(|formats| formats.has_fills())
            }) {
                transaction.add_fill_cells_from_sheet_rect(sheet_rect);
            }

            // update borders if needed old or new data table
            if new_data_table.as_ref().is_some_and(|dt| {
                !dt.borders
                    .as_ref()
                    .is_none_or(|borders| borders.is_default())
            }) || old_data_table.as_ref().is_some_and(|dt| {
                !dt.borders
                    .as_ref()
                    .is_none_or(|borders| borders.is_default())
            }) {
                transaction.add_borders(sheet_pos.sheet_id);
            }
        }

        transaction.add_from_code_run(
            sheet_pos.sheet_id,
            data_table_pos,
            old_data_table.as_ref().is_some_and(|dt| dt.is_image()),
            old_data_table.as_ref().is_some_and(|dt| dt.is_html()),
        );
        transaction.add_from_code_run(
            sheet_pos.sheet_id,
            data_table_pos,
            new_data_table.as_ref().is_some_and(|dt| dt.is_image()),
            new_data_table.as_ref().is_some_and(|dt| dt.is_html()),
        );
        transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);

        // index for SetCodeRun is either set by execute_set_code_run or calculated
        let index = index.unwrap_or(
            sheet
                .data_tables
                .get_index_of(&data_table_pos)
                .unwrap_or(usize::MAX),
        );

        // Check if the new data table qualifies as a single code cell (CellValue::Code)
        // If so, store it in columns instead of data_tables
        if let Some(dt) = &new_data_table
            && dt.qualifies_as_single_code_cell()
            && let Some(code_cell) = dt.clone().into_code_cell()
        {
            let code_cell_value = CellValue::Code(Box::new(code_cell));

            // Check for existing CellValue::Code at this position
            let old_cell_value = sheet.cell_value_ref(data_table_pos).cloned();

            // Remove any existing DataTable at this position
            let old_data_table_removed = sheet.data_table_shift_remove(data_table_pos);

            // Set the CellValue::Code in columns
            sheet.set_value(data_table_pos, code_cell_value.clone());

            self.send_updated_bounds(transaction, sheet_pos.sheet_id);
            self.thumbnail_dirty_sheet_rect(transaction, sheet_rect);

            // Check for rows that need auto-resize
            if (cfg!(target_family = "wasm") || cfg!(test))
                && transaction.is_user_ai()
                && let Some(sheet) = self.try_sheet(sheet_pos.sheet_id)
            {
                let rows_to_resize = sheet.get_rows_with_wrap_in_rect(sheet_rect.into(), true);
                if !rows_to_resize.is_empty() {
                    transaction
                        .resize_rows
                        .entry(sheet_pos.sheet_id)
                        .or_default()
                        .extend(rows_to_resize);
                }
            }

            self.add_compute_operations(transaction, sheet_rect, Some(sheet_pos));

            if transaction.is_user_ai_undo_redo() {
                // Forward operation: set the CellValue::Code
                transaction
                    .forward_operations
                    .push(Operation::SetCellValues {
                        sheet_pos,
                        values: CellValues::from(code_cell_value),
                    });

                // Reverse operations: restore old state
                if let Some((_, old_dt, _)) = old_data_table_removed {
                    // There was an existing DataTable - restore it
                    transaction
                        .reverse_operations
                        .push(Operation::SetDataTable {
                            sheet_pos,
                            data_table: Some(old_dt),
                            index,
                            ignore_old_data_table: true,
                        });
                } else if let Some(old_cv) = old_cell_value {
                    // There was an existing CellValue - restore it
                    transaction
                        .reverse_operations
                        .push(Operation::SetCellValues {
                            sheet_pos,
                            values: CellValues::from(old_cv),
                        });
                } else {
                    // Nothing was there before - delete the cell
                    transaction
                        .reverse_operations
                        .push(Operation::SetCellValues {
                            sheet_pos,
                            values: CellValues::from(CellValue::Blank),
                        });
                }
            }

            return;
        }

        if transaction.is_user_ai_undo_redo() {
            let (index, old_data_table, dirty_rects) = if let Some(new_data_table) = &new_data_table
            {
                let (old_cell_value, index, old_data_table, dirty_rects) = sheet
                    .data_table_insert_before(index, data_table_pos, new_data_table.to_owned());

                if let Some(old_cell_value) = old_cell_value {
                    transaction
                        .reverse_operations
                        .push(Operation::SetCellValues {
                            sheet_pos,
                            values: old_cell_value.into(),
                        });
                }

                (index, old_data_table, dirty_rects)
            } else {
                sheet.data_table_shift_remove_full(&data_table_pos).map_or(
                    (index, None, HashSet::new()),
                    |(index, _, data_table, dirty_rects)| (index, Some(data_table), dirty_rects),
                )
            };

            self.send_updated_bounds(transaction, sheet_pos.sheet_id);
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_pos.sheet_id) {
                transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            };
            self.thumbnail_dirty_sheet_rect(transaction, sheet_rect);

            if (cfg!(target_family = "wasm") || cfg!(test))
                && transaction.is_user_ai()
                && let Some(sheet) = self.try_sheet(sheet_pos.sheet_id)
            {
                let rows_to_resize = sheet.get_rows_with_wrap_in_rect(sheet_rect.into(), true);
                if !rows_to_resize.is_empty() {
                    transaction
                        .resize_rows
                        .entry(sheet_pos.sheet_id)
                        .or_default()
                        .extend(rows_to_resize);
                }
            }

            self.add_compute_operations(transaction, sheet_rect, Some(sheet_pos));

            transaction
                .forward_operations
                .push(Operation::SetDataTable {
                    sheet_pos,
                    data_table: new_data_table,
                    index,
                    ignore_old_data_table: true,
                });

            transaction
                .reverse_operations
                .push(Operation::SetDataTable {
                    sheet_pos,
                    data_table: old_data_table,
                    index,
                    ignore_old_data_table: true,
                });
        } else {
            let dirty_rects = if let Some(new_data_table) = new_data_table {
                sheet
                    .data_table_insert_before(index, data_table_pos, new_data_table)
                    .3
            } else {
                sheet
                    .data_table_shift_remove(data_table_pos)
                    .map_or(HashSet::new(), |(_, _, dirty_rects)| dirty_rects)
            };

            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            self.send_updated_bounds(transaction, sheet_pos.sheet_id);
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
                ));
            }
        };

        match &transaction.waiting_for_async_code_cell {
            false => {
                return Err(CoreError::TransactionNotFound("Expected transaction to be waiting_for_async_code_cell to be defined in transaction::complete".into()));
            }
            true => {
                if let Some(sheet) = self.try_sheet(current_sheet_pos.sheet_id) {
                    let Some(code_cell) = sheet.code_run_at(&current_sheet_pos.into()) else {
                        return Err(CoreError::TransactionNotFound(
                            "Expected code_cell to be defined in after_calculation_async".into(),
                        ));
                    };
                    if !code_cell.language.is_code_language() {
                        return Err(CoreError::UnhandledLanguage(
                            "Transaction.complete called for an unhandled language".into(),
                        ));
                    }

                    let new_data_table = self.js_code_result_to_code_cell_value(
                        transaction,
                        result,
                        current_sheet_pos,
                        code_cell.language.clone(),
                        code_cell.code.clone(),
                    );

                    self.finalize_data_table(
                        transaction,
                        current_sheet_pos,
                        Some(new_data_table),
                        None,
                        false,
                    );
                }
            }
        }

        #[cfg(feature = "show-first-sheet-operations")]
        {
            println!("\n========= After calculation async =========");
            print_first_sheet!(&self);
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
                ));
            }
        };
        let sheet_id = sheet_pos.sheet_id;
        let pos = Pos::from(sheet_pos);
        let Some(sheet) = self.try_sheet(sheet_id) else {
            // sheet may have been deleted before the async operation completed
            return Ok(());
        };

        let Some(code_run) = sheet.code_run_at(&pos) else {
            // code run may have been deleted before the async operation completed
            return Ok(());
        };

        let new_code_run = CodeRun {
            language: code_run.language.to_owned(),
            code: code_run.code.to_owned(),
            formula_ast: None,
            error: Some(error.to_owned()),
            return_type: None,
            line_number: error
                .span
                .map(|span| span.line_number_of_str(&code_run.code) as u32),
            output_type: code_run.output_type.clone(),
            std_out: None,
            std_err: Some(error.msg.to_string()),
            cells_accessed: std::mem::take(&mut transaction.cells_accessed),
        };

        let table_name = match code_run.language {
            CodeCellLanguage::Formula => "Formula1",
            CodeCellLanguage::Javascript => "JavaScript1",
            CodeCellLanguage::Python => "Python1",
            _ => "Table1",
        };
        let new_data_table = DataTable::new(
            DataTableKind::CodeRun(new_code_run),
            table_name,
            Value::Single(CellValue::Blank),
            false,
            None,
            None,
            None,
        );

        self.finalize_data_table(transaction, sheet_pos, Some(new_data_table), None, false);

        Ok(())
    }

    // Returns a CodeCellValue from a JsCodeResult.
    pub(super) fn js_code_result_to_code_cell_value(
        &mut self,
        transaction: &mut PendingTransaction,
        js_code_result: JsCodeResult,
        start: SheetPos,
        language: CodeCellLanguage,
        code: String,
    ) -> DataTable {
        let table_name = match language {
            CodeCellLanguage::Formula => "Formula1",
            CodeCellLanguage::Javascript => "JavaScript1",
            CodeCellLanguage::Python => "Python1",
            _ => "Table1",
        };

        // sheet may have been deleted before the async operation completed
        let Some(sheet) = self.try_sheet_mut(start.sheet_id) else {
            // todo: this is probably not the best place to handle this
            // sheet may have been deleted before the async operation completed
            let code_run = CodeRun {
                language,
                code,
                formula_ast: None,
                error: Some(RunError {
                    span: None,
                    msg: RunErrorMsg::CodeRunError(
                        "Sheet was deleted before the async operation completed".into(),
                    ),
                }),
                return_type: None,
                line_number: js_code_result.line_number,
                output_type: js_code_result.output_display_type,
                std_out: None,
                std_err: None,
                cells_accessed: std::mem::take(&mut transaction.cells_accessed),
            };

            return DataTable::new(
                DataTableKind::CodeRun(code_run),
                table_name,
                Value::Single(CellValue::Blank), // TODO(ddimaria): this will eventually be an empty vec
                false,
                None,
                None,
                None,
            );
        };

        let value = if js_code_result.success {
            if let Some(array_output) = js_code_result.output_array {
                let (array, ops) = Array::from_string_list(start.into(), sheet, array_output);
                transaction.reverse_operations.extend(ops);
                if let Some(array) = array {
                    Value::Array(array)
                } else {
                    Value::Single("".into())
                }
            } else if let Some(output_value) = js_code_result.output_value {
                let (cell_value, ops) = CellValue::from_js(output_value, start.into(), sheet)
                    .unwrap_or_else(|e| {
                        dbgjs!(format!("Error parsing output value: {}", e));
                        (CellValue::Blank, vec![])
                    });
                transaction.reverse_operations.extend(ops);
                Value::Single(cell_value)
            } else {
                Value::Single(CellValue::Blank)
            }
        } else {
            Value::Single(CellValue::Blank) // TODO(ddimaria): this will eventually be an empty vec
        };

        let error = (!js_code_result.success).then_some({
            let error_msg = js_code_result
                .std_err
                .clone()
                .unwrap_or_else(|| "Unknown Error".into());
            let msg = RunErrorMsg::CodeRunError(error_msg.into());
            let span = js_code_result.line_number.map(|line_number| Span {
                start: line_number,
                end: line_number,
            });
            RunError { span, msg }
        });

        let return_type = js_code_result.success.then_some({
            match value {
                Value::Single(ref cell_value) => cell_value.type_name().into(),
                Value::Array(_) => "array".into(),
                Value::Tuple(_) => "tuple".into(),
                Value::Lambda(_) => "lambda".into(),
            }
        });

        let code_run = CodeRun {
            language,
            code,
            formula_ast: None,
            error,
            return_type,
            line_number: js_code_result.line_number,
            output_type: js_code_result.output_display_type,
            std_out: js_code_result.std_out,
            std_err: js_code_result.std_err,
            cells_accessed: std::mem::take(&mut transaction.cells_accessed),
        };

        let chart_output = match value {
            Value::Single(CellValue::Html(_) | CellValue::Image(_)) => {
                let (pixel_width, pixel_height) = js_code_result
                    .chart_pixel_output
                    .unwrap_or((DEFAULT_HTML_WIDTH, DEFAULT_HTML_HEIGHT));
                Some(
                    sheet
                        .offsets
                        .calculate_grid_size(start.into(), pixel_width, pixel_height),
                )
            }
            _ => None,
        };

        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            table_name,
            value,
            js_code_result.has_headers,
            None,
            None,
            chart_output,
        );

        // If no headers were returned, we want column headers: [0, 1, 2, 3, ...etc]
        if !js_code_result.has_headers
            && !data_table.is_dataframe()
            && !data_table.is_list()
            && !data_table.is_series()
            && !data_table.is_html_or_image()
        {
            let column_headers =
                data_table.default_header_with_name(|i| format!("{}", i - 1), None);
            data_table.with_column_headers(column_headers)
        } else {
            data_table
        }
    }
}

#[cfg(test)]
mod test {

    use super::*;
    use crate::controller::transaction_types::JsCellValueResult;
    use crate::test_create_code_table;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call_count};

    #[test]
    fn test_finalize_data_table() {
        let mut gc: GridController = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = pos![sheet_id!A1];

        // manually set the CellValue::Code
        test_create_code_table(&mut gc, sheet_id, sheet_pos.into(), 1, 1);

        // manually create the transaction
        let transaction = &mut PendingTransaction::default();

        // test finalize_code_cell
        let new_code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "delete me".to_string(),
            formula_ast: None,
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
            cells_accessed: Default::default(),
        };
        let new_data_table = DataTable::new(
            DataTableKind::CodeRun(new_code_run),
            "Table1",
            Value::Single(CellValue::Text("delete me".to_string())),
            false,
            Some(true), // show_name=true to force DataTable storage (preserved from old table)
            Some(false),
            None,
        );
        gc.finalize_data_table(
            transaction,
            sheet_pos,
            Some(new_data_table.clone()),
            None,
            false,
        );
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(
            sheet.data_table_at(&sheet_pos.into()),
            Some(&new_data_table)
        );

        // replace the code_run with another code_run
        // manually create the transaction
        let transaction = &mut PendingTransaction::default();

        // test finalize_code_cell
        let new_code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: "replace me".to_string(),
            formula_ast: None,
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("text".into()),
            line_number: None,
            output_type: None,
            cells_accessed: Default::default(),
        };
        let mut new_data_table = DataTable::new(
            DataTableKind::CodeRun(new_code_run),
            "Table1",
            Value::Single(CellValue::Text("replace me".to_string())),
            false,
            Some(true), // show_name=true to force DataTable storage (preserved from old table)
            Some(false),
            None,
        );
        new_data_table.column_headers = None;

        gc.finalize_data_table(
            transaction,
            sheet_pos,
            Some(new_data_table.clone()),
            None,
            false,
        );
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();

        assert_eq!(
            sheet.data_table_at(&sheet_pos.into()),
            Some(&new_data_table)
        );

        // todo: need a way to test the js functions as that replaced these
        // let summary = transaction.send_transaction(true);
        // assert_eq!(summary.code_cells_modified.len(), 1);
        // assert!(summary.code_cells_modified.contains(&sheet_id));
        // assert!(summary.generate_thumbnail);

        // remove the code_run
        let transaction = &mut PendingTransaction::default();
        gc.finalize_data_table(transaction, sheet_pos, None, None, false);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.data_table_at(&sheet_pos.into()), None);

        // todo: need a way to test the js functions as that replaced these
        // let summary = transaction.send_transaction(true);
        // assert_eq!(summary.code_cells_modified.len(), 1);
        // assert!(summary.code_cells_modified.contains(&sheet_id));
        // assert!(summary.generate_thumbnail);
    }

    #[test]
    fn code_run_image() {
        clear_js_calls();

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
            None,
            false,
        );
        let transaction = gc.last_transaction().unwrap();
        let result = JsCodeResult {
            transaction_id: transaction.id.to_string(),
            success: true,
            output_value: Some(JsCellValueResult("test".into(), 8)),
            ..Default::default()
        };
        gc.calculation_complete(result).unwrap();
        expect_js_call_count("jsSendImage", 1, true);
    }

    #[test]
    fn ensure_chart_size_remains_same_if_same_cell() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet_pos = SheetPos {
            x: 1,
            y: 1,
            sheet_id,
        };

        let languages = vec![CodeCellLanguage::Javascript, CodeCellLanguage::Python];

        for language in languages {
            gc.set_code_cell(
                sheet_pos,
                language.clone(),
                "code".to_string(),
                None,
                None,
                false,
            );
            let transaction = gc.last_transaction().unwrap();
            let result = JsCodeResult {
                transaction_id: transaction.id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("test".into(), 8)),
                chart_pixel_output: Some((100.0, 100.0)),
                ..Default::default()
            };
            gc.calculation_complete(result).unwrap();
            let sheet = gc.try_sheet(sheet_id).unwrap();
            let dt = sheet.data_table_at(&sheet_pos.into()).unwrap();
            assert_eq!(dt.chart_output, Some((2, 5)));

            // change the cell
            gc.set_code_cell(sheet_pos, language, "code".to_string(), None, None, false);
            let transaction = gc.last_transaction().unwrap();
            let result = JsCodeResult {
                transaction_id: transaction.id.to_string(),
                success: true,
                output_value: Some(JsCellValueResult("test".into(), 8)),
                chart_pixel_output: Some((200.0, 200.0)),
                ..Default::default()
            };
            gc.calculation_complete(result).unwrap();
            let sheet = gc.try_sheet(sheet_id).unwrap();
            let dt = sheet.data_table_at(&sheet_pos.into()).unwrap();
            assert_eq!(dt.chart_output, Some((2, 5)));
        }
    }
}
