use std::str::FromStr;

use crate::{
    controller::{
        active_transactions::transaction_name::TransactionName, operations::operation::Operation,
        GridController,
    },
    grid::sheet::validations::validation::Validation,
    selection::Selection,
};

impl GridController {
    pub fn update_validation(
        &mut self,
        sheet_id: String,
        validation: String,
        selection: String,
        cursor: Option<String>,
    ) {
        if let (Some(sheet), Ok(validation), Ok(selection)) = (
            self.try_sheet_from_string_id(sheet_id),
            serde_json::from_str::<Validation>(&validation),
            Selection::from_str(&selection),
        ) {
            let validation_id = validation.id;
            let ops = vec![
                Operation::AddValidation {
                    sheet_id: sheet.id,
                    validation_id,
                    validation: Some(validation),
                },
                Operation::SetValidationSelection {
                    selection,
                    validation_id: Some(validation_id),
                },
            ];
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
