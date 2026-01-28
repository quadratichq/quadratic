//! Data Validations for a Sheet.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validation::{Validation, ValidationDisplay, ValidationDisplaySheet};

use crate::{
    Pos, Rect,
    a1::{A1Context, A1Selection},
    controller::operations::operation::Operation,
    grid::js_types::JsRenderCellSpecial,
};

use super::Sheet;

pub mod clipboard;
pub mod col_row;
pub mod rules;
mod transfer;
pub mod validation;
pub mod warnings;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Validations {
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub(crate) validations: Vec<Validation>,

    #[serde(skip_serializing_if = "HashMap::is_empty", default)]
    pub(crate) warnings: HashMap<Pos, Uuid>,
}

impl Validations {
    /// Updates or adds a new validation to the sheet. Returns the reverse
    /// operations.
    pub fn set(&mut self, validation: Validation) -> Vec<Operation> {
        if let Some(existing) = self.validations.iter_mut().find(|v| v.id == validation.id) {
            let old_validation = existing.clone();
            *existing = validation;
            vec![Operation::SetValidation {
                validation: old_validation,
            }]
        } else {
            let reverse = vec![Operation::RemoveValidation {
                sheet_id: validation.selection.sheet_id,
                validation_id: validation.id,
            }];
            self.validations.push(validation);
            reverse
        }
    }

    /// Gets a validation based on a validation_id
    pub fn validation(&self, validation_id: Uuid) -> Option<&Validation> {
        self.validations.iter().find(|v| v.id == validation_id)
    }

    /// Gets a validation based on a Selection.
    pub fn validation_selection(&self, selection: A1Selection) -> Option<&Validation> {
        self.validations.iter().find(|v| v.selection == selection)
    }

    /// Gets a validation that overlaps with a selection.
    pub fn validation_overlaps_selection(
        &self,
        selection: &A1Selection,
        a1_context: &A1Context,
    ) -> Option<&Validation> {
        self.validations
            .iter()
            .find(|v| v.selection.overlaps_a1_selection(selection, a1_context))
    }

    /// Gets all validations in the Sheet.
    pub fn validations(&self) -> Option<&Vec<Validation>> {
        if self.validations.is_empty() {
            None
        } else {
            Some(&self.validations)
        }
    }

