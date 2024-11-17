//! Settings and getting validation warnings.

use uuid::Uuid;

use crate::{controller::operations::operation::Operation, Pos, SheetPos};

use super::Validations;

impl Validations {
    pub fn get_warning(&self, pos: Pos) -> Option<&Uuid> {
        self.warnings.get(&pos)
    }

    pub fn has_warning(&self, pos: Pos) -> bool {
        self.warnings.contains_key(&pos)
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
        grid::{
            sheet::validations::{
                validation::Validation,
                validation_rules::{validation_logical::ValidationLogical, ValidationRule},
            },
            Sheet, SheetId,
        },
        selection::OldSelection,
    };

    use super::*;

    fn create_validation() -> Validation {
        Validation {
            selection: OldSelection::pos(0, 0, SheetId::test()),
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
}
