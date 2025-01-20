use uuid::Uuid;

use crate::{
    a1::A1Selection,
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::{
        sheet::validations::{
            validation::{Validation, ValidationStyle},
            validation_rules::ValidationRule,
        },
        SheetId,
    },
    CellValue, Pos,
};

impl GridController {
    /// Gets a validation based on a validationId
    pub fn validation(&self, sheet_id: SheetId, validation_id: Uuid) -> Option<&Validation> {
        self.try_sheet(sheet_id)
            .and_then(|sheet| sheet.validations.validation(validation_id))
    }

    /// Gets a validation based on a Selection.
    pub fn validation_selection(&self, selection: A1Selection) -> Option<&Validation> {
        self.try_sheet(selection.sheet_id)
            .and_then(|sheet| sheet.validations.validation_selection(selection))
    }

    /// Gets the validations for a sheet.
    pub fn validations(&self, sheet_id: SheetId) -> Option<&Vec<Validation>> {
        let sheet = self.try_sheet(sheet_id)?;
        sheet.validations.validations()
    }

    /// Creates or updates a validation.
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

    pub fn get_validation_from_pos(&self, sheet_id: SheetId, pos: Pos) -> Option<&Validation> {
        self.try_sheet(sheet_id).and_then(|sheet| {
            sheet
                .validations
                .get_validation_from_pos(pos, &sheet.a1_context())
        })
    }

    /// Gets a list of strings for a validation list (user defined or from a selection).
    pub fn validation_list(&self, sheet_id: SheetId, x: i64, y: i64) -> Option<Vec<String>> {
        let sheet = self.try_sheet(sheet_id)?;
        let validation = sheet
            .validations
            .get_validation_from_pos(Pos { x, y }, &sheet.a1_context())?;
        match validation.rule {
            ValidationRule::List(ref list) => list.to_drop_down(sheet),
            _ => None,
        }
    }

    /// Returns whether an input is valid based on the validation rules. Note:
    /// this will only return the validation_id if STOP is defined as the error
    /// condition.
    pub fn validate_input(&self, sheet_id: SheetId, pos: Pos, input: &str) -> Option<Uuid> {
        let sheet = self.try_sheet(sheet_id)?;
        let validation = sheet
            .validations
            .get_validation_from_pos(pos, &sheet.a1_context())?;
        if validation.error.style != ValidationStyle::Stop {
            return None;
        }
        let cell_value = CellValue::parse_from_str(input);
        if validation.rule.validate(sheet, Some(&cell_value)) {
            None
        } else {
            Some(validation.id)
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::{parallel, serial};

    use crate::{
        grid::sheet::validations::{
            validation::ValidationError,
            validation_rules::{
                validation_list::{ValidationList, ValidationListSource},
                validation_logical::ValidationLogical,
                ValidationRule,
            },
        },
        wasm_bindings::js::expect_js_call,
    };

    use super::*;

    #[test]
    #[parallel]
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

        let selection = A1Selection::test_a1_sheet_id("*", &sheet_id);
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

        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![validation]).unwrap()
            ),
            true,
        );
    }

    #[test]
    #[serial]
    fn remove_validations() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let selection = A1Selection::test_a1_sheet_id("*", &sheet_id);
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
        gc.update_validation(validation1.clone(), None);

        let validation2 = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1"),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        gc.update_validation(validation2.clone(), None);

        assert_eq!(gc.validations(sheet_id).unwrap().len(), 2);
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![validation1, validation2]).unwrap()
            ),
            true,
        );

        gc.remove_validations(sheet_id, None);

        assert!(gc.validations(sheet_id).is_none());
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&Vec::<Validation>::new()).unwrap()
            ),
            true,
        );
    }

    #[test]
    #[parallel]
    fn get_validation_from_pos() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1"),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        gc.update_validation(validation.clone(), None);

        assert_eq!(
            gc.get_validation_from_pos(sheet_id, (1, 1).into()),
            Some(&validation)
        );

        // missing sheet_id should return None
        assert!(gc
            .get_validation_from_pos(SheetId::new(), (1, 1).into())
            .is_none());
    }

    #[test]
    #[parallel]
    fn validation_list_strings() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        let list = ValidationList {
            source: ValidationListSource::List(vec!["a".to_string(), "b".to_string()]),
            ignore_blank: true,
            drop_down: true,
        };
        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1"),
            rule: ValidationRule::List(list),
            message: Default::default(),
            error: Default::default(),
        };
        sheet.validations.set(validation.clone());

        assert_eq!(
            gc.validation_list(sheet_id, 1, 1),
            Some(vec!["a".to_string(), "b".to_string()])
        );
    }

    #[test]
    #[parallel]
    fn validation_list_cells() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        sheet.set_cell_value(pos![A1], "First");
        sheet.set_cell_value(pos![A2], "Second");
        sheet.set_cell_value(pos![A3], "false");
        sheet.set_cell_value(pos![A4], "123");

        let list = ValidationList {
            source: ValidationListSource::Selection(A1Selection::test_a1_sheet_id(
                "A1:A4", &sheet_id,
            )),
            ignore_blank: true,
            drop_down: true,
        };
        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("B1"),
            rule: ValidationRule::List(list),
            message: Default::default(),
            error: Default::default(),
        };
        sheet.validations.set(validation.clone());

        assert_eq!(
            gc.validation_list(sheet_id, 2, 1),
            Some(vec![
                "First".to_string(),
                "Second".to_string(),
                "false".to_string(),
                "123".to_string()
            ])
        );
    }

    #[test]
    #[parallel]
    fn validate_input() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        let list = ValidationList {
            source: ValidationListSource::List(vec!["a".to_string(), "b".to_string()]),
            ignore_blank: true,
            drop_down: true,
        };
        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1"),
            rule: ValidationRule::List(list),
            message: Default::default(),
            error: Default::default(),
        };
        sheet.validations.set(validation.clone());

        assert_eq!(gc.validate_input(sheet_id, (1, 1).into(), "a"), None);
        assert_eq!(
            gc.validate_input(sheet_id, (1, 1).into(), "c"),
            Some(validation.id)
        );

        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A2"),
            rule: ValidationRule::None,
            message: Default::default(),
            error: ValidationError {
                style: ValidationStyle::Warning,
                ..Default::default()
            },
        };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.validations.set(validation.clone());
        assert_eq!(gc.validate_input(sheet_id, (1, 2).into(), "a"), None);
        assert_eq!(gc.validate_input(sheet_id, (1, 2).into(), "c"), None);
    }

    #[test]
    #[parallel]
    fn validate_input_logical() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A3"),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.validations.set(validation.clone());
        assert_eq!(gc.validate_input(sheet_id, (1, 3).into(), "true"), None);
        assert_eq!(
            gc.validate_input(sheet_id, (1, 3).into(), "random"),
            Some(validation.id)
        );
    }
}
