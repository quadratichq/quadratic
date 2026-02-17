use uuid::Uuid;

use crate::a1::A1Selection;
use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::grid::SheetId;
use crate::grid::js_types::JsValidationWarning;
use crate::grid::sheet::validations::validation::Validation;
use crate::{Pos, SheetRect};

impl GridController {
    /// Updates validations that need to be updated or deleted when a selection
    /// is deleted from the sheet. Returns the reverse operations to undo the
    /// change.
    pub(crate) fn check_deleted_validations(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        remove_selection: &A1Selection,
        ignore_validation_id: Option<Uuid>,
    ) -> Vec<Operation> {
        let mut reverse_operations = vec![];

        let mut validations_to_change = vec![];
        let mut validations_to_delete = vec![];

        if let Some(sheet) = self.try_sheet(sheet_id) {
            // Collect validations that need to be processed first
            let validations_to_process: Vec<_> = sheet
                .validations
                .validation_overlaps_selection(remove_selection, &self.a1_context)
                .iter()
                .filter(|v| ignore_validation_id.is_none_or(|ignore| ignore != v.id))
                .map(|v| (v.id, (*v).clone()))
                .collect();

            for (validation_id, validation) in validations_to_process {
                if let Some(new_selection) = validation
                    .selection
                    .delete_selection(remove_selection, &self.a1_context)
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
        let Some(sheet) = self.grid.try_sheet_mut(sheet_rect.sheet_id) else {
            return;
        };

        for x in sheet_rect.x_range() {
            for y in sheet_rect.y_range() {
                let value_pos = Pos::new(x, y);

                // Skip non-anchor cells in merge cells - only the anchor cell
                // should have validation warnings
                if let Some(anchor) = sheet.merge_cells.get_anchor(value_pos)
                    && anchor != value_pos
                {
                    // This is a non-anchor cell in a merge - remove any
                    // existing warning and skip validation
                    if sheet.validations.has_warning(value_pos) {
                        transaction.validation_warning_deleted(sheet.id, value_pos);
                        sheet
                            .validations
                            .set_warning(value_pos.to_sheet_pos(sheet.id), None);
                    }
                    continue;
                }

                if let Some(validation) =
                    sheet
                        .validations
                        .validate(sheet, value_pos, &self.a1_context)
                {
                    transaction.validation_warning_added(
                        sheet.id,
                        JsValidationWarning {
                            pos: value_pos,
                            validation: Some(validation.id),
                            style: Some(validation.error.style.clone()),
                        },
                    );
                    sheet
                        .validations
                        .set_warning(value_pos.to_sheet_pos(sheet.id), Some(validation.id));
                } else if sheet.validations.has_warning(value_pos) {
                    transaction.validation_warning_deleted(sheet.id, value_pos);
                    sheet
                        .validations
                        .set_warning(value_pos.to_sheet_pos(sheet.id), None);
                }
            }
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
                    transaction.validation_warning_deleted(sheet_id, *pos);

                    if transaction.is_user_ai_undo_redo() {
                        transaction
                            .reverse_operations
                            .push(Operation::SetValidationWarning {
                                sheet_pos: pos.to_sheet_pos(sheet_id),
                                validation_id: Some(validation_id),
                            });

                        transaction
                            .forward_operations
                            .push(Operation::SetValidationWarning {
                                sheet_pos: pos.to_sheet_pos(sheet_id),
                                validation_id: None,
                            });
                    }

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
                // Skip non-anchor cells in merge cells - only the anchor cell
                // should have validation warnings
                if let Some(anchor) = sheet.merge_cells.get_anchor(*pos)
                    && anchor != *pos
                {
                    // This is a non-anchor cell in a merge - remove any
                    // existing warning and skip validation
                    if sheet
                        .validations
                        .has_warning_for_validation(*pos, validation.id)
                    {
                        remove_warnings.push(*pos);
                    }
                    return;
                }

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

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return;
        };

        warnings.iter().for_each(|(pos, validation_id)| {
            let sheet_pos = pos.to_sheet_pos(sheet_id);
            let old = sheet
                .validations
                .set_warning(sheet_pos, Some(*validation_id));

            transaction
                .validations_warnings
                .entry(sheet_id)
                .or_default()
                .insert(
                    *pos,
                    JsValidationWarning {
                        pos: *pos,
                        style: Some(validation.error.style.clone()),
                        validation: Some(*validation_id),
                    },
                );

            if transaction.is_user_ai_undo_redo() {
                transaction.reverse_operations.push(old);

                transaction
                    .forward_operations
                    .push(Operation::SetValidationWarning {
                        sheet_pos,
                        validation_id: Some(*validation_id),
                    });
            }
        });

        remove_warnings.iter().for_each(|pos| {
            let sheet_pos = pos.to_sheet_pos(sheet_id);
            let old = sheet.validations.set_warning(sheet_pos, None);
            transaction.validation_warning_deleted(sheet_id, *pos);

            if transaction.is_user_ai_undo_redo() {
                transaction.reverse_operations.push(old);

                transaction
                    .forward_operations
                    .push(Operation::SetValidationWarning {
                        sheet_pos,
                        validation_id: None,
                    });
            }
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
            self.check_deleted_validations(
                transaction,
                sheet_id,
                &validation.selection,
                Some(validation.id),
            );

            let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
                return;
            };

            let old = sheet.validations.set(validation.clone());

            if transaction.is_user_ai_undo_redo() {
                transaction.reverse_operations.extend(old);

                transaction
                    .forward_operations
                    .push(Operation::SetValidation {
                        validation: validation.clone(),
                    });
            }

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
            // first, remove any validations that overlap new validation's
            // selection since you can only have one validation per cell
            self.check_deleted_validations(
                transaction,
                validation.selection.sheet_id,
                &validation.selection,
                Some(validation.id),
            );

            let sheet_id = validation.selection.sheet_id;
            let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
                return;
            };

            let updated_validation: Validation = if let Some(existing_validation) =
                sheet.validations.similar_validation(&validation)
            {
                if transaction.is_user_ai_undo_redo() {
                    transaction
                        .reverse_operations
                        .push(Operation::SetValidation {
                            validation: existing_validation.clone(),
                        });
                }
                let new_selection = existing_validation
                    .selection
                    .append_selection(&validation.selection);
                Validation {
                    selection: new_selection,
                    ..existing_validation.clone()
                }
            } else {
                if transaction.is_user_ai_undo_redo() {
                    transaction
                        .reverse_operations
                        .push(Operation::RemoveValidation {
                            sheet_id,
                            validation_id: validation.id,
                        });
                }
                validation
            };
            sheet.validations.set(updated_validation.clone());

            self.remove_validation_warnings(transaction, sheet_id, updated_validation.id);
            self.apply_validation_warnings(transaction, sheet_id, &updated_validation);

            let selection = updated_validation.selection.clone();

            if transaction.is_user_ai_undo_redo() {
                transaction
                    .forward_operations
                    .push(Operation::SetValidation {
                        validation: updated_validation,
                    });
            }

            transaction.validations.insert(sheet_id);

            if transaction.is_server() {
                return;
            }

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

            let selection = sheet
                .validations
                .validation(validation_id)
                .map(|v| v.selection.clone());

            let old = sheet.validations.remove(validation_id);

            if transaction.is_user_ai_undo_redo() {
                transaction.reverse_operations.extend(old);

                transaction
                    .forward_operations
                    .push(Operation::RemoveValidation {
                        sheet_id,
                        validation_id,
                    });
            }

            transaction.validations.insert(sheet.id);

            if transaction.is_server() {
                return;
            }

            self.send_updated_bounds(transaction, sheet_id);
            if let Some(selection) = selection
                && let Some(sheet) = self.grid.try_sheet(sheet_id)
            {
                transaction.add_dirty_hashes_from_selections(
                    sheet,
                    self.a1_context(),
                    vec![selection],
                );
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

            let Some(reverse) = sheet
                .validations
                .remove_selection(&selection, &self.a1_context)
            else {
                return;
            };

            if transaction.is_user_ai_undo_redo() {
                transaction.reverse_operations.extend(reverse);

                transaction
                    .forward_operations
                    .push(Operation::RemoveValidationSelection {
                        sheet_id,
                        selection: selection.clone(),
                    });
            }

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

            let old = sheet.validations.set_warning(sheet_pos, validation_id);

            if transaction.is_user_ai_undo_redo() {
                transaction.reverse_operations.push(old);

                transaction
                    .forward_operations
                    .push(Operation::SetValidationWarning {
                        sheet_pos,
                        validation_id,
                    });
            }

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

    use crate::a1::A1Selection;
    use crate::grid::js_types::JsHashValidationWarnings;
    use crate::grid::sheet::validations::rules::ValidationRule;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call};
    use crate::{Pos, test_util::*};

    #[test]
    fn execute_set_validation() {
        clear_js_calls();

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(pos![sheet_id!A1], "test".to_string(), None, false);

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

        gc.undo(1, None, false);
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
        gc.set_cell_value(pos![sheet_id!A1], "test".to_string(), None, false);

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

        gc.undo(1, None, false);
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

        gc.undo(1, None, false);
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

        let sheet_pos = pos![sheet_id!A1];
        gc.set_cell_value(sheet_pos, "invalid".to_string(), None, false);

        test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A1"));

        // hack changing the sheet without updating the validations
        gc.sheet_mut(sheet_id)
            .set_value(sheet_pos.into(), "".to_string());

        let mut transaction = PendingTransaction::default();
        gc.check_validations(&mut transaction, SheetRect::single_sheet_pos(sheet_pos));

        assert_eq!(
            transaction
                .validations_warnings
                .entry(sheet_id)
                .or_default()
                .get(&sheet_pos.into()),
            Some(&JsValidationWarning {
                pos: sheet_pos.into(),
                style: None,
                validation: None,
            })
        );
    }

    #[test]
    fn test_check_deleted_validations() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let validation = test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A1:B2"));

        let mut transaction = PendingTransaction::default();
        let reverse = gc.check_deleted_validations(
            &mut transaction,
            sheet_id,
            &A1Selection::test_a1("A1"),
            None,
        );

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
    fn test_check_deleted_validations_undo() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_checkbox(&mut gc, A1Selection::test_a1("A1:B2"));

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.validations.validations.first().unwrap().selection,
            A1Selection::test_a1_sheet_id("A1:B2", sheet_id)
        );

        gc.delete_cells(&A1Selection::test_a1("A1"), None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .validations
                .validations
                .first()
                .unwrap()
                .selection
                .ranges,
            A1Selection::test_a1("A2:B2,B1").ranges
        );

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.validations.validations.first().unwrap().selection,
            A1Selection::test_a1_sheet_id("A1:B2", sheet_id)
        );
    }

