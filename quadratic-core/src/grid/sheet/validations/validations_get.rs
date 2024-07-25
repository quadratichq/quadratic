use uuid::Uuid;

use crate::{grid::Sheet, selection::Selection, CellValue, Pos};

use super::{
    validation::{Validation, ValidationCell, ValidationCreate},
    validation_rules::{validation_list::ValidationList, ValidationRule},
    Validations,
};

impl Validations {
    fn validation_from_id(&self, id: Uuid) -> Option<&Validation> {
        self.validations.get(&id)
    }

    /// Gets a Validation for a Selection. Note, this will only return a Validation if it matches the entire selection.
    pub fn validation(&self, selection: Selection) -> Option<&Validation> {
        if selection.all {
            return self.all.map(|id| self.validation_from_id(id)).flatten();
        }
        let mut found: Option<Uuid> = None;
        if let Some(rows) = selection.rows {
            for selection_row in rows {
                if let Some(row) = self.row_validations.get(&selection_row) {
                    if let Some(found_id) = found {
                        if found_id != *row {
                            return None;
                        }
                    } else {
                        found = Some(*row);
                    }
                } else {
                    return None;
                }
            }
        }
        if let Some(columns) = selection.columns {
            for selection_column in columns {
                if let Some(column) = self.column_validations.get(&selection_column) {
                    if let Some(found_id) = found {
                        if found_id != *column {
                            return None;
                        }
                    } else {
                        found = Some(*column);
                    }
                } else {
                    return None;
                }
            }
        }
        if let Some(rects) = selection.rects {
            for rect in rects {
                for row in rect.min.y..=rect.max.y {
                    for column in rect.min.x..=rect.max.x {
                        if let Some(cell) = self.cell_validations.get(&(column, row).into()) {
                            if let Some(found_id) = found {
                                if found_id != *cell {
                                    return None;
                                }
                            } else {
                                found = Some(*cell);
                            }
                        } else {
                            return None;
                        }
                    }
                }
            }
        }
        found.map(|id| self.validation_from_id(id)).flatten()
    }

    /// Gets a validation Uuid for a pos.
    pub fn validation_id(&self, pos: Pos) -> Option<Uuid> {
        self.cell_validations.get(&pos).copied()
    }

    // Validate a cell value against its validation rule.
    pub fn validate(&self, sheet: &Sheet, pos: Pos, cell_value: &CellValue) -> bool {
        if let Some(rule) = self.validation(Selection::pos(pos.x, pos.y, sheet.id)) {
            rule.validate(sheet, cell_value)
        } else {
            true
        }
    }

    /// Gets a JsValidationCell, which is used to display the validation message in the UI.
    pub fn validation_cell(&self, pos: Pos, sheet: &Sheet) -> Option<ValidationCell> {
        let validation = self.validation(Selection::pos(pos.x, pos.y, sheet.id))?;
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
    pub fn validations_all(&self) -> Vec<&Validation> {
        self.validations.values().collect()
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
                name: String::new(),
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

    #[test]
    fn validations_all() {
        let mut validations = Validations::default();
        let id = Uuid::new_v4();
        validations.validations.insert(
            id,
            Validation {
                id: Uuid::new_v4(),
                name: String::new(),
                rule: ValidationRule::List(ValidationList {
                    source: ValidationListSource::List(vec!["test".to_string()]),
                    ignore_blank: true,
                    drop_down: true,
                }),
                message: Default::default(),
                error: Default::default(),
            },
        );

        let all = validations.validations_all();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, id);
    }

    #[test]
    fn validation_id() {
        let mut validations = Validations::default();
        let id = Uuid::new_v4();
        validations.cell_validations.insert((0, 0).into(), id);

        assert_eq!(validations.validation_id((0, 0).into()), Some(id));
    }
}
