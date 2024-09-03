use std::collections::HashMap;

use uuid::Uuid;

use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;
use crate::grid::js_types::JsValidationWarning;
use crate::grid::sheet::validations::validation::Validation;
use crate::grid::SheetId;
use crate::{Pos, SheetRect};

impl GridController {
    // Remove old warnings from the validation. Adds to client_warnings as necessary.
    fn remove_validation_warnings(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        validation_id: Uuid,
        client_warnings: &mut HashMap<Pos, JsValidationWarning>,
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
                    client_warnings.insert(
                        *pos,
                        JsValidationWarning {
                            x: pos.x,
                            y: pos.y,
                            style: None,
                            validation: None,
                        },
                    );
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
        client_warnings: &mut HashMap<Pos, JsValidationWarning>,
    ) {
        if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            let mut warnings = vec![];
            if let Some(values) = sheet.selection(&validation.selection, None, false) {
                let positions = values.iter().map(|(pos, _)| pos);
                positions.for_each(|pos| {
                    if let Some(validation) = sheet.validations.validate(sheet, *pos) {
                        warnings.push((*pos, validation.id));
                    }
                });
            }
            warnings.iter().for_each(|(pos, validation_id)| {
                let sheet_pos = pos.to_sheet_pos(sheet_id);
                let old = sheet
                    .validations
                    .set_warning(sheet_pos, Some(*validation_id));
                transaction
                    .forward_operations
                    .push(Operation::SetValidationWarning {
                        sheet_pos,
                        validation_id: Some(validation.id),
                    });
                transaction.reverse_operations.push(old);
                client_warnings.insert(
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
    }

    pub(crate) fn execute_set_validation(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetValidation { validation } = op {
            let sheet_id = validation.selection.sheet_id;
            let mut client_warnings = HashMap::new();
            self.remove_validation_warnings(
                transaction,
                sheet_id,
                validation.id,
                &mut client_warnings,
            );
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
                transaction
                    .forward_operations
                    .push(Operation::SetValidation {
                        validation: validation.clone(),
                    });
                transaction
                    .reverse_operations
                    .extend(sheet.validations.set(validation.clone()));

                transaction.send_validations.insert(sheet_id);

                if !transaction.is_server() {
                    self.send_updated_bounds(sheet_id);
                    self.send_render_cells_selection(&validation.selection, true);
                }
            }
            self.apply_validation_warnings(transaction, sheet_id, validation, &mut client_warnings);

            Self::send_client_warnings(transaction, sheet_id, client_warnings);
        }
    }

    /// Sends client warnings to the client.
    fn send_client_warnings(
        transaction: &PendingTransaction,
        sheet_id: SheetId,
        client_warnings: HashMap<Pos, JsValidationWarning>,
    ) {
        if !transaction.is_server() && !client_warnings.is_empty() {
            let warnings = client_warnings.values().collect::<Vec<_>>();
            if let Ok(warnings) = serde_json::to_string(&warnings) {
                crate::wasm_bindings::js::jsValidationWarning(sheet_id.to_string(), warnings);
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
            let mut client_warnings = HashMap::new();
            self.remove_validation_warnings(
                transaction,
                sheet_id,
                validation_id,
                &mut client_warnings,
            );
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
                    .map(|v| v.selection.clone());

                transaction
                    .reverse_operations
                    .extend(sheet.validations.remove(validation_id));

                transaction.send_validations.insert(sheet.id);

                if !transaction.is_server() {
                    if let Some(selection) = selection {
                        self.send_updated_bounds(selection.sheet_id);
                        self.send_render_cells_selection(&selection, true);
                    }
                }
                Self::send_client_warnings(transaction, sheet_id, client_warnings);
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

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    use crate::grid::sheet::validations::validation_rules::ValidationRule;
    use crate::selection::Selection;
    use crate::wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count};
    use crate::CellValue;

    #[test]
    #[serial]
    fn execute_set_validation() {
        clear_js_calls();

        let mut gc = GridController::default();
        let mut transaction = PendingTransaction::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text("test".to_string()));

        let validation = Validation {
            id: Uuid::new_v4(),
            selection: Selection::pos(0, 0, sheet_id),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        let op = Operation::SetValidation {
            validation: validation.clone(),
        };
        gc.execute_set_validation(&mut transaction, op);

        assert_eq!(transaction.forward_operations.len(), 2);
        assert_eq!(transaction.reverse_operations.len(), 2);

        expect_js_call_count("jsRenderCellSheets", 1, false);
        let warnings = vec![JsValidationWarning {
            x: 0,
            y: 0,
            validation: Some(validation.id),
            style: Some(validation.error.style.clone()),
        }];
        expect_js_call(
            "jsValidationWarning",
            format!("{},{}", sheet_id, serde_json::to_string(&warnings).unwrap()),
            true,
        );
    }

    #[test]
    #[serial]
    fn execute_remove_validation() {
        clear_js_calls();

        let mut gc = GridController::default();
        let mut transaction = PendingTransaction::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(Pos { x: 0, y: 0 }, CellValue::Text("test".to_string()));

        let validation = Validation {
            id: Uuid::new_v4(),
            selection: Selection::pos(0, 0, sheet_id),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        let op = Operation::SetValidation {
            validation: validation.clone(),
        };
        gc.execute_set_validation(&mut transaction, op);

        let op = Operation::RemoveValidation {
            sheet_id,
            validation_id: validation.id,
        };
        gc.execute_remove_validation(&mut transaction, op);

        assert_eq!(transaction.forward_operations.len(), 4);
        assert_eq!(transaction.reverse_operations.len(), 4);

        expect_js_call_count("jsRenderCellSheets", 2, false);
        let warnings = vec![JsValidationWarning {
            x: 0,
            y: 0,
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
