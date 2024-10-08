//! Data Validations for a Sheet.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validation::{Validation, ValidationDisplay, ValidationDisplaySheet};

use crate::{
    controller::operations::operation::Operation, grid::js_types::JsRenderCellSpecial,
    selection::Selection, Pos, Rect,
};

use super::Sheet;

pub mod validation;
pub mod validation_col_row;
pub mod validation_rules;
pub mod validation_warnings;
pub mod validations_clipboard;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Validations {
    #[serde(default)]
    pub validations: Vec<Validation>,

    #[serde(default)]
    pub warnings: HashMap<Pos, Uuid>,
}

impl Validations {
    /// Updates or adds a new validation to the sheet. Returns the reverse
    /// operations.
    pub fn set(&mut self, validation: Validation) -> Vec<Operation> {
        for v in self.validations.iter_mut() {
            if v.id == validation.id {
                let reverse = vec![Operation::SetValidation {
                    validation: v.clone(),
                }];
                *v = validation.clone();
                return reverse;
            }
        }
        let reverse = vec![Operation::RemoveValidation {
            sheet_id: validation.selection.sheet_id,
            validation_id: validation.id,
        }];
        self.validations.push(validation);
        reverse
    }

    /// Gets a validation based on a validation_id
    pub fn validation(&self, validation_id: Uuid) -> Option<&Validation> {
        self.validations.iter().find(|v| v.id == validation_id)
    }

    /// Gets a validation based on a Selection.
    pub fn validation_selection(&self, selection: Selection) -> Option<&Validation> {
        self.validations.iter().find(|v| v.selection == selection)
    }

    /// Gets all validations in the Sheet.
    pub fn validations(&self) -> Option<&Vec<Validation>> {
        if self.validations.is_empty() {
            None
        } else {
            Some(&self.validations)
        }
    }

    /// Stringifies the validations to send to the client.
    pub fn to_string(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(&self.validations)
    }

    /// Gets the JsRenderCellSpecial for a cell based on Validation.
    pub fn render_special_pos(&self, pos: Pos) -> Option<JsRenderCellSpecial> {
        let mut checkbox = false;
        let mut list = false;
        for v in &self.validations {
            if v.selection.contains_pos(pos) {
                match v.rule {
                    validation_rules::ValidationRule::List(ref validation_list) => {
                        if validation_list.drop_down {
                            list = true;
                            checkbox = false;
                        } else {
                            list = false;
                            checkbox = false;
                        }
                    }
                    validation_rules::ValidationRule::Logical(ref logical) => {
                        if logical.show_checkbox {
                            checkbox = true;
                            list = false;
                        } else {
                            list = false;
                            checkbox = false;
                        }
                    }
                    _ => {}
                }
            }
        }
        if checkbox {
            Some(JsRenderCellSpecial::Checkbox)
        } else if list {
            Some(JsRenderCellSpecial::List)
        } else {
            None
        }
    }

    /// Gets the ValidationDisplaySheet.
    pub fn display_sheet(&self) -> Option<ValidationDisplaySheet> {
        let mut display_columns = HashMap::new();
        let mut display_rows = HashMap::new();
        let mut display_all = ValidationDisplay::default();
        for v in &self.validations {
            if !v.rule.is_list() && !v.rule.is_logical() {
                continue;
            }
            let display = ValidationDisplay {
                checkbox: v.rule.is_logical(),
                list: v.rule.is_list(),
            };
            if let Some(columns) = v.selection.columns.as_ref() {
                columns.iter().for_each(|col| {
                    display_columns.insert(*col, display.clone());
                });
            }
            if let Some(rows) = v.selection.rows.as_ref() {
                rows.iter().for_each(|row| {
                    display_rows.insert(*row, display.clone());
                });
            }
            if v.selection.all {
                display_all = display.clone();
            }
        }
        let v = ValidationDisplaySheet {
            columns: if display_columns.is_empty() {
                None
            } else {
                Some(display_columns.into_iter().collect())
            },
            rows: if display_rows.is_empty() {
                None
            } else {
                Some(display_rows.into_iter().collect())
            },
            all: if display_all.is_default() {
                None
            } else {
                Some(display_all)
            },
        };
        if v.is_default() {
            None
        } else {
            Some(v)
        }
    }

    /// Removes a validation. Returns the reverse operations.
    pub fn remove(&mut self, validation_id: Uuid) -> Vec<Operation> {
        let mut reverse = vec![];
        self.validations.retain(|v| {
            if v.id == validation_id {
                reverse.push(Operation::SetValidation {
                    validation: v.clone(),
                });
                false
            } else {
                true
            }
        });
        reverse
    }

    /// Validates a pos in the sheet. Returns any failing Validation.
    pub fn validate(&self, sheet: &Sheet, pos: Pos) -> Option<&Validation> {
        self.validations.iter().rev().find(|v| {
            v.selection.contains_pos(pos) && !v.rule.validate(sheet, sheet.cell_value_ref(pos))
        })
    }

    /// Returns validations that intersect with a rect. Note: this only checks
    /// Selection.rects; it ignore Selection.all, rows, and columns.
    pub fn in_rect(&self, rect: Rect) -> Vec<&Validation> {
        self.validations
            .iter()
            .filter(|v| v.selection.in_rects(rect))
            .collect()
    }

    /// Gets a validation from a position
    pub fn get_validation_from_pos(&self, pos: Pos) -> Option<&Validation> {
        self.validations
            .iter()
            .find(|v| v.selection.contains_pos(pos))
    }
}

#[cfg(test)]
mod tests {
    use validation_rules::{validation_logical::ValidationLogical, ValidationRule};

    use crate::{grid::SheetId, selection::Selection, Rect};

    use super::*;

