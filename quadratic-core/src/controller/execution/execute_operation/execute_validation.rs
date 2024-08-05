use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    SheetRect,
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
                    .extend(sheet.validations.set(validation.clone()));

                transaction.send_validations.insert(sheet.id);

                if !transaction.is_server() {
                    self.send_updated_bounds(validation.selection.sheet_id);
                    self.send_render_cells_selection(validation.selection, true);
                }
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

                let selection = sheet
                    .validations
                    .validation(validation_id)
                    .and_then(|v| Some(v.selection.clone()));

                transaction
                    .reverse_operations
                    .extend(sheet.validations.remove(validation_id));

                transaction.send_validations.insert(sheet.id);

                if !transaction.is_server() {
                    if let Some(selection) = selection {
                        self.send_updated_bounds(selection.sheet_id);
                        self.send_render_cells_selection(selection, true);
                    }
                }
            };
        }
    }

    pub(crate) fn execute_set_validation_warning(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetValidationWarning {
            sheet_pos,
            validation_id,
        } = op
        {
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_pos.sheet_id) {
                transaction
                    .forward_operations
                    .push(Operation::SetValidationWarning {
                        sheet_pos,
                        validation_id,
                    });

                let old = sheet.validations.set_warning(sheet_pos, validation_id);
                transaction.reverse_operations.push(old);

                if !transaction.is_server() {
                    self.send_updated_bounds(sheet_pos.sheet_id);
                    self.send_render_cells(&SheetRect::single_sheet_pos(sheet_pos));
                }
            }
        }
    }
}
