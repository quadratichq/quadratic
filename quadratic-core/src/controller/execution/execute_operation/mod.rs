use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;

pub mod execute_borders;
pub mod execute_code;
pub mod execute_cursor;
pub mod execute_formats;
pub mod execute_offsets;
pub mod execute_sheets;
pub mod execute_values;

impl GridController {
    /// Executes the given operation.
    ///
    pub fn execute_operation(&mut self, transaction: &mut PendingTransaction) {
        if let Some(op) = transaction.operations.pop_front() {
            #[cfg(feature = "show-operations")]
            dbgjs!(&format!("[Operation] {:?}", &op));

            match op {
                Operation::SetCellValues { .. } => self.execute_set_cell_values(transaction, op),
                Operation::SetCodeRun { .. } => self.execute_set_code_run(transaction, op),
                Operation::ComputeCode { .. } => self.execute_compute_code(transaction, op),
                Operation::SetCellFormats { .. } => self.execute_set_cell_formats(transaction, op),
                Operation::SetBorders { .. } => self.execute_set_borders(transaction, op),

                Operation::AddSheet { .. } => self.execute_add_sheet(transaction, op),
                Operation::DeleteSheet { .. } => self.execute_delete_sheet(transaction, op),
                Operation::ReorderSheet { .. } => self.execute_reorder_sheet(transaction, op),
                Operation::SetSheetName { .. } => self.execute_set_sheet_name(transaction, op),
                Operation::SetSheetColor { .. } => self.execute_set_sheet_color(transaction, op),

                Operation::ResizeColumn { .. } => self.execute_resize_column(transaction, op),
                Operation::ResizeRow { .. } => self.execute_resize_row(transaction, op),

                Operation::SetCursor { .. } => self.execute_set_cursor(transaction, op),
            }
        }
    }
}
