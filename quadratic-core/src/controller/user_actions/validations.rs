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
    /// Gets a validation based on a Selection.
    pub fn validation(&self, selection: Selection) -> Option<&Validation> {
        self.try_sheet(selection.sheet_id)
            .and_then(|sheet| sheet.validations.validation(selection))
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
}

#[cfg(test)]
mod tests {
    use crate::grid::sheet::validations::validation_rules::{
        validation_logical::ValidationLogical, ValidationRule,
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
    fn update_validation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let selection = Selection::all(sheet_id);
        let validation = Validation {
            id: Uuid::new_v4(),
            selection: selection.clone(),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        gc.update_validation(validation.clone(), None);

        assert_eq!(gc.validations(sheet_id).unwrap().len(), 1);
        assert_eq!(gc.validation(selection), Some(&validation));
    }
}
