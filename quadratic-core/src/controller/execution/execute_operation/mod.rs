use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;

/// Asserts that an operation is a particular type, and unpacks its contents
/// into the current scope.
///
/// # Examples
///
/// ```ignore
/// fn set_cell_values(transaction: &mut PendingTransaction, op: Operation) {
///     // panic if `op` is not `SetCellValues`
///     unwrap_op!(let SetCellValues { sheet_pos, values } = op);
///
///     println!("sheet_pos: {:?}", sheet_pos);
///     println!("values: {:?}", values);
/// }
/// ```
macro_rules! unwrap_op {
    (let $op_type:ident $contents:tt = $op:ident) => {
        let $crate::controller::operations::operation::Operation::$op_type $contents = $op else {
            unreachable!("expected {}; got {:?}", stringify!($op_type), $op);
        };
    };
}

mod execute_borders;
mod execute_borders_old;
mod execute_code;
mod execute_col_rows;
mod execute_conditional_format;
mod execute_cursor;
mod execute_data_table;
mod execute_formats;
mod execute_formats_old;
mod execute_merge_cells;
mod execute_move_cells;
mod execute_offsets;
mod execute_sheets;
mod execute_validation;
mod execute_values;

impl GridController {
    #[track_caller]
    pub fn handle_execution_operation_result(result: anyhow::Result<()>) {
        if let Err(error) = result {
            dbgjs!(&format!("Error in execute_operation: {:?}", &error));
        }
    }

