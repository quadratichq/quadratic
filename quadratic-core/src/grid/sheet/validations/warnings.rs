//! Settings and getting validation warnings.

use uuid::Uuid;

use crate::{Pos, SheetPos, controller::operations::operation::Operation};

use super::Validations;

impl Validations {
    /// Gets the validation warning for a given position.
    pub fn get_warning(&self, pos: Pos) -> Option<&Uuid> {
        self.warnings.get(&pos)
    }

    /// Checks if a given position has a validation warning.
    pub fn has_warning(&self, pos: Pos) -> bool {
        self.warnings.contains_key(&pos)
    }

    /// Checks if a given position has a validation warning for a given validation id.
    pub fn has_warning_for_validation(&self, pos: Pos, validation_id: Uuid) -> bool {
        self.warnings
            .iter()
            .any(|(warning_pos, id)| *warning_pos == pos && *id == validation_id)
    }

    /// Sets a validation warning. Removes the validation if None is passed.
    pub fn set_warning(&mut self, sheet_pos: SheetPos, validation_id: Option<Uuid>) -> Operation {
        let old = if let Some(validation_id) = validation_id {
            self.warnings.insert(sheet_pos.into(), validation_id)
        } else {
            self.warnings.remove(&sheet_pos.into())
        };
        Operation::SetValidationWarning {
            sheet_pos,
            validation_id: old,
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use crate::{
        a1::A1Selection,
        grid::{
            Sheet,
            sheet::validations::{
                rules::{ValidationRule, validation_logical::ValidationLogical},
                validation::Validation,
            },
        },
    };

    use super::*;

    fn create_validation() -> Validation {
        Validation {
            selection: A1Selection::test_a1("A1"),
            id: Uuid::new_v4(),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        }
    }

    #[test]
    fn warnings() {
        let mut validations = Validations::default();
        let mut sheet = Sheet::test();
        let validation = create_validation();
        sheet.validations.set(validation.clone());

        let sheet_pos = SheetPos::new(sheet.id, 0, 0);
        let old = validations.set_warning(sheet_pos, Some(validation.id));
        assert_eq!(validations.warnings.len(), 1);
        assert_eq!(
            validations.warnings.get(&sheet_pos.into()),
            Some(&validation.id)
        );
        assert_eq!(
            old,
            Operation::SetValidationWarning {
                sheet_pos,
                validation_id: None
            }
        );

        let old = validations.set_warning(sheet_pos, None);
        assert_eq!(validations.warnings.len(), 0);
        assert_eq!(validations.warnings.get(&sheet_pos.into()), None);
        assert_eq!(
            old,
            Operation::SetValidationWarning {
                sheet_pos,
                validation_id: Some(validation.id)
            }
        );
    }

    #[test]
    fn has_warning() {
        let mut validations = Validations::default();
        let mut sheet = Sheet::test();
        let validation = create_validation();
        sheet.validations.set(validation.clone());

        let sheet_pos = SheetPos::new(sheet.id, 0, 0);
        assert!(!validations.has_warning(sheet_pos.into()));

        validations.set_warning(sheet_pos, Some(validation.id));
        assert!(validations.has_warning(sheet_pos.into()));

        validations.set_warning(sheet_pos, None);
        assert!(!validations.has_warning(sheet_pos.into()));
    }

    #[test]
    fn has_warning_for_validation() {
        let mut validations = Validations::default();
        let mut sheet = Sheet::test();
        let validation1 = create_validation();
        let validation2 = create_validation();
        sheet.validations.set(validation1.clone());
        sheet.validations.set(validation2.clone());

        let sheet_pos = SheetPos::new(sheet.id, 0, 0);
        assert!(!validations.has_warning_for_validation(sheet_pos.into(), validation1.id));
        assert!(!validations.has_warning_for_validation(sheet_pos.into(), validation2.id));

        validations.set_warning(sheet_pos, Some(validation1.id));
        assert!(validations.has_warning_for_validation(sheet_pos.into(), validation1.id));
        assert!(!validations.has_warning_for_validation(sheet_pos.into(), validation2.id));

        validations.set_warning(sheet_pos, Some(validation2.id));
        assert!(!validations.has_warning_for_validation(sheet_pos.into(), validation1.id));
        assert!(validations.has_warning_for_validation(sheet_pos.into(), validation2.id));

        validations.set_warning(sheet_pos, None);
        assert!(!validations.has_warning_for_validation(sheet_pos.into(), validation1.id));
        assert!(!validations.has_warning_for_validation(sheet_pos.into(), validation2.id));
    }
}
