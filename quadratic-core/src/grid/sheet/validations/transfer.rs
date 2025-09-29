use crate::{a1::A1Context, controller::operations::operation::Operation};

use super::{Validations, validation::Validation};

impl Validations {
    /// Transfers the validations from a table to the sheet (during a flatten).
    /// Returns the reverse operations.
    pub(crate) fn transfer_to_sheet(
        &mut self,
        table_name: &String,
        context: &A1Context,
    ) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        for validation in self.validations.iter_mut() {
            if validation.selection.has_table_refs()
                && let Some(new_selection) = validation
                    .selection
                    .replace_table_refs_table(table_name, context)
                {
                    reverse_operations.push(Operation::SetValidation {
                        validation: validation.clone(),
                    });
                    *validation = Validation {
                        selection: new_selection,
                        ..validation.clone()
                    };
                }
        }

        reverse_operations
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::{
        Rect,
        a1::{A1Context, A1Selection},
        controller::operations::operation::Operation,
        grid::sheet::validations::{Validations, rules::ValidationRule, validation::Validation},
    };

    #[test]
    fn test_transfer_to_sheet() {
        let mut validations = Validations::default();
        let table_name = "test_table";
        let context = A1Context::test(&[], &[(table_name, &["Column 1"], Rect::test_a1("A1:B4"))]);

        // Create a validation with table references
        let validation = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_context("test_table[Column 1]", &context),
            rule: ValidationRule::Logical(Default::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation.clone());

        // Transfer the validation to the sheet
        let reverse_operations = validations.transfer_to_sheet(&table_name.to_string(), &context);

        // Verify the reverse operations
        assert_eq!(reverse_operations.len(), 1);
        if let Operation::SetValidation {
            validation: reverse_validation,
        } = &reverse_operations[0]
        {
            assert_eq!(reverse_validation.selection, validation.selection);
        } else {
            panic!("Expected SetValidation operation");
        }

        // Verify the validation was updated
        assert_eq!(validations.validations.len(), 1);
        let updated_validation = &validations.validations[0];
        assert_ne!(updated_validation.selection, validation.selection);
        assert!(!updated_validation.selection.has_table_refs());
    }
}
