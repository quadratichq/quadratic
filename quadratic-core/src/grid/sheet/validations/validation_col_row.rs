use crate::{
    a1::A1Selection,
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
    pub(crate) fn remove_column(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        column: i64,
    ) -> Vec<A1Selection> {
        let mut reverse_operations = Vec::new();
        let mut changed_selections = vec![];
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

        transaction.reverse_operations.extend(reverse_operations);
        changed_selections
    }

    /// Removes a row from all validations.
    ///
    /// Returns a list of operations that reverse the changes.
    pub(crate) fn remove_row(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        row: i64,
    ) -> Vec<A1Selection> {
        let mut changed_selections = vec![];
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
        transaction.reverse_operations.extend(reverse_operations);
        changed_selections
    }

    /// Inserts a column into all validations.
    ///
    /// Returns a list of operations that reverse the changes.
    pub(crate) fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        column: i64,
    ) -> Vec<A1Selection> {
        let mut changed_selections = vec![];
        let mut reverse_operations = Vec::new();

        self.validations.iter_mut().for_each(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.inserted_column(column) {
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
            }
        });

        transaction.reverse_operations.extend(reverse_operations);
        changed_selections
    }

    /// Inserts a row into all validations.
    ///
    /// Returns a list of operations that reverse the changes.
    pub(crate) fn insert_row(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        row: i64,
    ) -> Vec<A1Selection> {
        let mut changed_selections = vec![];
        let mut reverse_operations = Vec::new();

        self.validations.iter_mut().for_each(|validation| {
            let original_selection = validation.selection.clone();
            if validation.selection.inserted_row(row) {
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
            }
        });

        transaction.reverse_operations.extend(reverse_operations);
        changed_selections
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use uuid::Uuid;

    use crate::{
        a1::A1Selection,
        grid::sheet::validations::validation_rules::{
            validation_logical::ValidationLogical, ValidationRule,
        },
    };

    use super::*;

    #[test]
    fn test_remove_column() {
        let mut validations = Validations::default();

        // rect and columns to be updated
        let validation_rect_columns = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:C3,A:C"),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_rect_columns.clone());

        // to be removed
        let validation_removed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("B2:B3,B"),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_removed.clone());

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:A1,A,5:10"),
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

        let selection = A1Selection::test_a1("A1:B3,A:B");
        assert_eq!(
            validations.validations[0],
            Validation {
                selection,
                ..validation_rect_columns
            }
        );
        assert_eq!(validations.validations[1], validation_not_changed);
    }

    #[test]
    fn test_remove_row() {
        let mut validations = Validations::default();

        // rect and columns to be updated
        let validation_rect_rows = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:C3,1:3"),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_rect_rows.clone());

        // to be removed
        let validation_removed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A2:C2,2"),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_removed.clone());

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:A1,A1:D1,1"),
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
                selection: A1Selection::test_a1("A1:C2,1:2"),
                ..validation_rect_rows
            }
        );
        assert_eq!(validations.validations[1], validation_not_changed);
    }

    #[test]
    fn inserted_column() {
        let mut validations = Validations::default();

        // rect and rows to be updated
        let validation_rect_cols = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:C3,A,B,C"),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_rect_cols.clone());

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:A1,A"),
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
                selection: A1Selection::test_a1("A1:D3,A,C,D"),
                ..validation_rect_cols
            }
        );
        assert_eq!(validations.validations[1], validation_not_changed);
    }

    #[test]
    fn inserted_row() {
        let mut validations = Validations::default();

        // rect and columns to be updated
        let validation_rect_rows = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:C3,1,2,3"),
            rule: ValidationRule::Logical(ValidationLogical::default()),
            message: Default::default(),
            error: Default::default(),
        };
        validations.set(validation_rect_rows.clone());

        // nothing to do with this one
        let validation_not_changed = Validation {
            id: Uuid::new_v4(),
            selection: A1Selection::test_a1("A1:A1,1"),
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
                selection: A1Selection::test_a1("A1:C4,1,3,4"),
                ..validation_rect_rows
            }
        );
        assert_eq!(validations.validations[1], validation_not_changed);
    }
}
