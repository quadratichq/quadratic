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
    ) {
        transaction.current_sheet_pos = None;
        transaction.cells_accessed.clear();
        transaction.waiting_for_async = None;

        let sheet_id = sheet_pos.sheet_id;
        let pos: Pos = sheet_pos.into();
        let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
            // sheet may have been deleted
            return;
        };

        // preserve some settings from the previous code run
        if let (Some(old_data_table), Some(new_data_table)) =
            (sheet.data_table(pos), &mut new_data_table)
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
            if new_data_table.is_html_or_image() {
                new_data_table.chart_output = old_data_table.chart_output.to_owned();
            }
        }

        // calculate the chart_output if it is an image or html data table based on the pixel output
        if let Some(new_data_table) = &mut new_data_table {
            if new_data_table.is_html_or_image() && new_data_table.chart_output.is_none() {
                let (pixel_width, pixel_height) = new_data_table
                    .chart_pixel_output
                    .unwrap_or((DEFAULT_HTML_WIDTH, DEFAULT_HTML_HEIGHT));
                let chart_output =
                    sheet
                        .offsets
                        .calculate_grid_size(pos, pixel_width, pixel_height);
                new_data_table.chart_output = Some(chart_output);
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
            new_data_table.update_table_name(&unique_name);
        }

        // index for SetCodeRun is either set by execute_set_code_run or calculated
        let index = index.unwrap_or(
            sheet
                .data_tables
                .get_index_of(&pos)
                .unwrap_or(sheet.data_tables.len()),
        );

        let old_data_table = if let Some(new_data_table) = &new_data_table {
            let index = index.min(sheet.data_tables.len());
            sheet
                .data_tables
                .insert_before(index, pos, new_data_table.to_owned())
                .1
        } else {
            sheet.data_tables.shift_remove(&pos)
        };

        if old_data_table == new_data_table {
            return;
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

        // update fills if needed in either old or new data table
        if new_data_table
            .as_ref()
            .is_some_and(|dt| dt.formats.has_fills())
            || old_data_table
                .as_ref()
                .is_some_and(|dt| dt.formats.has_fills())
        {
            transaction.add_fill_cells(sheet_id);
        }

        // update borders if needed old or new data table
        if new_data_table
            .as_ref()
            .is_some_and(|dt| !dt.borders.is_default())
            || old_data_table
                .as_ref()
                .is_some_and(|dt| !dt.borders.is_default())
        {
            transaction.add_borders(sheet_id);
        }

        transaction.add_from_code_run(
            sheet_id,
            pos,
            old_data_table.as_ref().is_some_and(|dt| dt.is_image()),
            old_data_table.as_ref().is_some_and(|dt| dt.is_html()),
        );
        transaction.add_from_code_run(
            sheet_id,
            pos,
            new_data_table.as_ref().is_some_and(|dt| dt.is_image()),
            new_data_table.as_ref().is_some_and(|dt| dt.is_html()),
        );
        transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);

        self.send_updated_bounds(transaction, sheet_id);

        if (cfg!(target_family = "wasm") || cfg!(test)) && transaction.is_user() {
            if let Some(sheet) = self.try_sheet(sheet_id) {
                let rows = sheet.get_rows_with_wrap_in_rect(&sheet_rect.into(), true);
                if !rows.is_empty() {
                    let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                    resize_rows.extend(rows);
                }
            }
        }

        if transaction.is_user_undo_redo() {
            transaction
                .forward_operations
                .push(Operation::SetDataTable {
                    sheet_pos,
                    data_table: new_data_table,
                    index,
                });

            transaction
                .reverse_operations
                .push(Operation::SetDataTable {
                    sheet_pos,
                    data_table: old_data_table,
                    index,
                });

            if transaction.is_user() {
                self.add_compute_operations(transaction, &sheet_rect, Some(sheet_pos));
                self.check_all_spills(transaction, sheet_pos.sheet_id);
            }

            transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(sheet_rect);
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

        match &transaction.waiting_for_async {
            None => {
                return Err(CoreError::TransactionNotFound("Expected transaction to be waiting_for_async to be defined in transaction::complete".into()));
            }
            Some(code_cell) => {
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
                );
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

        // ensure the code_cell still exists
        let Some(code_cell) = sheet.cell_value(pos) else {
            // cell may have been deleted before the async operation completed
            return Ok(());
        };
        let CellValue::Code(code_cell_value) = code_cell else {
            // code may have been replaced while waiting for async operation
            return Ok(());
        };

        let code_run = sheet
            .data_table(pos)
            .and_then(|data_table| data_table.code_run());

        let new_code_run = match code_run {
            Some(old_code_run) => {
                CodeRun {
                    language: code_cell_value.language.to_owned(),
                    code: code_cell_value.code.to_owned(),
                    error: Some(error.to_owned()),
                    return_type: None,
                    line_number: old_code_run.line_number,
                    output_type: old_code_run.output_type.clone(),
                    std_out: None,
                    std_err: Some(error.msg.to_string()),

                    // keep the old cells_accessed to better rerun after an error
                    cells_accessed: old_code_run.cells_accessed.clone(),
                }
            }
            None => CodeRun {
                language: code_cell_value.language.to_owned(),
                code: code_cell_value.code.to_owned(),
                error: Some(error.to_owned()),
                return_type: None,
                line_number: error
                    .span
                    .map(|span| span.line_number_of_str(&code_cell_value.code) as u32),
                output_type: None,
                std_out: None,
                std_err: Some(error.msg.to_string()),
                cells_accessed: transaction.cells_accessed.clone(),
            },
        };
        let table_name = match code_cell_value.language {
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
            false,
            None,
            None,
            None,
        );

        self.finalize_data_table(transaction, sheet_pos, Some(new_data_table), None);

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
                cells_accessed: transaction.cells_accessed.clone(),
            };

            return DataTable::new(
                DataTableKind::CodeRun(code_run),
                table_name,
                Value::Single(CellValue::Blank), // TODO(ddimaria): this will eventually be an empty vec
                false,
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
            }
        });

        let code_run = CodeRun {
            language,
            code,
            error,
            return_type,
            line_number: js_code_result.line_number,
            output_type: js_code_result.output_display_type,
            std_out: js_code_result.std_out,
            std_err: js_code_result.std_err,
            cells_accessed: std::mem::take(&mut transaction.cells_accessed),
        };

        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            table_name,
            value,
            false,
            js_code_result.has_headers,
            None,
            None,
            js_code_result.chart_pixel_output,
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
    use crate::grid::CodeCellValue;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call_count};

    #[test]
    fn test_finalize_data_table() {
        let mut gc: GridController = GridController::default();
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
            language: CodeCellLanguage::Python,
            code: "delete me".to_string(),
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
            "Table_1",
            Value::Single(CellValue::Text("delete me".to_string())),
            false,
            false,
            Some(true),
            Some(true),
            None,
        );
        gc.finalize_data_table(transaction, sheet_pos, Some(new_data_table.clone()), None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.data_table(sheet_pos.into()), Some(&new_data_table));

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
            language: CodeCellLanguage::Python,
            code: "replace me".to_string(),
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
            "Table_1",
            Value::Single(CellValue::Text("replace me".to_string())),
            false,
            false,
            Some(true),
            Some(true),
            None,
        );
        new_data_table.column_headers = None;

        gc.finalize_data_table(transaction, sheet_pos, Some(new_data_table.clone()), None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.data_table(sheet_pos.into()), Some(&new_data_table));

        // todo: need a way to test the js functions as that replaced these
        // let summary = transaction.send_transaction(true);
        // assert_eq!(summary.code_cells_modified.len(), 1);
        // assert!(summary.code_cells_modified.contains(&sheet_id));
        // assert!(summary.generate_thumbnail);

        // remove the code_run
        let transaction = &mut PendingTransaction::default();
        gc.finalize_data_table(transaction, sheet_pos, None, None);
        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);
        let sheet = gc.try_sheet(sheet_id).unwrap();
        assert_eq!(sheet.data_table(sheet_pos.into()), None);

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
            gc.set_code_cell(sheet_pos, language.clone(), "code".to_string(), None);
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
            let dt = sheet.data_table(sheet_pos.into()).unwrap();
            assert_eq!(dt.chart_output, Some((2, 5)));

            // change the cell
            gc.set_code_cell(sheet_pos, language, "code".to_string(), None);
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
            let dt = sheet.data_table(sheet_pos.into()).unwrap();
            assert_eq!(dt.chart_output, Some((2, 5)));
        }
    }
}
