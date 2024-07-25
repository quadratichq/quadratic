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
            validation,
        } = op
        {
            if let Some(sheet) = self.grid.try_sheet_mut(selection.sheet_id) {
                if let Some(validation) = validation {
                    if let Some(reverse) = sheet.validations.add_validation(validation, selection) {
                        transaction.reverse_operations.insert(0, reverse);
                    }
                } else {
                    if let Some(reverse) = sheet.validations.remove_validation(selection) {
                        transaction.reverse_operations.insert(0, reverse);
                    }
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
            if let Some(sheet) = self.grid.try_sheet_mut(selection.sheet_id) {
                if let Some(reverse) = sheet.validations.add_validation(validation, selection) {
                    transaction.reverse_operations.insert(0, reverse);
                }
            }
        }
    }
}