    #[test]
    fn test_check_validations_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let validation = test_create_checkbox_with_id(&mut gc, selection);
        assert_validation_id(&gc, pos![sheet_id!B4], Some(validation.id));

        let mut transaction = PendingTransaction::default();
        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let reverse = gc.check_deleted_validations(&mut transaction, sheet_id, &selection, None);

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

    #[test]
    fn test_create_or_update_validation() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_checkbox(&mut gc, A1Selection::test_a1("A1:B2"));
        test_create_checkbox(&mut gc, A1Selection::test_a1("D1"));

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);
    }

    #[test]
    fn test_validation_warnings_with_merge_cells() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set invalid values in A1:B2 (checkboxes expect boolean values)
        gc.set_cell_value(pos![sheet_id!A1], "invalid".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!B1], "invalid".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!A2], "invalid".to_string(), None, false);
        gc.set_cell_value(pos![sheet_id!B2], "invalid".to_string(), None, false);

        // Create a validation for the entire range
        let validation = test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A1:B2"));

        // All cells should have warnings initially
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.validations.has_warning(pos![A1]));
        assert!(sheet.validations.has_warning(pos![B1]));
        assert!(sheet.validations.has_warning(pos![A2]));
        assert!(sheet.validations.has_warning(pos![B2]));

        // Merge cells A1:B2
        gc.merge_cells(A1Selection::test_a1("A1:B2"), None, false);

        // After merge, only the anchor cell (A1) should have a warning
        let sheet = gc.sheet(sheet_id);
        assert!(
            sheet.validations.has_warning(pos![A1]),
            "Anchor cell A1 should still have warning"
        );
        assert!(
            !sheet.validations.has_warning(pos![B1]),
            "Non-anchor cell B1 should not have warning"
        );
        assert!(
            !sheet.validations.has_warning(pos![A2]),
            "Non-anchor cell A2 should not have warning"
        );
        assert!(
            !sheet.validations.has_warning(pos![B2]),
            "Non-anchor cell B2 should not have warning"
        );

        // Verify the anchor warning has the correct validation id
        assert_eq!(
            sheet.validations.get_warning(pos![A1]),
            Some(&validation.id)
        );

        // Unmerge cells
        gc.unmerge_cells(A1Selection::test_a1("A1:B2"), None, false);

        // Note: After unmerge, all cells may have warnings again depending on the data
        // The current implementation clears cell values when merging, so unmerging
        // may not restore the original values. This is expected behavior.
        // The key test is that merge cells removes warnings from non-anchor cells.
    }

    #[test]
    fn test_validation_warnings_merge_removes_non_anchor_warnings() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set invalid value only in B1 (not the anchor)
        gc.set_cell_value(pos![sheet_id!B1], "invalid".to_string(), None, false);

        // Create validation for B1
        test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A1:B1"));

        // B1 should have a warning (A1 is blank, which may be valid)
        let sheet = gc.sheet(sheet_id);
        assert!(sheet.validations.has_warning(pos![B1]));

        // Merge cells A1:B1 - A1 becomes the anchor
        gc.merge_cells(A1Selection::test_a1("A1:B1"), None, false);

        // After merge, B1's warning should be removed (it's not the anchor)
        // A1 is the anchor and may or may not have a warning depending on its value
        let sheet = gc.sheet(sheet_id);
        assert!(
            !sheet.validations.has_warning(pos![B1]),
            "Non-anchor cell B1 should not have warning after merge"
        );
    }

    #[test]
    fn test_check_validations_skips_non_anchor_merge_cells() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // First create the merge cells
        gc.merge_cells(A1Selection::test_a1("A1:B2"), None, false);

        // Set an invalid value in the anchor cell
        gc.set_cell_value(pos![sheet_id!A1], "invalid".to_string(), None, false);

        // Create validation for the entire merge range
        test_create_checkbox_with_id(&mut gc, A1Selection::test_a1("A1:B2"));

        // Only the anchor cell should have a warning
        let sheet = gc.sheet(sheet_id);
        assert!(
            sheet.validations.has_warning(pos![A1]),
            "Anchor cell A1 should have warning"
        );
        assert!(
            !sheet.validations.has_warning(pos![B1]),
            "Non-anchor cell B1 should not have warning"
        );
        assert!(
            !sheet.validations.has_warning(pos![A2]),
            "Non-anchor cell A2 should not have warning"
        );
        assert!(
            !sheet.validations.has_warning(pos![B2]),
            "Non-anchor cell B2 should not have warning"
        );
    }
}
