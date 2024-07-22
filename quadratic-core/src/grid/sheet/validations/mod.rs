//! Data Validation for a Sheet. Validations can be shared across multiple cells
//! through a Uuid.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validation::{Validation, ValidationCell};
use validation_rules::{validation_list::ValidationList, ValidationRule};

use crate::{CellValue, Pos};

use super::Sheet;

pub mod validation;
mod validation_rules;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Validations {
    // Holds all validations within a sheet mapped to a Uuid.
    #[serde(default)]
    validations: HashMap<Uuid, Validation>,

    // Map of Uuid validation to a position.
    #[serde(default)]
    cell_validations: HashMap<Pos, Uuid>,
}

impl Validations {
    /// Gets a Validation for a Pos.
    fn validation(&self, pos: Pos) -> Option<&Validation> {
        self.cell_validations
            .get(&pos)
            .map(|id| self.validations.get(id))
            .flatten()
    }

    /// Gets a validation Uuid for a pos.
    pub fn validation_uuid(&self, pos: Pos) -> Option<Uuid> {
        self.cell_validations.get(&pos).copied()
    }

    /// Adds a validation based to a Pos based on its Uuid.
    pub fn link_validation(&mut self, pos: Pos, uuid: Uuid) {
        // if validation was deleted, then nothing more to do
        if self.validations.get(&uuid).is_none() {
            return;
        }
        self.cell_validations.insert(pos, uuid);
    }

    /// Adds a new validation to the sheet.
    pub fn add_validation(&mut self, pos: Pos, validation: Validation) {
        let uuid = Uuid::new_v4();
        self.validations.insert(uuid, validation);
        self.cell_validations.insert(pos, uuid);
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
    use validation_rules::validation_list::ValidationListSource;

    use super::*;

    #[test]
    fn js_validation_cell() {
        let sheet = Sheet::test();

        let mut validations = Validations::default();
        let id = Uuid::new_v4();
        validations.validations.insert(
            id,
            Validation {
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
