use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::SheetId,
};

use super::{validation::Validation, Validations};

impl Validations {
    /// Removes a column from all validations. Adds undo operations and client
    /// signalling to the transaction.
    pub fn remove_column(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        column: i64,
    ) {
        let mut reverse_operations = Vec::new();

        self.validations.retain_mut(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.removed_column(column) {
                transaction.validation_changed(sheet_id, validation, Some(&original_selection));
                reverse_operations.push(Operation::SetValidation {
                    validation: Validation {
                        selection: original_selection,
                        ..validation.clone()
                    },
                });
                !validation.selection.is_empty()
            } else {
                true
            }
        });

        transaction.reverse_operations.extend(reverse_operations);
    }

    /// Removes a row from all validations.
    ///
    /// Returns a list of operations that reverse the changes.
    pub fn remove_row(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        row: i64,
    ) {
        let mut reverse_operations = Vec::new();

        self.validations.retain_mut(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.removed_row(row) {
                transaction.validation_changed(sheet_id, validation, Some(&original_selection));
                reverse_operations.push(Operation::SetValidation {
                    validation: Validation {
                        selection: original_selection,
                        ..validation.clone()
                    },
                });
                !validation.selection.is_empty()
            } else {
                true
            }
        });

        transaction.reverse_operations.extend(reverse_operations);
    }

    /// Inserts a column into all validations.
    ///
    /// Returns a list of operations that reverse the changes.
    pub fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        column: i64,
    ) {
        let mut reverse_operations = Vec::new();

        self.validations.iter_mut().for_each(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.inserted_column(column) {
                transaction.validation_changed(sheet_id, validation, Some(&original_selection));
                reverse_operations.push(Operation::SetValidation {
                    validation: Validation {
                        selection: original_selection,
                        ..validation.clone()
                    },
                });
            }
        });

        transaction.reverse_operations.extend(reverse_operations);
    }

    /// Inserts a row into all validations.
    ///
    /// Returns a list of operations that reverse the changes.
    pub fn insert_row(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        row: i64,
    ) {
        let mut reverse_operations = Vec::new();

        self.validations.iter_mut().for_each(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.inserted_row(row) {
                transaction.validation_changed(sheet_id, validation, Some(&original_selection));
                reverse_operations.push(Operation::SetValidation {
                    validation: Validation {
                        selection: original_selection,
                        ..validation.clone()
                    },
                });
            }
        });

        transaction.reverse_operations.extend(reverse_operations);
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;
    use uuid::Uuid;

    use crate::{
        grid::sheet::validations::validation_rules::{
            validation_logical::ValidationLogical, ValidationRule,
        },
        selection::Selection,
        Rect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn remove_column() {
        let mut validations = Validations::default();

        // rect and columns to be updated
        let validation_rect_columns = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                columns: Some(vec![1, 2, 3]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_rect_columns.clone());

        // to be removed
        let validation_removed = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(2, 2, 1, 1)]),
                columns: Some(vec![2]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_removed.clone());

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(-10, -10, 1, 1)]),
                columns: Some(vec![-10]),
                rows: Some(vec![1, 2, 3, 4]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_not_changed.clone());

        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::test();

        // remove column 2
        validations.remove_column(&mut transaction, sheet_id, 2);
        assert_eq!(transaction.reverse_operations.len(), 2);

        assert_eq!(validations.validations.len(), 2);

        assert_eq!(
            validations.validations[0],
            Validation {
                selection: Selection {
                    rects: Some(vec![Rect::new(1, 1, 2, 3)]),
                    columns: Some(vec![1, 2]),
                    ..validation_rect_columns.selection
                },
                ..validation_rect_columns
            }
        );
        assert_eq!(validations.validations[1], validation_not_changed);
    }

    #[test]
    #[parallel]
    fn remove_row() {
        let mut validations = Validations::default();

        // rect and columns to be updated
        let validation_rect_rows = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                rows: Some(vec![1, 2, 3]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_rect_rows.clone());

        // to be removed
        let validation_removed = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(2, 2, 1, 1)]),
                rows: Some(vec![2]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_removed.clone());

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(-10, -10, 1, 1)]),
                columns: Some(vec![1, 2, 3, 4]),
                rows: Some(vec![-10]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_not_changed.clone());

        // remove row 2
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::test();
        validations.remove_row(&mut transaction, sheet_id, 2);
        assert_eq!(transaction.reverse_operations.len(), 2);

        assert_eq!(validations.validations.len(), 2);

        assert_eq!(
            validations.validations[0],
            Validation {
                selection: Selection {
                    rects: Some(vec![Rect::new(1, 1, 3, 2)]),
                    rows: Some(vec![1, 2]),
                    ..validation_rect_rows.selection
                },
                ..validation_rect_rows
            }
        );
        assert_eq!(validations.validations[1], validation_not_changed);
    }

    #[test]
    #[parallel]
    fn inserted_column() {
        let mut validations = Validations::default();

        // rect and rows to be updated
        let validation_rect_cols = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                columns: Some(vec![1, 2, 3]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_rect_cols.clone());

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(-10, -10, 1, 1)]),
                columns: Some(vec![-10]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_not_changed.clone());

        // insert column 2
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::test();
        validations.insert_column(&mut transaction, sheet_id, 2);
        assert_eq!(transaction.reverse_operations.len(), 1);

        assert_eq!(validations.validations.len(), 2);

        assert_eq!(
            validations.validations[0],
            Validation {
                selection: Selection {
                    rects: Some(vec![Rect::new(1, 1, 4, 3)]),
                    columns: Some(vec![1, 3, 4]),
                    ..validation_rect_cols.selection
                },
                ..validation_rect_cols
            }
        );
        assert_eq!(validations.validations[1], validation_not_changed);
    }

    #[test]
    #[parallel]
    fn inserted_row() {
        let mut validations = Validations::default();

        // rect and columns to be updated
        let validation_rect_rows = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                rows: Some(vec![1, 2, 3]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_rect_rows.clone());

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: Selection {
                rects: Some(vec![Rect::new(-10, -10, 1, 1)]),
                rows: Some(vec![-10]),
                ..Default::default()
            },
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_not_changed.clone());

        // insert row 2
        let mut transaction = PendingTransaction::default();
        let sheet_id = SheetId::test();
        validations.insert_row(&mut transaction, sheet_id, 2);
        assert_eq!(transaction.reverse_operations.len(), 1);

        assert_eq!(validations.validations.len(), 2);

        assert_eq!(
            validations.validations[0],
            Validation {
                selection: Selection {
                    rects: Some(vec![Rect::new(1, 1, 3, 4)]),
                    rows: Some(vec![1, 3, 4]),
                    ..validation_rect_rows.selection
                },
                ..validation_rect_rows
            }
        );
        assert_eq!(validations.validations[1], validation_not_changed);
    }
}
