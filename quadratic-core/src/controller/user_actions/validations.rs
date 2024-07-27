use std::str::FromStr;

use crate::{
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::{sheet::validations::validation::Validation, SheetId},
    selection::Selection,
};

impl GridController {
    /// Gets a validation based on a Selection.
    pub fn validation(&self, selection: Selection) -> Option<&Validation> {
        self.try_sheet(selection.sheet_id)
            .and_then(|sheet| sheet.validations.validation(selection))
    }

    /// Gets the validations for a sheet.
    pub fn validations(&self, sheet_id: SheetId) -> Vec<&Validation> {
        match self.try_sheet(sheet_id) {
            None => vec![],
            Some(sheet) => sheet.validations.validations_all(),
        }
    }

    pub fn update_validation(
        &mut self,
        selection: Selection,
        validation: Validation,
        cursor: Option<String>,
    ) {
        if let Some(sheet) = self.try_sheet(selection.sheet_id) {
            let validation_id = validation.id;
            let ops = if validation.no_rule() {
                vec![Operation::SetValidationSelection {
                    selection,
                    validation_id: None,
                }]
            } else {
                vec![
                    Operation::AddValidation {
                        sheet_id: sheet.id,
                        validation_id,
                        validation: Some(validation),
                    },
                    Operation::SetValidationSelection {
                        selection,
                        validation_id: Some(validation_id),
                    },
                ]
            };
            self.start_user_transaction(ops, cursor, TransactionName::Validation);
        }
    }

    pub fn delete_validation(&mut self, selection: String, cursor: Option<String>) {
        if let Ok(selection) = Selection::from_str(&selection) {
            let ops = vec![Operation::SetValidationSelection {
                selection,
                validation_id: None,
            }];
            self.start_user_transaction(ops, cursor, TransactionName::Validation);
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;
    use crate::grid::sheet::validations::validation::Validation;
    use crate::grid::sheet::validations::validation_rules::validation_checkbox::ValidationCheckbox;
    use crate::grid::sheet::validations::validation_rules::ValidationRule;
    use crate::selection::Selection;

    #[test]
    fn validations() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        assert!(gc.validations(sheet_id).is_empty());

        // missing sheet_id should just return []
        assert!(gc.validations(SheetId::new()).is_empty());
    }

    #[test]
    fn update_validation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let validation = Validation {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            rule: ValidationRule::Checkbox(ValidationCheckbox {}),
            ..Default::default()
        };
        let selection = Selection::pos(0, 0, sheet_id);
        gc.update_validation(selection.clone(), validation.clone(), None);

        assert_eq!(gc.validation(selection), Some(&validation));
        assert_eq!(gc.validations(sheet_id), vec![&validation]);
    }

    #[test]
    fn delete_validation_using_rule_none() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let validation = Validation {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            rule: ValidationRule::Checkbox(ValidationCheckbox {}),
            ..Default::default()
        };
        let selection = Selection::columns(&[1], sheet_id);
        gc.update_validation(selection.clone(), validation.clone(), None);

        assert_eq!(gc.validation(selection.clone()), Some(&validation));
        assert_eq!(gc.validations(sheet_id), vec![&validation]);

        let validation = Validation {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            rule: ValidationRule::None,
            ..Default::default()
        };
        gc.update_validation(selection.clone(), validation, None);
        assert_eq!(gc.validation(selection), None);
        assert!(gc.validations(sheet_id).is_empty());
    }
}
