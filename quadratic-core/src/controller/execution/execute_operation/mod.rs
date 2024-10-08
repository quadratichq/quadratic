use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;

mod execute_borders;
mod execute_code;
mod execute_col_rows;
mod execute_cursor;
mod execute_data_table;
mod execute_formats;
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

    /// Executes the given operation.
    ///
    pub fn execute_operation(&mut self, transaction: &mut PendingTransaction) {
        if let Some(op) = transaction.operations.pop_front() {
            #[cfg(feature = "show-operations")]
            dbgjs!(&format!("[Operation] {:?}", &op));

            match op {
                Operation::SetCellValues { .. } => self.execute_set_cell_values(transaction, op),
                Operation::SetCodeRun { .. } => self.execute_set_code_run(transaction, op),
                Operation::SetDataTableAt { .. } => Self::handle_execution_operation_result(
                    self.execute_set_data_table_at(transaction, op),
                ),
                Operation::FlattenDataTable { .. } => Self::handle_execution_operation_result(
                    self.execute_flatten_data_table(transaction, op),
                ),
                Operation::ComputeCode { .. } => self.execute_compute_code(transaction, op),
                Operation::SetCellFormats { .. } => self.execute_set_cell_formats(transaction, op),
                Operation::SetCellFormatsSelection { .. } => {
                    self.execute_set_cell_formats_selection(transaction, op);
                }
                Operation::SetBorders { .. } => self.execute_set_borders(transaction, op),
                Operation::SetBordersSelection { .. } => {
                    self.execute_set_borders_selection(transaction, op);
                }

                Operation::MoveCells { .. } => self.execute_move_cells(transaction, op),

                Operation::AddSheet { .. } => self.execute_add_sheet(transaction, op),
                Operation::AddSheetSchema { .. } => self.execute_add_sheet_schema(transaction, op),

                Operation::DeleteSheet { .. } => self.execute_delete_sheet(transaction, op),
                Operation::ReorderSheet { .. } => self.execute_reorder_sheet(transaction, op),
                Operation::SetSheetName { .. } => self.execute_set_sheet_name(transaction, op),
                Operation::SetSheetColor { .. } => self.execute_set_sheet_color(transaction, op),
                Operation::DuplicateSheet { .. } => self.execute_duplicate_sheet(transaction, op),

                Operation::ResizeColumn { .. } => self.execute_resize_column(transaction, op),
                Operation::ResizeRow { .. } => self.execute_resize_row(transaction, op),
                Operation::ResizeRows { .. } => self.execute_resize_rows(transaction, op),

                Operation::SetCursor { .. } => self.execute_set_cursor(transaction, op),
                Operation::SetCursorSelection { .. } => {
                    self.execute_set_cursor_selection(transaction, op);
                }

                Operation::SetValidation { .. } => self.execute_set_validation(transaction, op),
                Operation::RemoveValidation { .. } => {
                    self.execute_remove_validation(transaction, op);
                }
                Operation::SetValidationWarning { .. } => {
                    self.execute_set_validation_warning(transaction, op);
                }

                Operation::DeleteColumn { .. } => self.execute_delete_column(transaction, op),
                Operation::DeleteRow { .. } => self.execute_delete_row(transaction, op),
                Operation::InsertColumn { .. } => self.execute_insert_column(transaction, op),
                Operation::InsertRow { .. } => self.execute_insert_row(transaction, op),
            }

            if cfg!(target_family = "wasm") || cfg!(test) {
                crate::wasm_bindings::js::jsTransactionProgress(
                    transaction.id.to_string(),
                    transaction.operations.len() as i32,
                );
            }
        }
    }
}