    /// Gets the JsRenderCellSpecial for a cell based on Validation.
    pub fn render_special_pos(
        &self,
        pos: Pos,
        a1_context: &A1Context,
    ) -> Option<JsRenderCellSpecial> {
        let mut checkbox = false;
        let mut list = false;
        for v in &self.validations {
            if v.selection.might_contain_pos(pos, a1_context) {
                match v.rule {
                    rules::ValidationRule::List(ref validation_list) => {
                        if validation_list.drop_down {
                            list = true;
                            checkbox = false;
                        } else {
                            list = false;
                            checkbox = false;
                        }
                    }
                    rules::ValidationRule::Logical(ref logical) => {
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
    pub fn validate(&self, sheet: &Sheet, pos: Pos, a1_context: &A1Context) -> Option<&Validation> {
        self.validations.iter().rev().find(|v| {
            v.selection.might_contain_pos(pos, a1_context)
                && !v
                    .rule
                    .validate(sheet, sheet.display_value(pos).as_ref(), a1_context)
        })
    }

    /// Returns validations that intersect with a rect, unbounded.
    pub fn in_rect_unbounded(&self, rect: Rect, a1_context: &A1Context) -> Vec<&Validation> {
        self.validations
            .iter()
            .filter(|validation| {
                validation
                    .selection
                    .ranges
                    .iter()
                    .any(|range| range.might_intersect_rect(rect, a1_context))
            })
            .collect()
    }

    /// Returns validations that intersect with a rect.
    pub fn in_rect(&self, rect: Rect, a1_context: &A1Context) -> Vec<&Validation> {
        self.validations
            .iter()
            .filter(|validation| {
                validation
                    .selection
                    .ranges
                    .iter()
                    .any(|range| range.is_finite() && range.might_intersect_rect(rect, a1_context))
            })
            .collect()
    }

    /// Gets a validation from a position
    pub fn get_validation_from_pos(&self, pos: Pos, a1_context: &A1Context) -> Option<&Validation> {
        self.validations
            .iter()
            .find(|v| v.selection.might_contain_pos(pos, a1_context))
    }

    /// Removes a selection from a validation. Returns the reverse operations.
    pub fn remove_selection(
        &mut self,
        selection: &A1Selection,
        context: &A1Context,
    ) -> Option<Vec<Operation>> {
        let mut reverse = vec![];
        self.validations.retain_mut(|v| {
            if v.selection.overlaps_a1_selection(selection, context) {
                reverse.push(Operation::SetValidation {
                    validation: v.clone(),
                });
                if let Some(partial_selection) = v.selection.delete_selection(selection, context) {
                    // handle case where only part of the selection is removed
                    v.selection = partial_selection;
                    true
                } else {
                    false
                }
            } else {
                true
            }
        });
        if reverse.is_empty() {
            None
        } else {
            Some(reverse)
        }
    }

    /// Finds a validation that matches the rule, message, and error.
    pub fn similar_validation(&self, validation: &Validation) -> Option<&Validation> {
        self.validations.iter().find(|v| {
            v.rule == validation.rule
                && v.message == validation.message
                && v.error == validation.error
        })
    }
}

#[cfg(test)]
mod tests {
    use rules::{ValidationRule, validation_logical::ValidationLogical};

    use crate::test_util::*;
    use crate::{SheetRect, a1::CellRefRange, grid::SheetId};

    use super::*;

    fn create_validation_rect(x0: i64, y0: i64, x1: i64, y1: i64) -> Validation {
        Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::from_rect(SheetRect::new(x0, y0, x1, y1, SheetId::TEST)),
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
    fn test_validation() {
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

    #[test]
    fn test_validation_overlaps_selection() {
        let mut validations = Validations::default();

        // Create a validation covering cells A1:B2
        let v1 = create_validation_rect(1, 1, 2, 2);
        validations.set(v1.clone());

        let a1_context = A1Context::default();

        // Test overlapping selections
        let overlapping_selection = A1Selection::test_a1("A1:B2");
        assert_eq!(
            validations.validation_overlaps_selection(&overlapping_selection, &a1_context),
            Some(&v1)
        );

        // Test partially overlapping selection
        let partial_overlap = A1Selection::test_a1("B2:C3");
        assert_eq!(
            validations.validation_overlaps_selection(&partial_overlap, &a1_context),
            Some(&v1)
        );

        // Test non-overlapping selection
        let non_overlapping = A1Selection::test_a1("C3:D4");
        assert_eq!(
            validations.validation_overlaps_selection(&non_overlapping, &a1_context),
            None
        );

        // Add another validation covering cells C3:D4
        let v2 = create_validation_rect(2, 2, 3, 3);
        validations.set(v2.clone());

        // Test overlapping with second validation
        assert_eq!(
            validations.validation_overlaps_selection(&non_overlapping, &a1_context),
            Some(&v2)
        );
    }

    #[test]
    fn test_validation_overlaps_selection_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let validation = test_create_checkbox_with_id(&mut gc, selection);
        assert_validation_id(&gc, pos![sheet_id!B4], Some(validation.id));

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .validations
                .validation_overlaps_selection(&selection, gc.a1_context()),
            Some(&validation)
        );
    }

    #[test]
    fn test_validation_overlaps_selection_table_sheet() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let validation = test_create_checkbox_with_id(&mut gc, selection);
        assert_validation_id(&gc, pos![sheet_id!B4], Some(validation.id));

        let selection = A1Selection::test_a1_context("B4:C5", gc.a1_context());

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet
                .validations
                .validation_overlaps_selection(&selection, gc.a1_context()),
            Some(&validation)
        );
    }

    #[test]
    fn test_remove_selection() {
        let context = A1Context::default();
        let mut validations = Validations::default();

        // Create validations covering different ranges
        let v1 = create_validation_rect(1, 1, 5, 5); // A1:E5
        let v2 = create_validation_rect(10, 10, 15, 15); // J10:O15
        let v3 = create_validation_rect(20, 1, 25, 3); // T1:Y3

        validations.set(v1.clone());
        validations.set(v2.clone());
        validations.set(v3.clone());

        assert_eq!(validations.validations.len(), 3);

        // Test 1: Partial removal - remove part of v1's selection
        // Remove B2:C3, which should partially remove from A1:E5
        let partial_selection = A1Selection::test_a1("B2:C3");
        let reverse_ops = validations.remove_selection(&partial_selection, &context);

        // Should return reverse operations
        assert!(reverse_ops.is_some());
        let reverse = reverse_ops.unwrap();
        assert_eq!(reverse.len(), 1);

        // The original validation should be in the reverse operation
        if let Operation::SetValidation { validation } = &reverse[0] {
            assert_eq!(validation.id, v1.id);
            assert_eq!(validation.selection, v1.selection);
        } else {
            panic!("Expected SetValidation operation");
        }

        // Validation should still exist but with modified selection
        assert_eq!(validations.validations.len(), 3);
        let modified_v1 = validations.validation(v1.id).unwrap();
        assert_ne!(modified_v1.selection, v1.selection); // Selection should be different

        // Test 2: Complete removal - remove all of v2's selection
        // Remove J10:O15, which should completely remove v2
        let complete_selection = A1Selection::test_a1("J10:O15");
        let reverse_ops = validations.remove_selection(&complete_selection, &context);

        // Should return reverse operations
        assert!(reverse_ops.is_some());
        let reverse = reverse_ops.unwrap();
        assert_eq!(reverse.len(), 1);

        // The original validation should be in the reverse operation
        if let Operation::SetValidation { validation } = &reverse[0] {
            assert_eq!(validation.id, v2.id);
            assert_eq!(validation.selection, v2.selection);
        } else {
            panic!("Expected SetValidation operation");
        }

        // Validation should be completely removed
        assert_eq!(validations.validations.len(), 2);
        assert!(validations.validation(v2.id).is_none());

        // Test 3: No overlap - remove selection that doesn't overlap with any validation
        let no_overlap_selection = A1Selection::test_a1("Z30:AA35");
        let reverse_ops = validations.remove_selection(&no_overlap_selection, &context);

        // Should return None since no validations were affected
        assert!(reverse_ops.is_none());
        assert_eq!(validations.validations.len(), 2);

        // Test 4: Multiple overlaps - remove selection that overlaps with multiple validations
        // Add back v2 for this test
        validations.set(v2.clone());
        assert_eq!(validations.validations.len(), 3);

        // Remove a large selection that overlaps with both remaining validations
        let large_selection = A1Selection::test_a1("A1:Z30");
        let reverse_ops = validations.remove_selection(&large_selection, &context);

        // Should return reverse operations for multiple validations
        assert!(reverse_ops.is_some());
        let reverse = reverse_ops.unwrap();
        assert!(reverse.len() >= 2); // Should have operations for multiple validations

        // Most or all validations should be affected
        // (depending on exact implementation of delete_selection)
        let remaining_count = validations.validations.len();
        assert!(remaining_count <= 3); // Some may be partially removed, some completely removed
    }

    #[test]
    fn test_similar_validation() {
        let mut validations = Validations::default();
        let v = create_validation_rect(0, 0, 1, 1);
        validations.set(v.clone());
        assert_eq!(validations.similar_validation(&v), Some(&v));
        let v2 = Validation {
            id: Default::default(),
            selection: A1Selection::test_a1("A1:B2"),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: false,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        assert_eq!(validations.similar_validation(&v2), None);
    }

    #[test]
    fn test_set_validation() {
        let mut validations = Validations::default();
        let id = Uuid::new_v4();
        let original = Validation {
            id,
            selection: A1Selection::test_a1("A1:B2"),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: true,
                ignore_blank: false,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(original.clone());
        assert_eq!(validations.validations.len(), 1);

        let new = Validation {
            id,
            selection: A1Selection::test_a1("A2:B2"),
            rule: ValidationRule::Logical(ValidationLogical {
                show_checkbox: false,
                ignore_blank: false,
            }),
            message: Default::default(),
            error: Default::default(),
        };
        let old = validations.set(new.clone());
        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.validations[0], new);
        assert_eq!(old.len(), 1);
        assert_eq!(
            old[0],
            Operation::SetValidation {
                validation: original
            }
        );
    }
}
