//! Data Validations for a Sheet.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validation::{Validation, ValidationDisplay, ValidationDisplaySheet};

use crate::{
    a1::{A1Context, A1Selection},
    controller::operations::operation::Operation,
    grid::js_types::JsRenderCellSpecial,
    Pos, Rect,
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
    pub fn validation_selection(&self, selection: A1Selection) -> Option<&Validation> {
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
    pub fn render_special_pos(&self, pos: Pos, context: &A1Context) -> Option<JsRenderCellSpecial> {
        let mut checkbox = false;
        let mut list = false;
        for v in &self.validations {
            if v.selection.might_contain_pos(pos, context) {
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
        let mut displays = vec![];
        for v in &self.validations {
            if !v.rule.has_ui() {
                continue;
            }
            v.selection.ranges.iter().for_each(|range| {
                if !range.is_finite() {
                    displays.push(ValidationDisplay {
                        range: range.clone(),
                        checkbox: v.rule.is_logical(),
                        list: v.rule.is_list(),
                    });
                }
            });
        }
        Some(ValidationDisplaySheet { displays })
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
    pub fn validate(&self, sheet: &Sheet, pos: Pos, context: &A1Context) -> Option<&Validation> {
        self.validations.iter().rev().find(|v| {
            v.selection.might_contain_pos(pos, context)
                && !v.rule.validate(sheet, sheet.cell_value_ref(pos))
        })
    }

    /// Returns validations that intersect with a rect.
    pub fn in_rect(&self, rect: Rect, context: &A1Context) -> Vec<&Validation> {
        self.validations
            .iter()
            .filter(|validation| {
                validation
                    .selection
                    .ranges
                    .iter()
                    .any(|range| range.is_finite() && range.might_intersect_rect(rect, context))
            })
            .collect()
    }

    /// Gets a validation from a position
    pub fn get_validation_from_pos(&self, pos: Pos, context: &A1Context) -> Option<&Validation> {
        self.validations
            .iter()
            .find(|v| v.selection.might_contain_pos(pos, context))
    }
}

#[cfg(test)]
mod tests {
    use validation_rules::{validation_logical::ValidationLogical, ValidationRule};

    use crate::{a1::CellRefRange, grid::SheetId, SheetRect};

    use super::*;

    fn create_validation_rect(x0: i64, y0: i64, x1: i64, y1: i64) -> Validation {
        Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::from_rect(SheetRect::new(x0, y0, x1, y1, SheetId::test())),
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
        let context = A1Context::default();
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
            validations.render_special_pos((0, 0).into(), &context),
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
        assert_eq!(
            validations.render_special_pos((0, 0).into(), &context),
            None
        );
    }

    #[test]
    fn test_validation_all() {
        let validation = Validation {
            id: Default::default(),
            selection: A1Selection::test_a1("*"),
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
                displays: vec![ValidationDisplay {
                    range: CellRefRange::test_a1("*"),
                    checkbox: true,
                    list: false
                }]
            })
        );
        assert_eq!(
            validations.render_special_pos(pos![A1], &A1Context::default()),
            Some(JsRenderCellSpecial::Checkbox)
        );
    }

    #[test]
    fn validation_columns() {
        let validation = Validation {
            id: Default::default(),
            selection: A1Selection::test_a1("A,B,C"),
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
        assert_eq!(display_sheet.displays.len(), 3);
        assert_eq!(
            display_sheet.displays,
            vec![
                ValidationDisplay {
                    range: CellRefRange::test_a1("A"),
                    checkbox: true,
                    list: false
                },
                ValidationDisplay {
                    range: CellRefRange::test_a1("B"),
                    checkbox: true,
                    list: false
                },
                ValidationDisplay {
                    range: CellRefRange::test_a1("C"),
                    checkbox: true,
                    list: false
                }
            ]
        );
        assert_eq!(
            validations.render_special_pos((1, 1).into(), &A1Context::default()),
            Some(JsRenderCellSpecial::Checkbox)
        );
    }

    #[test]
    fn validation_rows() {
        let validation = Validation {
            id: Default::default(),
            selection: A1Selection::test_a1("1,2,3"),
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
        assert_eq!(display_sheet.displays.len(), 3);
        assert_eq!(
            display_sheet.displays,
            vec![
                ValidationDisplay {
                    range: CellRefRange::test_a1("1"),
                    checkbox: true,
                    list: false
                },
                ValidationDisplay {
                    range: CellRefRange::test_a1("2"),
                    checkbox: true,
                    list: false
                },
                ValidationDisplay {
                    range: CellRefRange::test_a1("3"),
                    checkbox: true,
                    list: false
                }
            ]
        );
        assert_eq!(
            validations.render_special_pos((1, 1).into(), &A1Context::default()),
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
            validations.validation_selection(A1Selection::test_a1("*")),
            None
        );
    }

    #[test]
    fn render_special_pos() {
        let context = A1Context::default();
        let mut validations = Validations::default();
        let v = create_validation_rect(0, 0, 1, 1);
        validations.set(v.clone());
        assert_eq!(
            validations.render_special_pos((0, 0).into(), &context),
            Some(JsRenderCellSpecial::Checkbox)
        );
        assert_eq!(
            validations.render_special_pos((0, 0).into(), &context),
            Some(JsRenderCellSpecial::Checkbox)
        );
        assert_eq!(
            validations.render_special_pos((2, 2).into(), &context),
            None
        );
    }

    #[test]
    fn get_validation_from_pos() {
        let context = A1Context::default();
        let mut validations = Validations::default();
        let v = create_validation_rect(0, 0, 1, 1);
        validations.set(v.clone());
        assert_eq!(
            validations.get_validation_from_pos((0, 0).into(), &context),
            Some(&v)
        );
        assert_eq!(
            validations.get_validation_from_pos((2, 2).into(), &context),
            None
        );
    }
}
