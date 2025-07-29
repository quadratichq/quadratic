use uuid::Uuid;

use crate::SheetRect;
use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::grid::SheetId;
use crate::grid::js_types::JsValidationWarning;
use crate::grid::sheet::validations::validation::Validation;

impl GridController {
    /// Updates validations that need to be updated or deleted when a selection
    /// is deleted from the sheet. Returns the reverse operations to undo the
    /// change.
    pub(crate) fn check_deleted_validations(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        remove_selection: A1Selection,
    ) -> Vec<Operation> {
        let mut reverse_operations = vec![];

        let mut validations_to_change = vec![];
        let mut validations_to_delete = vec![];

        if let Some(sheet) = self.try_sheet(sheet_id) {
            // Collect validations that need to be processed first
            let validations_to_process: Vec<_> = sheet
                .validations
                .validation_overlaps_selection(&remove_selection, &self.a1_context)
                .iter()
                .map(|v| (v.id, (*v).clone()))
                .collect();

            for (validation_id, validation) in validations_to_process {
                if let Some(new_selection) = validation
                    .selection
                    .delete_selection(&remove_selection, &self.a1_context)
                {
                    // if the selection is different, then update the validation
                    if validation.selection != new_selection {
                        let validation = Validation {
                            selection: new_selection,
                            ..validation.clone()
                        };
                        validations_to_change.push(validation);
                    }
                } else {
                    // this handles the case where the selection completely
                    // overlaps the validation
                    validations_to_delete.push(validation_id);
                }
            }
        }

        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            for validation in validations_to_change {
                reverse_operations.extend(sheet.validations.set(validation));
                transaction.validations.insert(sheet_id);
            }
            for validation_id in validations_to_delete {
                reverse_operations.extend(sheet.validations.remove(validation_id));
                transaction.validations.insert(sheet_id);
            }
        }

