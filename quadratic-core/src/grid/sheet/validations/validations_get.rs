use uuid::Uuid;

use crate::{grid::Sheet, CellValue, Pos};

use super::{
    validation::{Validation, ValidationCell},
    validation_rules::{validation_list::ValidationList, ValidationRule},
    Validations,
};

impl Validations {
    /// Gets a Validation for a Pos.
    pub fn validation(&self, pos: Pos) -> Option<&Validation> {
        self.cell_validations
            .get(&pos)
            .map(|id| self.validations.get(id))
            .flatten()
    }

    /// Gets a validation Uuid for a pos.
    pub fn validation_id(&self, pos: Pos) -> Option<Uuid> {
        self.cell_validations.get(&pos).copied()
    }

    // Validate a cell value against its validation rule.
    pub fn validate(&self, sheet: &Sheet, pos: Pos, cell_value: &CellValue) -> bool {
        if let Some(rule) = self.validation(pos) {
            rule.validate(sheet, cell_value)
        } else {
            true
        }
    }

    /// Gets a JsValidationCell, which is used to display the validation message in the UI.
    pub fn validation_cell(&self, pos: Pos, sheet: &Sheet) -> Option<ValidationCell> {
        let validation = self.validation(pos)?;
        let drop_down = match &validation.rule {
            ValidationRule::List(list) => ValidationList::to_drop_down(sheet, list),
            _ => None,
        };
        Some(ValidationCell {
            title: validation.message.title.clone(),
            message: validation.message.message.clone(),
            drop_down,
        })
    }

    /// Gets all validations in the Sheet.
    pub fn all_validations(&self) -> Vec<(Uuid, &Validation, Vec<Pos>)> {
        self.validations
            .iter()
            .map(|(uuid, validation)| {
                let positions = self
                    .cell_validations
                    .iter()
                    .filter_map(|(pos, id)| if id == uuid { Some(*pos) } else { None })
                    .collect();
                (*uuid, validation, positions)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::sheet::validations::validation_rules::validation_list::ValidationListSource;

    use super::*;

    #[test]
    fn validation_cell() {
        let sheet = Sheet::test();

        let mut validations = Validations::default();
        let id = Uuid::new_v4();
        validations.validations.insert(
            id,
            Validation {
                id: Uuid::new_v4(),
                name: None,
                rule: ValidationRule::List(ValidationList {
                    source: ValidationListSource::List(vec!["test".to_string()]),
                    ignore_blank: true,
                    drop_down: true,
                }),
                message: Default::default(),
                error: Default::default(),
            },
        );
        validations.cell_validations.insert((0, 0).into(), id);

        let cell = validations.validation_cell((0, 0).into(), &sheet).unwrap();
        assert_eq!(cell.title, None);
        assert_eq!(cell.message, None);
        assert_eq!(cell.drop_down, Some(vec!["test".to_string()]));
    }
}
