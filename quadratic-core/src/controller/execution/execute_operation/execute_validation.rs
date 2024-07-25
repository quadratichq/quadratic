use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};

impl GridController {
    pub(crate) fn execute_set_validation_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetValidationSelection {
            selection,
            validation_id: validation,
        } = op
        {
            if let Some(sheet) = self.grid.try_sheet_mut(selection.sheet_id) {
                if let Some(validation) = validation {
                    let reverse = sheet.validations.link_validation(selection, validation);
                    transaction.reverse_operations.extend(reverse);
                } else {
                    let reverse = sheet.validations.unlink_validation(selection);
                    transaction.reverse_operations.extend(reverse);
                }
            }
        }
    }

    pub(crate) fn execute_add_validation(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::AddValidation {
            sheet_id,
            validation_id,
            validation,
        } = op
        {
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
                let reverse = sheet
                    .validations
                    .set_validation(sheet_id, validation_id, validation);
                transaction.reverse_operations.extend(reverse);
            }
        }
    }
}