        reverse_operations
    }

    pub(crate) fn check_validations(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: SheetRect,
    ) {
        let validations: Vec<Validation>;
        if let Some(sheet) = self.grid.try_sheet(sheet_rect.sheet_id) {
            validations = sheet
                .validations
                .in_rect((sheet_rect).into(), self.a1_context())
                .iter()
                .map(|v| (*v).clone())
                .collect();
        } else {
            validations = vec![];
        };

        for validation in validations {
            self.apply_validation_warnings(transaction, sheet_rect.sheet_id, &validation);
        }
    }

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
        validation: &Validation,
    ) {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };
        let mut warnings = vec![];
        let mut remove_warnings = vec![];
        let context = self.a1_context();
        if let Some(values) = sheet.selection_values(
            &validation.selection,
            None,
            false,
            true,
            true,
            &self.a1_context,
        ) {
            values.iter().for_each(|(pos, _)| {
                if let Some(validation) = sheet.validations.validate(sheet, *pos, context) {
                    warnings.push((*pos, validation.id));
                } else if sheet
                    .validations
                    .has_warning_for_validation(*pos, validation.id)
                {
                    remove_warnings.push(*pos);
                }
            });
        }
        let validation_warnings = transaction
            .validations_warnings
            .entry(sheet_id)
            .or_default();

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return;
        };
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
                    pos: *pos,
                    style: Some(validation.error.style.clone()),
                    validation: Some(*validation_id),
                },
            );
        });

        remove_warnings.iter().for_each(|pos| {
            let sheet_pos = pos.to_sheet_pos(sheet_id);
            let old = sheet.validations.set_warning(sheet_pos, None);
            transaction
                .forward_operations
                .push(Operation::SetValidationWarning {
                    sheet_pos,
                    validation_id: None,
                });
            transaction.reverse_operations.push(old);
            transaction.validation_warning_deleted(sheet_id, *pos);
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

            self.apply_validation_warnings(transaction, sheet_id, &validation);

            if transaction.is_server() {
                return;
            }

            self.send_updated_bounds(transaction, sheet_id);
            if let Some(sheet) = self.grid.try_sheet(sheet_id) {
                transaction.add_dirty_hashes_from_selections(
                    sheet,
                    self.a1_context(),
                    vec![validation.selection],
                );
            }
        }
    }

    pub(crate) fn execute_create_or_update_validation(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::CreateOrUpdateValidation { validation } = op {
            let sheet_id = validation.selection.sheet_id;
            let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
                return;
            };

            let updated_validation: Validation;
            if let Some(existing_validation) = sheet.validations.similar_validation(&validation) {
                let new_selection = existing_validation
                    .selection
                    .append_selection(&validation.selection);
                updated_validation = Validation {
                    selection: new_selection,
                    ..existing_validation.clone()
                };
                transaction
                    .reverse_operations
                    .push(Operation::SetValidation {
                        validation: existing_validation.clone(),
                    });
            } else {
                transaction
                    .reverse_operations
                    .push(Operation::RemoveValidation {
                        sheet_id,
                        validation_id: validation.id,
                    });
                updated_validation = validation;
            }
            sheet.validations.set(updated_validation.clone());

            self.remove_validation_warnings(transaction, sheet_id, updated_validation.id);
            self.apply_validation_warnings(transaction, sheet_id, &updated_validation);

            transaction
                .forward_operations
                .push(Operation::SetValidation {
                    validation: updated_validation,
                });

            transaction.validations.insert(sheet_id);
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
                    transaction.add_dirty_hashes_from_selections(
                        sheet,
                        self.a1_context(),
                        vec![selection],
                    );
                }
            }
        }
    }

    pub(crate) fn execute_remove_validation_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::RemoveValidationSelection {
            sheet_id,
            selection,
        } = op
        {
            let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
                return;
            };

            if let Some(reverse) = sheet
                .validations
                .remove_selection(&selection, &self.a1_context)
            {
                transaction.reverse_operations.extend(reverse);
            } else {
                return;
            }

            transaction
                .forward_operations
                .push(Operation::RemoveValidationSelection {
                    sheet_id,
                    selection: selection.clone(),
                });

            if transaction.is_server() {
                return;
            }
            transaction.validations.insert(sheet_id);

            self.send_updated_bounds(transaction, sheet_id);
            if let Some(sheet) = self.grid.try_sheet(sheet_id) {
                transaction.add_dirty_hashes_from_selections(
                    sheet,
                    self.a1_context(),
                    vec![selection],
                );
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
                            pos: sheet_pos.into(),
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

    use crate::grid::js_types::JsHashValidationWarnings;
    use crate::grid::sheet::validations::rules::ValidationRule;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call};
    use crate::{CellValue, a1::A1Selection};
    use crate::{Pos, test_util::*};

    #[test]
    fn execute_set_validation() {
        clear_js_calls();

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![A1], CellValue::Text("test".to_string()));

        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1", sheet_id),
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
                "{},{:?}",
                sheet_id,
                serde_json::to_vec(&vec![validation.clone()]).unwrap()
            ),
            false,
        );
        let warnings = vec![JsHashValidationWarnings {
            sheet_id,
            hash: None,
            warnings: vec![JsValidationWarning {
                pos: Pos { x: 1, y: 1 },
                validation: Some(validation.id),
                style: Some(validation.error.style.clone()),
            }],
        }];
        expect_js_call(
            "jsValidationWarnings",
            format!("{:?}", serde_json::to_vec(&warnings).unwrap()),
            true,
        );

        gc.undo(None);
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{:?}",
                sheet_id,
                serde_json::to_vec(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        let warnings = vec![JsHashValidationWarnings {
            sheet_id,
            hash: None,
            warnings: vec![JsValidationWarning {
                pos: Pos { x: 1, y: 1 },
                validation: None,
                style: None,
            }],
        }];
        expect_js_call(
            "jsValidationWarnings",
            format!("{:?}", serde_json::to_vec(&warnings).unwrap()),
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
            selection: A1Selection::test_a1_sheet_id("A1", sheet_id),
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
                "{},{:?}",
                sheet_id,
                serde_json::to_vec(&vec![validation.clone()]).unwrap()
            ),
            false,
        );
        let warnings = vec![JsHashValidationWarnings {
            sheet_id,
            hash: None,
            warnings: vec![JsValidationWarning {
                pos: Pos { x: 1, y: 1 },
                validation: Some(validation.id),
                style: Some(validation.error.style.clone()),
            }],
        }];
        expect_js_call(
            "jsValidationWarnings",
            format!("{:?}", serde_json::to_vec(&warnings).unwrap()),
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
                "{},{:?}",
                sheet_id,
                serde_json::to_vec(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        let warnings = vec![JsHashValidationWarnings {
            sheet_id,
            hash: None,
            warnings: vec![JsValidationWarning {
                pos: Pos { x: 1, y: 1 },
                validation: None,
                style: None,
            }],
        }];
        expect_js_call(
            "jsValidationWarnings",
            format!("{:?}", serde_json::to_vec(&warnings).unwrap()),
            true,
        );

        gc.undo(None);
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{:?}",
                sheet_id,
                serde_json::to_vec(&vec![validation.clone()]).unwrap()
            ),
            false,
        );
        let warnings = vec![JsHashValidationWarnings {
            sheet_id,
            hash: None,
            warnings: vec![JsValidationWarning {
                pos: Pos { x: 1, y: 1 },
                validation: Some(validation.id),
                style: Some(validation.error.style.clone()),
            }],
        }];
        expect_js_call(
            "jsValidationWarnings",
            format!("{:?}", serde_json::to_vec(&warnings).unwrap()),
            true,
        );

        gc.undo(None);
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{:?}",
                sheet_id,
                serde_json::to_vec(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        let warnings = vec![JsHashValidationWarnings {
            sheet_id,
            hash: None,
            warnings: vec![JsValidationWarning {
                pos: Pos { x: 1, y: 1 },
                validation: None,
                style: None,
            }],
        }];
        expect_js_call(
            "jsValidationWarnings",
            format!("{:?}", serde_json::to_vec(&warnings).unwrap()),
            true,
        );
    }

    #[test]
    fn test_remove_validation_warnings() {
        clear_js_calls();

        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_cell_value(pos![sheet_id!A1], "invalid".to_string(), None);

        let validation = test_create_checkbox(&mut gc, A1Selection::test_a1("A1"));

        // hack changing the sheet without updating the validations
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![A1], "".to_string());

        let mut transaction = PendingTransaction::default();
        gc.check_validations(
            &mut transaction,
            SheetRect::single_sheet_pos(pos![sheet_id!A1]),
        );

        assert_eq!(
            transaction.forward_operations,
            vec![Operation::SetValidationWarning {
                sheet_pos: pos![sheet_id!A1],
                validation_id: None,
            }]
        );

        assert_eq!(
            transaction.reverse_operations,
            vec![Operation::SetValidationWarning {
                sheet_pos: pos![sheet_id!A1],
                validation_id: Some(validation.id),
            }]
        );
    }

    #[test]
    fn test_check_deleted_validations() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let validation = test_create_checkbox(&mut gc, A1Selection::test_a1("A1:B2"));

        let mut transaction = PendingTransaction::default();
        let reverse =
            gc.check_deleted_validations(&mut transaction, sheet_id, A1Selection::test_a1("A1"));

        // check reverse operations
        assert!(transaction.validations.contains(&sheet_id));

        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::SetValidation {
                validation: validation.clone()
            }
        );

        // check that A1 was deleted from A1:B2
        assert_validation_id(&gc, pos![sheet_id!A1], None);
        assert_validation_id(&gc, pos![sheet_id!B2], Some(validation.id));
    }

    #[test]
    fn test_check_validations_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let validation = test_create_checkbox(&mut gc, selection);
        assert_validation_id(&gc, pos![sheet_id!B4], Some(validation.id));

        let mut transaction = PendingTransaction::default();
        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let reverse = gc.check_deleted_validations(&mut transaction, sheet_id, selection);

        assert!(transaction.validations.contains(&sheet_id));
        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::SetValidation {
                validation: validation.clone()
            }
        );

        assert_validation_id(&gc, pos![sheet_id!B4], None);
    }
}
