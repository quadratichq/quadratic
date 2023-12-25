use crate::controller::operations::operation::Operation;
use crate::controller::GridController;

use super::TransactionType;

pub mod execute_offsets;
pub mod execute_set_borders;
pub mod execute_set_cell_formats;
pub mod execute_set_cell_values;
pub mod execute_set_code_cell;
pub mod execute_sheets;

impl GridController {
    /// Executes the given operation.
    ///
    pub fn execute_operation(&mut self, op: Operation, transaction_type: TransactionType) {
        let is_user = matches!(transaction_type, TransactionType::User);
        let is_undo = matches!(transaction_type, TransactionType::Undo)
            || matches!(transaction_type, TransactionType::Redo);
        match op {
            Operation::SetCellValues { .. } => self.execute_set_cell_values(&op, is_user, is_undo),
            Operation::SetCodeCell { .. } => self.execute_set_code_cell(&op, is_user, is_undo),
            Operation::SetCellFormats { .. } => self.execute_set_cell_formats(&op),
            Operation::SetBorders { .. } => self.execute_set_borders(&op),

            Operation::AddSheet { .. } => self.execute_add_sheet(&op),
            Operation::DeleteSheet { .. } => self.execute_delete_sheet(&op),
            Operation::ReorderSheet { .. } => self.execute_reorder_sheet(&op),
            Operation::SetSheetName { .. } => self.execute_set_sheet_name(&op),
            Operation::SetSheetColor { .. } => self.execute_set_sheet_color(&op),

            Operation::ResizeColumn { .. } => self.execute_resize_column(&op),
            Operation::ResizeRow { .. } => self.execute_resize_row(&op),
        }
    }
}