    /// Removes the first operation from a transaction and executes it.
    pub fn execute_operation(&mut self, transaction: &mut PendingTransaction) {
        if let Some(op) = transaction.operations.pop_front() {
            #[cfg(feature = "show-operations")]
            dbgjs!(&format!("[Operation] {op:?}"));

            #[cfg(feature = "show-first-sheet-operations")]
            println!(
                "{}",
                format!("{op:?}").split('{').next().unwrap_or("Unknown")
            );

            match op {
                Operation::SetCellValues { .. } => self.execute_set_cell_values(transaction, op),
                Operation::SetChartSize { .. } => Self::handle_execution_operation_result(
                    self.execute_set_chart_size(transaction, op),
                ),
                Operation::SetChartCellSize { .. } => Self::handle_execution_operation_result(
                    self.execute_set_chart_cell_size(transaction, op),
                ),
                Operation::AddDataTable { .. } => Self::handle_execution_operation_result(
                    self.execute_add_data_table(transaction, op),
                ),
                Operation::MoveDataTable { .. } => Self::handle_execution_operation_result(
                    self.execute_move_data_table(transaction, op),
                ),
                Operation::DeleteDataTable { .. } => Self::handle_execution_operation_result(
                    self.execute_delete_data_table(transaction, op),
                ),
                Operation::SetDataTableAt { .. } => Self::handle_execution_operation_result(
                    self.execute_set_data_table_at(transaction, op),
                ),
                Operation::FlattenDataTable { .. } => Self::handle_execution_operation_result(
                    self.execute_flatten_data_table(transaction, op),
                ),
                Operation::SwitchDataTableKind { .. } => Self::handle_execution_operation_result(
                    self.execute_code_data_table_to_data_table(transaction, op),
                ),
                Operation::GridToDataTable { .. } => Self::handle_execution_operation_result(
                    self.execute_grid_to_data_table(transaction, op),
                ),
                Operation::DataTableMeta { .. } => Self::handle_execution_operation_result(
                    self.execute_data_table_meta(transaction, op),
                ),
                Operation::DataTableOptionMeta { .. } => Self::handle_execution_operation_result(
                    self.execute_data_table_option_meta(transaction, op),
                ),
                Operation::SortDataTable { .. } => Self::handle_execution_operation_result(
                    self.execute_sort_data_table(transaction, op),
                ),
                Operation::InsertDataTableColumns { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_insert_data_table_column(transaction, op),
                    );
                }
                Operation::DeleteDataTableColumns { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_delete_data_table_column(transaction, op),
                    );
                }
                Operation::InsertDataTableRows { .. } => Self::handle_execution_operation_result(
                    self.execute_insert_data_table_row(transaction, op),
                ),
                Operation::DeleteDataTableRows { .. } => Self::handle_execution_operation_result(
                    self.execute_delete_data_table_row(transaction, op),
                ),
                Operation::DataTableFirstRowAsHeader { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_data_table_first_row_as_header(transaction, op),
                    );
                }
                Operation::DataTableFormats { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_data_table_format(transaction, op),
                    );
                }
                Operation::DataTableBorders { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_data_table_borders(transaction, op),
                    );
                }
                Operation::ComputeCode { .. } => self.execute_compute_code(transaction, op),
                Operation::SetComputeCode { .. } => self.execute_set_compute_code(transaction, op),
                Operation::ComputeCodeSelection { .. } => {
                    self.execute_compute_code_selection(transaction, op);
                }
                Operation::SetCellFormats { .. } => {}
                Operation::SetCellFormatsSelection { .. } => {
                    self.execute_set_cell_formats_selection(transaction, op);
                }
                Operation::SetDataTable { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_set_data_table(transaction, op),
                    );
                }
                Operation::SetCellFormatsA1 { .. } => {
                    self.execute_set_cell_formats_a1(transaction, op);
                }
                Operation::SetBorders { .. } => (), // we no longer support this (12/9/2024)
                Operation::SetBordersSelection { .. } => {
                    self.execute_set_borders_selection(transaction, op);
                }
                Operation::SetBordersA1 { .. } => self.execute_set_borders_a1(transaction, op),

                Operation::MoveCells { .. } => self.execute_move_cells(transaction, op),

                Operation::AddSheet { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_add_sheet(transaction, op),
                    );
                }
                Operation::AddSheetSchema { .. } => Self::handle_execution_operation_result(
                    self.execute_add_sheet_schema(transaction, op),
                ),
                Operation::DeleteSheet { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_delete_sheet(transaction, op),
                    );
                }
                Operation::ReorderSheet { .. } => self.execute_reorder_sheet(transaction, op),
                Operation::SetSheetName { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_set_sheet_name(transaction, op),
                    );
                }
                Operation::SetSheetColor { .. } => self.execute_set_sheet_color(transaction, op),
                Operation::DuplicateSheet { .. } => self.execute_duplicate_sheet(transaction, op),
                Operation::ReplaceSheet { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_replace_sheet(transaction, op),
                    );
                }

                Operation::ResizeColumn { .. } => self.execute_resize_column(transaction, op),
                Operation::ResizeRow { .. } => self.execute_resize_row(transaction, op),
                Operation::ResizeRows { .. } => self.execute_resize_rows(transaction, op),
                Operation::ResizeColumns { .. } => self.execute_resize_columns(transaction, op),
                Operation::DefaultColumnSize { .. } => {
                    self.execute_default_column_size(transaction, op);
                }
                Operation::DefaultRowSize { .. } => self.execute_default_row_size(transaction, op),

                Operation::SetCursor { .. } => self.execute_set_cursor(transaction, op),
                Operation::SetCursorSelection { .. } => {
                    self.execute_set_cursor_selection(transaction, op);
                }
                Operation::SetCursorA1 { .. } => self.execute_set_cursor_a1(transaction, op),

                Operation::SetValidation { .. } => self.execute_set_validation(transaction, op),
                Operation::CreateOrUpdateValidation { .. } => {
                    self.execute_create_or_update_validation(transaction, op);
                }
                Operation::RemoveValidation { .. } => {
                    self.execute_remove_validation(transaction, op);
                }
                Operation::RemoveValidationSelection { .. } => {
                    self.execute_remove_validation_selection(transaction, op);
                }
                Operation::SetValidationWarning { .. } => {
                    self.execute_set_validation_warning(transaction, op);
                }

                Operation::DeleteColumn { .. } => self.execute_delete_column(transaction, op),
                Operation::DeleteColumns { .. } => self.execute_delete_columns(transaction, op),
                Operation::DeleteRow { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_delete_row(transaction, op),
                    );
                }
                Operation::DeleteRows { .. } => {
                    Self::handle_execution_operation_result(
                        self.execute_delete_rows(transaction, op),
                    );
                }

                Operation::InsertColumn { .. } => self.execute_insert_column(transaction, op),
                Operation::InsertRow { .. } => self.execute_insert_row(transaction, op),

                Operation::MoveColumns { .. } => self.execute_move_columns(transaction, op),
                Operation::MoveRows { .. } => self.execute_move_rows(transaction, op),

                Operation::SetMergeCells { .. } => self.execute_set_merge_cells(transaction, op),

                Operation::SetConditionalFormat { .. } => {
                    self.execute_set_conditional_format(transaction, op);
                }
                Operation::RemoveConditionalFormat { .. } => {
                    self.execute_remove_conditional_format(transaction, op);
                }
            }
        }

        #[cfg(feature = "show-first-sheet-operations")]
        print_first_sheet!(&self);
    }

    /// Notifies about the next operation if it's a ComputeCode operation
    /// This is called right before executing the next operation to ensure
    /// newly added operations are included in the notification
    pub(super) fn notify_next_operation_if_code(&self, transaction: &PendingTransaction) {
        // Peek at the front of the queue without removing it
        if let Some(Operation::ComputeCode { sheet_pos }) = transaction.operations.front()
            && let Some(sheet) = self.try_sheet(sheet_pos.sheet_id)
            && let Some(code_run) = sheet.code_run_at(&(*sheet_pos).into())
        {
            let language = code_run.language.clone();

            // Skip notification for formulas - they execute synchronously and don't need
            // progress tracking. This avoids O(n²) iteration through pending operations.
            if !language.is_code_language() {
                return;
            }

            let code = code_run.code.clone();
            // Notify about this operation as current, with all remaining operations as pending
            // Call notify_code_running_state which is defined in execute_code module
            // Since both are impl GridController blocks, we can call it directly on self
            self.notify_code_running_state(transaction, Some((*sheet_pos, language, code)));
        }
    }
}

#[cfg(test)]
pub fn execute_reverse_operations(gc: &mut GridController, transaction: &PendingTransaction) {
    use super::TransactionSource;

    let undo_transaction = transaction.to_undo_transaction();
    gc.start_undo_transaction(undo_transaction, TransactionSource::Undo, None);
}

#[cfg(test)]
pub fn execute_forward_operations(gc: &mut GridController, transaction: &mut PendingTransaction) {
    use super::TransactionSource;

    let redo_transaction = transaction.to_forward_transaction();
    gc.start_undo_transaction(redo_transaction, TransactionSource::Redo, None);
}
