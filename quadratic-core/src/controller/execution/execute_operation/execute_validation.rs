use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};

impl GridController {
    pub(crate) fn execute_set_validation(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetValidation { validation } = op {
            if let Some(sheet) = self.grid.try_sheet_mut(validation.selection.sheet_id) {
                transaction
                    .forward_operations
                    .push(Operation::SetValidation {
                        validation: validation.clone(),
                    });
                transaction
                    .reverse_operations
                    .extend(sheet.validations.set(validation));
            }
        }
    }

    pub(crate) fn execute_remove_validation(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::RemoveValidation {
            sheet_id,
            validation_id,
        } = op
        {
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
                transaction
                    .forward_operations
                    .push(Operation::RemoveValidation {
                        sheet_id,
                        validation_id,
                    });
                transaction
                    .reverse_operations
                    .extend(sheet.validations.remove(validation_id));
            }
        }
    }
}
