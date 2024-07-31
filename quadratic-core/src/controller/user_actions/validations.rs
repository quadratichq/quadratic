use uuid::Uuid;

use crate::{
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::{sheet::validations::validation::Validation, SheetId},
    selection::Selection,
};

impl GridController {
    /// Gets a validation based on a validationId
    pub fn validation(&self, sheet_id: SheetId, validation_id: Uuid) -> Option<&Validation> {
        self.try_sheet(sheet_id)
            .and_then(|sheet| sheet.validations.validation(validation_id))
    }

    /// Gets a validation based on a Selection.
    pub fn validation_selection(&self, selection: Selection) -> Option<&Validation> {
        self.try_sheet(selection.sheet_id)
            .and_then(|sheet| sheet.validations.validation_selection(selection))
    }

    /// Gets the validations for a sheet.
    pub fn validations(&self, sheet_id: SheetId) -> Option<&Vec<Validation>> {
        let sheet = self.try_sheet(sheet_id)?;
        sheet.validations.validations()
    }

    pub fn update_validation(&mut self, validation: Validation, cursor: Option<String>) {
        let ops = vec![Operation::SetValidation { validation }];
        self.start_user_transaction(ops, cursor, TransactionName::Validation);
    }

    pub fn remove_validation(
        &mut self,
        sheet_id: SheetId,
        validation_id: Uuid,
        cursor: Option<String>,
    ) {
        let ops = vec![Operation::RemoveValidation {
            sheet_id,
            validation_id,
        }];
        self.start_user_transaction(ops, cursor, TransactionName::Validation);
    }

    pub fn remove_validations(&mut self, sheet_id: SheetId, cursor: Option<String>) {
        if let Some(sheet) = self.try_sheet(sheet_id) {
            if let Some(validations) = sheet.validations.validations() {
                let ops = validations
                    .iter()
                    .map(|v| Operation::RemoveValidation {
                        sheet_id,
                        validation_id: v.id,
                    })
                    .collect();
                self.start_user_transaction(ops, cursor, TransactionName::Validation);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::serial;

    use crate::{
        grid::sheet::validations::validation_rules::{
            validation_logical::ValidationLogical, ValidationRule,
        },
        wasm_bindings::js::{expect_js_call, hash_test},
        Rect,
    };

    use super::*;

    #[test]
    fn validations() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert!(gc.validations(sheet_id).is_none());

        // missing sheet_id should also return None
        assert!(gc.validations(SheetId::new()).is_none());
    }

    #[test]
    #[serial]
    fn update_validation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let selection = Selection::all(sheet_id);
        let validation = Validation {
            id: Uuid::new_v4(),
            selection: selection.clone(),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        gc.update_validation(validation.clone(), None);

        assert_eq!(gc.validations(sheet_id).unwrap().len(), 1);
        assert_eq!(gc.validation_selection(selection), Some(&validation));

        let sheet = gc.sheet(sheet_id);
        let validations = sheet.validations.to_string().unwrap();
        expect_js_call(
            "jsSheetValidations",
            format!("{},{}", sheet_id.to_string(), validations),
            true,
        );
    }

    #[test]
    #[serial]
    fn remove_validations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let selection = Selection::all(sheet_id);
        let validation1 = Validation {
            id: Uuid::new_v4(),
            selection: selection.clone(),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        gc.update_validation(validation1, None);

        let validation2 = Validation {
            id: Uuid::new_v4(),
            selection: Selection::pos(0, 0, sheet_id),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        gc.update_validation(validation2, None);

        assert_eq!(gc.validations(sheet_id).unwrap().len(), 2);

        gc.remove_validations(sheet_id, None);
        assert!(gc.validations(sheet_id).is_none());

        let sheet = gc.sheet(sheet_id);
        let validations = sheet.validations.to_string().unwrap();
        expect_js_call(
            "jsSheetValidations",
            format!("{},{}", sheet_id.to_string(), validations),
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let send = serde_json::to_string(&sheet.get_render_cells(Rect::new(0, 0, 0, 0))).unwrap();
        expect_js_call(
            "jsRenderCellSheets",
            format!("{},{},{},{}", sheet_id, 0, 0, hash_test(&send)),
            true,
        );
    }
}
