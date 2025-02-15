use uuid::Uuid;

use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;
use crate::grid::js_types::JsValidationWarning;
use crate::grid::sheet::validations::validation::Validation;
use crate::grid::SheetId;

impl GridController {
    // Remove old warnings from the validation. Adds to client_warnings as necessary.
    fn remove_validation_warnings(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        validation_id: Uuid,
    ) {
        if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            sheet.validations.warnings.retain(|pos, id| {
                if *id == validation_id {
                    transaction
                        .forward_operations
                        .push(Operation::SetValidationWarning {
                            sheet_pos: pos.to_sheet_pos(sheet_id),
                            validation_id: None,
                        });
                    transaction
                        .reverse_operations
                        .push(Operation::SetValidationWarning {
                            sheet_pos: pos.to_sheet_pos(sheet_id),
                            validation_id: Some(validation_id),
                        });
                    transaction.validation_warning_deleted(sheet_id, *pos);
                    false
                } else {
                    true
                }
            });
        }
    }

    // Applies a Validation to the selection and adds necessary ops to the transaction.
    fn apply_validation_warnings(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        validation: Validation,
    ) {
        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return;
        };

        let mut warnings = vec![];
        let context = sheet.a1_context();
        if let Some(values) = sheet.selection_values(&validation.selection, None, false, true) {
            values.iter().for_each(|(pos, _)| {
                if let Some(validation) = sheet.validations.validate(sheet, *pos, &context) {
                    warnings.push((*pos, validation.id));
                }
            });
        }
        let validation_warnings = transaction
            .validations_warnings
            .entry(sheet_id)
            .or_default();

        warnings.iter().for_each(|(pos, validation_id)| {
            let sheet_pos = pos.to_sheet_pos(sheet_id);
            let old = sheet
                .validations
                .set_warning(sheet_pos, Some(*validation_id));
            transaction
                .forward_operations
                .push(Operation::SetValidationWarning {
                    sheet_pos,
                    validation_id: Some(*validation_id),
                });
            transaction.reverse_operations.push(old);
            validation_warnings.insert(
                *pos,
                JsValidationWarning {
                    x: pos.x,
                    y: pos.y,
                    style: Some(validation.error.style.clone()),
                    validation: Some(*validation_id),
                },
            );
        });
    }

    pub(crate) fn execute_set_validation(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetValidation { validation } = op {
            let sheet_id = validation.selection.sheet_id;
            self.remove_validation_warnings(transaction, sheet_id, validation.id);
            let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
                return;
            };

            transaction
                .forward_operations
                .push(Operation::SetValidation {
                    validation: validation.clone(),
                });
            transaction
                .reverse_operations
                .extend(sheet.validations.set(validation.clone()));

            transaction.validations.insert(sheet_id);

            self.apply_validation_warnings(transaction, sheet_id, validation.clone());

            if transaction.is_server() {
                return;
            }

            self.send_updated_bounds(transaction, sheet_id);
            if let Some(sheet) = self.grid.try_sheet(sheet_id) {
                transaction.add_dirty_hashes_from_selections(sheet, vec![validation.selection]);
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
            self.remove_validation_warnings(transaction, sheet_id, validation_id);

            let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
                return;
            };

            transaction
                .forward_operations
                .push(Operation::RemoveValidation {
                    sheet_id,
                    validation_id,
                });

            let selection = sheet
                .validations
                .validation(validation_id)
                .map(|v| v.selection.clone());

            transaction
                .reverse_operations
                .extend(sheet.validations.remove(validation_id));

            transaction.validations.insert(sheet.id);

            if transaction.is_server() {
                return;
            }

            self.send_updated_bounds(transaction, sheet_id);
            if let Some(selection) = selection {
                if let Some(sheet) = self.grid.try_sheet(sheet_id) {
                    transaction.add_dirty_hashes_from_selections(sheet, vec![selection]);
                }
            }
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
            let Some(sheet) = self.grid.try_sheet_mut(sheet_pos.sheet_id) else {
                return;
            };

            transaction
                .forward_operations
                .push(Operation::SetValidationWarning {
                    sheet_pos,
                    validation_id,
                });

            let old = sheet.validations.set_warning(sheet_pos, validation_id);
            transaction.reverse_operations.push(old);

            if transaction.is_server() {
                return;
            }

            self.send_updated_bounds(transaction, sheet_pos.sheet_id);
            if let Some(validation_id) = validation_id {
                if let Some(sheet) = self.grid.try_sheet(sheet_pos.sheet_id) {
                    if let Some(validation) = sheet.validations.validation(validation_id) {
                        let warning = JsValidationWarning {
                            x: sheet_pos.x,
                            y: sheet_pos.y,
                            validation: Some(validation_id),
                            style: Some(validation.error.style.clone()),
                        };
                        transaction.validation_warning_added(sheet_pos.sheet_id, warning);
                    } else {
                        transaction
                            .validation_warning_deleted(sheet_pos.sheet_id, sheet_pos.into());
                    }
                };
            } else {
                transaction.validation_warning_deleted(sheet_pos.sheet_id, sheet_pos.into());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::grid::sheet::validations::validation_rules::ValidationRule;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call};
    use crate::{a1::A1Selection, CellValue};

    #[test]
    fn execute_set_validation() {
        clear_js_calls();

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![A1], CellValue::Text("test".to_string()));

        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1", &sheet_id),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        let op = Operation::SetValidation {
            validation: validation.clone(),
        };
        let mut transaction = PendingTransaction::default();
        transaction.operations.push_back(op);

        gc.start_transaction(&mut transaction);
        assert_eq!(transaction.forward_operations.len(), 2);
        assert_eq!(transaction.reverse_operations.len(), 2);
        gc.finalize_transaction(transaction);

        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![validation.clone()]).unwrap()
            ),
            false,
        );
        let warnings = vec![JsValidationWarning {
            x: 1,
            y: 1,
            validation: Some(validation.id),
            style: Some(validation.error.style.clone()),
        }];
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet_id, serde_json::to_string(&warnings).unwrap()),
            true,
        );

        gc.undo(None);
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        let warnings = vec![JsValidationWarning {
            x: 1,
            y: 1,
            validation: None,
            style: None,
        }];
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet_id, serde_json::to_string(&warnings).unwrap()),
            true,
        );
    }

    #[test]
    fn execute_remove_validation() {
        clear_js_calls();

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![A1], CellValue::Text("test".to_string()));

        // set validation
        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1", &sheet_id),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        let op = Operation::SetValidation {
            validation: validation.clone(),
        };
        let mut transaction = PendingTransaction::default();
        transaction.operations.push_back(op);

        gc.start_transaction(&mut transaction);
        assert_eq!(transaction.forward_operations.len(), 2);
        assert_eq!(transaction.reverse_operations.len(), 2);
        gc.finalize_transaction(transaction);

        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![validation.clone()]).unwrap()
            ),
            false,
        );
        let warnings = vec![JsValidationWarning {
            x: 1,
            y: 1,
            validation: Some(validation.id),
            style: Some(validation.error.style.clone()),
        }];
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet_id, serde_json::to_string(&warnings).unwrap()),
            true,
        );

        // remove validation
        let op = Operation::RemoveValidation {
            sheet_id,
            validation_id: validation.id,
        };
        let mut transaction = PendingTransaction::default();
        transaction.operations.push_back(op);

        gc.start_transaction(&mut transaction);
        assert_eq!(transaction.forward_operations.len(), 2);
        assert_eq!(transaction.reverse_operations.len(), 2);
        gc.finalize_transaction(transaction);

        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        let warnings = vec![JsValidationWarning {
            x: 1,
            y: 1,
            validation: None,
            style: None,
        }];
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet_id, serde_json::to_string(&warnings).unwrap()),
            true,
        );

        gc.undo(None);
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![validation.clone()]).unwrap()
            ),
            false,
        );
        let warnings = vec![JsValidationWarning {
            x: 1,
            y: 1,
            validation: Some(validation.id),
            style: Some(validation.error.style.clone()),
        }];
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet_id, serde_json::to_string(&warnings).unwrap()),
            true,
        );

        gc.undo(None);
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        let warnings = vec![JsValidationWarning {
            x: 1,
            y: 1,
            validation: None,
            style: None,
        }];
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet_id, serde_json::to_string(&warnings).unwrap()),
            true,
        );
    }
}