    fn create_validation_rect(x0: i64, y0: i64, x1: i64, y1: i64) -> Validation {
        Validation {
            id: Uuid::new_v4(),
            selection: Selection::rect(Rect::new(x0, y0, x1, y1), SheetId::test()),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        }
    }

    #[test]
    fn validation_rect() {
        let mut validations = Validations::default();

        let validation = create_validation_rect(0, 0, 5, 5);
        let reverse = validations.set(validation.clone());
        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.validations[0], validation);
        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::RemoveValidation {
                sheet_id: validation.selection.sheet_id,
                validation_id: validation.id
            }
        );
        assert_eq!(
            validations.render_special_pos((0, 0).into()),
            Some(JsRenderCellSpecial::Checkbox)
        );

        let mut replace = create_validation_rect(1, 1, 5, 5);
        replace.id = validation.id;
        let reverse = validations.set(replace.clone());
        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.validations[0], replace);
        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::SetValidation {
                validation: validation.clone()
            }
        );
        assert_eq!(validations.render_special_pos((0, 0).into()), None);
    }

    #[test]
    fn validation_all() {
        let validation = Validation {
            id: Default::default(),
            selection: Selection::all(SheetId::test()),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        let mut validations = Validations::default();
        let reverse = validations.set(validation.clone());
        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.validations[0], validation);
        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::RemoveValidation {
                sheet_id: validation.selection.sheet_id,
                validation_id: validation.id
            }
        );
        assert_eq!(
            validations.display_sheet(),
            Some(ValidationDisplaySheet {
                columns: None,
                rows: None,
                all: Some(ValidationDisplay {
                    checkbox: true,
                    list: false
                })
            })
        );
        assert_eq!(
            validations.render_special_pos((0, 0).into()),
            Some(JsRenderCellSpecial::Checkbox)
        );
    }

    #[test]
    fn validation_columns() {
        let validation = Validation {
            id: Default::default(),
            selection: Selection::columns(&[0, 1, 2], SheetId::test()),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        let mut validations = Validations::default();
        let reverse = validations.set(validation.clone());
        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.validations[0], validation);
        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::RemoveValidation {
                sheet_id: validation.selection.sheet_id,
                validation_id: validation.id
            }
        );
        let display_sheet = validations.display_sheet().unwrap();
        assert_eq!(display_sheet.columns.as_ref().unwrap().len(), 3);
        assert_eq!(display_sheet.rows, None);
        assert_eq!(display_sheet.all, None);
        assert_eq!(
            display_sheet.columns.unwrap()[0].1,
            ValidationDisplay {
                checkbox: true,
                list: false
            }
        );
        assert_eq!(
            validations.render_special_pos((0, 0).into()),
            Some(JsRenderCellSpecial::Checkbox)
        );
    }

    #[test]
    fn validation_rows() {
        let validation = Validation {
            id: Default::default(),
            selection: Selection::rows(&[0, 1, 2], SheetId::test()),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: true,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        let mut validations = Validations::default();
        let reverse = validations.set(validation.clone());
        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.validations[0], validation);
        assert_eq!(reverse.len(), 1);
        assert_eq!(
            reverse[0],
            Operation::RemoveValidation {
                sheet_id: validation.selection.sheet_id,
                validation_id: validation.id
            }
        );
        let display_sheet = validations.display_sheet().unwrap();
        assert_eq!(display_sheet.rows.as_ref().unwrap().len(), 3);
        assert_eq!(display_sheet.columns, None);
        assert_eq!(display_sheet.all, None);
        assert_eq!(
            display_sheet.rows.unwrap()[0].1,
            ValidationDisplay {
                checkbox: true,
                list: false
            }
        );
        assert_eq!(
            validations.render_special_pos((0, 0).into()),
            Some(JsRenderCellSpecial::Checkbox)
        );
    }

    #[test]
    fn remove() {
        let mut validations = Validations::default();
        let v = create_validation_rect(0, 0, 1, 1);
        validations.set(v.clone());
        let v2 = create_validation_rect(2, 2, 3, 3);
        validations.set(v2.clone());
        assert_eq!(validations.validations().as_ref().unwrap().len(), 2);
        let reverse = validations.remove(v.id);
        assert_eq!(validations.validations().as_ref().unwrap().len(), 1);
        assert_eq!(reverse.len(), 1);
        assert_eq!(reverse[0], Operation::SetValidation { validation: v });
    }

    #[test]
    fn validation() {
        let mut validations = Validations::default();
        let v = create_validation_rect(0, 0, 1, 1);
        validations.set(v.clone());

        assert_eq!(validations.validation(v.id), Some(&v));
        assert_eq!(validations.validation(Uuid::new_v4()), None);

        assert_eq!(
            validations.validation_selection(v.selection.clone()),
            Some(&v)
        );
        assert_eq!(
            validations.validation_selection(Selection::all(SheetId::test())),
            None
        );
    }

    #[test]
    fn render_special_pos() {
        let mut validations = Validations::default();
        let v = create_validation_rect(0, 0, 1, 1);
        validations.set(v.clone());
        assert_eq!(
            validations.render_special_pos((0, 0).into()),
            Some(JsRenderCellSpecial::Checkbox)
        );
        assert_eq!(
            validations.render_special_pos((0, 0).into()),
            Some(JsRenderCellSpecial::Checkbox)
        );
        assert_eq!(validations.render_special_pos((2, 2).into()), None);
    }

    #[test]
    fn get_validation_from_pos() {
        let mut validations = Validations::default();
        let v = create_validation_rect(0, 0, 1, 1);
        validations.set(v.clone());
        assert_eq!(validations.get_validation_from_pos((0, 0).into()), Some(&v));
        assert_eq!(validations.get_validation_from_pos((2, 2).into()), None);
    }
}
