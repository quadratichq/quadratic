use std::cmp::Ordering;

use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::SheetId,
    A1Selection, Pos,
};

use super::{validation::Validation, Validations};

impl Validations {
    /// Removes a column from all validations and adds undo operations.
    ///
    /// Returns a list of A1Selections that have changed for render updates.
    pub(crate) fn remove_column(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        column: i64,
    ) -> Vec<A1Selection> {
        let mut changed_selections = Vec::new();
        let mut reverse_operations = Vec::new();

        self.validations.retain_mut(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.removed_column(column) {
                changed_selections.extend(transaction.validation_changed(
                    sheet_id,
                    validation,
                    Some(&original_selection),
                ));
                reverse_operations.push(Operation::SetValidation {
                    validation: Validation {
                        selection: original_selection,
                        ..validation.clone()
                    },
                });
                !validation.selection.ranges.is_empty()
            } else {
                true
            }
        });

        let mut warnings_to_delete = Vec::new();
        let mut warnings_to_move = Vec::new();
        for pos in self.warnings.keys() {
            match pos.x.cmp(&column) {
                Ordering::Less => (),
                Ordering::Equal => warnings_to_delete.push(*pos),
                Ordering::Greater => warnings_to_move.push(*pos),
            }
        }
        for pos in warnings_to_delete {
            if let Some(uuid) = self.warnings.remove(&pos) {
                transaction.validation_warning_deleted(sheet_id, pos);

                reverse_operations.push(Operation::SetValidationWarning {
                    sheet_pos: pos.to_sheet_pos(sheet_id),
                    validation_id: Some(uuid),
                });
            }
        }
        warnings_to_move.sort_unstable();
        for pos in warnings_to_move {
            if let Some(uuid) = self.warnings.remove(&pos) {
                transaction.validation_warning_deleted(sheet_id, pos);

                self.warnings.insert(
                    Pos {
                        x: pos.x - 1,
                        y: pos.y,
                    },
                    uuid,
                );
            }
        }

        transaction.reverse_operations.extend(reverse_operations);
        changed_selections
    }

    /// Removes a row from all validations and adds undo operations.
    ///
    /// Returns a list of A1Selections that have changed for render updates.
    pub(crate) fn remove_row(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        row: i64,
    ) -> Vec<A1Selection> {
        let mut changed_selections = Vec::new();
        let mut reverse_operations = Vec::new();

        self.validations.retain_mut(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.removed_row(row) {
                changed_selections.extend(transaction.validation_changed(
                    sheet_id,
                    validation,
                    Some(&original_selection),
                ));
                reverse_operations.push(Operation::SetValidation {
                    validation: Validation {
                        selection: original_selection,
                        ..validation.clone()
                    },
                });
                !validation.selection.ranges.is_empty()
            } else {
                true
            }
        });

        let mut warnings_to_delete = Vec::new();
        let mut warnings_to_move = Vec::new();
        for pos in self.warnings.keys() {
            match pos.y.cmp(&row) {
                Ordering::Less => (),
                Ordering::Equal => warnings_to_delete.push(*pos),
                Ordering::Greater => warnings_to_move.push(*pos),
            }
        }
        for pos in warnings_to_delete {
            if let Some(uuid) = self.warnings.remove(&pos) {
                transaction.validation_warning_deleted(sheet_id, pos);

                reverse_operations.push(Operation::SetValidationWarning {
                    sheet_pos: pos.to_sheet_pos(sheet_id),
                    validation_id: Some(uuid),
                });
            }
        }
        warnings_to_move.sort_unstable();
        for pos in warnings_to_move {
            if let Some(uuid) = self.warnings.remove(&pos) {
                transaction.validation_warning_deleted(sheet_id, pos);

                self.warnings.insert(
                    Pos {
                        x: pos.x,
                        y: pos.y - 1,
                    },
                    uuid,
                );
            }
        }

        transaction.reverse_operations.extend(reverse_operations);
        changed_selections
    }

    /// Inserts a column into all validations.
    ///
    /// Returns a list of A1Selections that have changed for render updates.
    pub(crate) fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        column: i64,
    ) -> Vec<A1Selection> {
        let mut changed_selections = Vec::new();

        self.validations.iter_mut().for_each(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.inserted_column(column) {
                changed_selections.extend(transaction.validation_changed(
                    sheet_id,
                    validation,
                    Some(&original_selection),
                ));
            }
        });

        let mut warnings_to_move = Vec::new();
        for pos in self.warnings.keys() {
            if pos.x >= column {
                warnings_to_move.push(*pos);
            }
        }
        warnings_to_move.sort_by(|a, b| b.x.cmp(&a.x));
        for pos in warnings_to_move {
            if let Some(uuid) = self.warnings.remove(&pos) {
                transaction.validation_warning_deleted(sheet_id, pos);

                self.warnings.insert(
                    Pos {
                        x: pos.x + 1,
                        y: pos.y,
                    },
                    uuid,
                );
            }
        }

        changed_selections
    }

    /// Inserts a row into all validations.
    ///
    /// Returns a list of A1Selections that have changed for render updates.
    pub(crate) fn insert_row(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        row: i64,
    ) -> Vec<A1Selection> {
        let mut changed_selections = Vec::new();

        self.validations.iter_mut().for_each(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.inserted_row(row) {
                changed_selections.extend(transaction.validation_changed(
                    sheet_id,
                    validation,
                    Some(&original_selection),
                ));
            }
        });

        let mut warnings_to_move = Vec::new();
        for pos in self.warnings.keys() {
            if pos.y >= row {
                warnings_to_move.push(*pos);
            }
        }
        warnings_to_move.sort_by(|a, b| b.y.cmp(&a.y));
        for pos in warnings_to_move {
            if let Some(uuid) = self.warnings.remove(&pos) {
                transaction.validation_warning_deleted(sheet_id, pos);

                self.warnings.insert(
                    Pos {
                        x: pos.x,
                        y: pos.y + 1,
                    },
                    uuid,
                );
            }
        }

        changed_selections
    }
}

#[cfg(test)]
mod tests {
    use serial_test::serial;
    use uuid::Uuid;

    use crate::{
        controller::{active_transactions::transaction_name::TransactionName, GridController},
        grid::sheet::validations::validation_rules::{
            validation_logical::ValidationLogical, ValidationRule,
        },
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_call_count},
        A1Selection, CellValue, CopyFormats,
    };

    use super::*;

    #[test]
    #[serial]
    fn test_remove_column() {
        clear_js_calls();

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![C1], CellValue::Text("test".to_string()));

        // rect and columns to be updated
        let validation_rect_columns = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:C3,A:C", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        // to be removed
        let validation_removed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("B2:B3,B", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:A1,A,5:10", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        gc.start_user_transaction(
            vec![
                Operation::SetValidation {
                    validation: validation_rect_columns.clone(),
                },
                Operation::SetValidation {
                    validation: validation_removed.clone(),
                },
                Operation::SetValidation {
                    validation: validation_not_changed.clone(),
                },
            ],
            None,
            TransactionName::Validation,
        );

        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 3);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C3]),
            Some(&validation_rect_columns.id)
        );
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    validation_rect_columns.clone(),
                    validation_removed.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);

        // remove column 2
        gc.start_user_transaction(
            vec![Operation::DeleteColumn {
                sheet_id,
                column: 2,
            }],
            None,
            TransactionName::Validation,
        );

        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 2);
        let new_validation_rect_column = Validation {
            selection: A1Selection::test_a1_sheet_id("A1:B3,A:B", &sheet_id),
            ..validation_rect_columns.clone()
        };
        assert_eq!(sheet.validations.validations[0], new_validation_rect_column);
        assert_eq!(sheet.validations.validations[1], validation_not_changed);
        assert_eq!(
            sheet.validations.warnings.get(&pos![B3]),
            Some(&validation_rect_columns.id)
        );
        assert!(!sheet.validations.warnings.contains_key(&pos![C3]));
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    new_validation_rect_column.clone(),
                    validation_not_changed.clone(),
                ])
                .unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);

        gc.undo(None);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 3);
        assert_eq!(sheet.validations.validations[0], validation_rect_columns);
        assert_eq!(sheet.validations.validations[1], validation_not_changed);
        assert_eq!(sheet.validations.validations[2], validation_removed);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C3]),
            Some(&validation_rect_columns.id)
        );
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    validation_rect_columns,
                    validation_not_changed,
                    validation_removed,
                ])
                .unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);

        gc.undo(None);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 0);
        assert!(sheet.validations.warnings.is_empty());
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);
    }

    #[test]
    #[serial]
    fn test_remove_row() {
        clear_js_calls();

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![C3], CellValue::Text("test".to_string()));

        // rect and rows to be updated
        let validation_rect_rows = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:C3,1:3", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        // to be removed
        let validation_removed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A2:C2,2", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:A1,A1:D1,1", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        gc.start_user_transaction(
            vec![
                Operation::SetValidation {
                    validation: validation_rect_rows.clone(),
                },
                Operation::SetValidation {
                    validation: validation_removed.clone(),
                },
                Operation::SetValidation {
                    validation: validation_not_changed.clone(),
                },
            ],
            None,
            TransactionName::Validation,
        );

        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 3);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C3]),
            Some(&validation_rect_rows.id)
        );
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    validation_rect_rows.clone(),
                    validation_removed.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);

        // remove row 2
        gc.start_user_transaction(
            vec![Operation::DeleteRow { sheet_id, row: 2 }],
            None,
            TransactionName::Validation,
        );

        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 2);
        let new_validation_rect_row = Validation {
            selection: A1Selection::test_a1_sheet_id("A1:C2,1:2", &sheet_id),
            ..validation_rect_rows.clone()
        };
        assert_eq!(sheet.validations.validations[0], new_validation_rect_row);
        assert_eq!(sheet.validations.validations[1], validation_not_changed);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C2]),
            Some(&validation_rect_rows.id)
        );
        assert!(!sheet.validations.warnings.contains_key(&pos![C3]));
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    new_validation_rect_row.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);

        gc.undo(None);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 3);
        assert_eq!(sheet.validations.validations[0], validation_rect_rows);
        assert_eq!(sheet.validations.validations[1], validation_not_changed);
        assert_eq!(sheet.validations.validations[2], validation_removed);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C3]),
            Some(&validation_rect_rows.id)
        );
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    validation_rect_rows,
                    validation_not_changed,
                    validation_removed,
                ])
                .unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);

        gc.undo(None);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 0);
        assert!(sheet.validations.warnings.is_empty());
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);
    }

    #[test]
    #[serial]
    fn inserted_column() {
        clear_js_calls();

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![C3], CellValue::Text("test".to_string()));

        // rect and rows to be updated
        let validation_rect_cols = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:C3,A,B,C", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:A1,A", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        gc.start_user_transaction(
            vec![
                Operation::SetValidation {
                    validation: validation_rect_cols.clone(),
                },
                Operation::SetValidation {
                    validation: validation_not_changed.clone(),
                },
            ],
            None,
            TransactionName::Validation,
        );

        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 2);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C3]),
            Some(&validation_rect_cols.id)
        );
        assert!(!sheet.validations.warnings.contains_key(&pos![D3]));
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    validation_rect_cols.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            true,
        );

        // insert column 2
        gc.start_user_transaction(
            vec![Operation::InsertColumn {
                sheet_id,
                column: 2,
                copy_formats: CopyFormats::None,
            }],
            None,
            TransactionName::Validation,
        );
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 2);
        let new_validation_rect_col = Validation {
            selection: A1Selection::test_a1_sheet_id("A1:D3,A,C,D", &sheet_id),
            ..validation_rect_cols.clone()
        };
        assert_eq!(sheet.validations.validations[0], new_validation_rect_col);
        assert_eq!(sheet.validations.validations[1], validation_not_changed);
        assert_eq!(
            sheet.validations.warnings.get(&pos![D3]),
            Some(&validation_rect_cols.id)
        );
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    new_validation_rect_col.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            true,
        );

        gc.undo(None);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 2);
        assert_eq!(sheet.validations.validations[0], validation_rect_cols);
        assert_eq!(sheet.validations.validations[1], validation_not_changed);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C3]),
            Some(&validation_rect_cols.id)
        );
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    validation_rect_cols.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            true,
        );

        gc.undo(None);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 0);
        assert!(sheet.validations.warnings.is_empty());
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);
    }

    #[test]
    #[serial]
    fn inserted_row() {
        clear_js_calls();

        let mut gc = GridController::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_value(pos![C3], CellValue::Text("test".to_string()));

        // rect and columns to be updated
        let validation_rect_rows = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:C3,1,2,3", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1_sheet_id("A1:A1,1", &sheet_id),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };

        gc.start_user_transaction(
            vec![
                Operation::SetValidation {
                    validation: validation_rect_rows.clone(),
                },
                Operation::SetValidation {
                    validation: validation_not_changed.clone(),
                },
            ],
            None,
            TransactionName::Validation,
        );

        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 2);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C3]),
            Some(&validation_rect_rows.id)
        );
        assert!(!sheet.validations.warnings.contains_key(&pos![C4]));
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    validation_rect_rows.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);

        // insert row 2
        gc.start_user_transaction(
            vec![Operation::InsertRow {
                sheet_id,
                row: 2,
                copy_formats: CopyFormats::None,
            }],
            None,
            TransactionName::Validation,
        );
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 2);
        let new_validation_rect_row = Validation {
            selection: A1Selection::test_a1_sheet_id("A1:C4,1,3,4", &sheet_id),
            ..validation_rect_rows.clone()
        };
        assert_eq!(sheet.validations.validations[0], new_validation_rect_row);
        assert_eq!(sheet.validations.validations[1], validation_not_changed);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C4]),
            Some(&validation_rect_rows.id)
        );
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    new_validation_rect_row.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            true,
        );

        gc.undo(None);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 2);
        assert_eq!(sheet.validations.validations[0], validation_rect_rows);
        assert_eq!(sheet.validations.validations[1], validation_not_changed);
        assert_eq!(
            sheet.validations.warnings.get(&pos![C3]),
            Some(&validation_rect_rows.id)
        );
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&vec![
                    validation_rect_rows.clone(),
                    validation_not_changed.clone()
                ])
                .unwrap()
            ),
            true,
        );

        gc.undo(None);
        let sheet = gc.sheet_mut(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 0);
        assert!(sheet.validations.warnings.is_empty());
        expect_js_call(
            "jsSheetValidations",
            format!(
                "{},{}",
                sheet_id,
                serde_json::to_string(&Vec::<Validation>::new()).unwrap()
            ),
            false,
        );
        expect_js_call_count("jsValidationWarning", 1, true);
    }
}
