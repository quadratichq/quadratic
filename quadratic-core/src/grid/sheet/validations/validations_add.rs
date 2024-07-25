use uuid::Uuid;

use crate::{
    controller::operations::operation::Operation, grid::SheetId, selection::Selection, Pos, Rect,
};

use super::{validation::Validation, Validations};

impl Validations {
    /// Cleans up validations that are no longer needed.
    fn cleanup(&mut self, sheet_id: SheetId) -> Vec<Operation> {
        let mut reverse = vec![];
        self.validations.retain(|id, validation| {
            let found = self.cell_validations.values().any(|v| v == id)
                || self.column_validations.values().any(|v| v == id)
                || self.row_validations.values().any(|v| v == id)
                || self.all == Some(*id);

            if !found {
                // if validation is not used, then remove it
                reverse.push(Operation::AddValidation {
                    sheet_id,
                    validation_id: *id,
                    validation: Some(validation.clone()),
                });
                false
            } else {
                true
            }
        });
        reverse
    }

    /// Removes cell validations if it matches the function.
    fn remove_cell_validations(
        &mut self,
        matches: impl Fn(Pos) -> bool,
        sheet_id: SheetId,
    ) -> Vec<Operation> {
        let mut reverse = vec![];
        self.cell_validations.retain(|pos, _| {
            if matches(*pos) {
                reverse.push(Operation::SetValidationSelection {
                    selection: Selection::pos(pos.x, pos.y, sheet_id),
                    validation_id: None,
                });
                false
            } else {
                true
            }
        });
        reverse
    }

    /// Links a validation for a column to an existing Validation. Removes
    /// existing cell_validations for cells that are in the column.
    fn link_validation_column(
        &mut self,
        column: i64,
        id: Uuid,
        sheet_id: SheetId,
    ) -> Vec<Operation> {
        let mut reverse = vec![];
        let old = self.column_validations.get(&column);
        reverse.push(Operation::SetValidationSelection {
            selection: Selection::columns(&[column], sheet_id),
            validation_id: old.cloned(),
        });
        self.column_validations.insert(column, id);
        reverse.extend(self.remove_cell_validations(|pos| pos.x == column, sheet_id));
        reverse
    }

    /// Links a validation for a row to an existing Validation. Removes existing
    /// cell_validations for cells that are in the row.
    fn link_validation_row(&mut self, row: i64, id: Uuid, sheet_id: SheetId) -> Vec<Operation> {
        let mut reverse = vec![];
        let old = self.row_validations.get(&row);
        reverse.push(Operation::SetValidationSelection {
            selection: Selection::rows(&[row], sheet_id),
            validation_id: old.cloned(),
        });
        self.row_validations.insert(row, id);
        reverse.extend(self.remove_cell_validations(|pos| pos.y == row, sheet_id));
        reverse
    }

    // Links a validation for a rect to an existing Validation.
    fn link_validation_rect(&mut self, rect: Rect, id: Uuid, sheet_id: SheetId) -> Vec<Operation> {
        let mut reverse = vec![];
        for pos in rect.iter() {
            let old = self.cell_validations.get(&pos);
            reverse.push(Operation::SetValidationSelection {
                selection: Selection::pos(pos.x, pos.y, sheet_id),
                validation_id: old.cloned(),
            });
            self.cell_validations.insert(pos, id);
        }
        reverse
    }

    /// Links a validation for all cells to an existing Validation.
    /// Returns reverse operations.
    fn link_validation_all(&mut self, id: Uuid, sheet_id: SheetId) -> Vec<Operation> {
        let mut reverse = vec![];
        reverse.push(Operation::SetValidationSelection {
            selection: Selection::all(sheet_id),
            validation_id: self.all,
        });
        self.all = Some(id);

        self.cell_validations.retain(|pos, id| {
            reverse.push(Operation::SetValidationSelection {
                selection: Selection::pos(pos.x, pos.y, sheet_id),
                validation_id: Some(*id),
            });
            false
        });
        self.column_validations.retain(|column, id| {
            reverse.push(Operation::SetValidationSelection {
                selection: Selection::columns(&[*column], sheet_id),
                validation_id: Some(*id),
            });
            false
        });
        self.row_validations.retain(|row, id| {
            reverse.push(Operation::SetValidationSelection {
                selection: Selection::rows(&[*row], sheet_id),
                validation_id: Some(*id),
            });
            false
        });

        reverse
    }

    pub fn link_validation(&mut self, selection: Selection, id: Uuid) -> Vec<Operation> {
        let mut reverse = vec![];

        if selection.all {
            reverse.extend(self.link_validation_all(id, selection.sheet_id));
        }

        if let Some(columns) = selection.columns {
            columns.iter().for_each(|column| {
                reverse.extend(self.link_validation_column(*column, id, selection.sheet_id));
            });
        }
        if let Some(rows) = selection.rows {
            rows.iter().for_each(|row| {
                reverse.extend(self.link_validation_row(*row, id, selection.sheet_id));
            });
        }
        if let Some(rects) = selection.rects {
            rects.iter().for_each(|rect| {
                reverse.extend(self.link_validation_rect(*rect, id, selection.sheet_id));
            });
        }
        reverse.extend(self.cleanup(selection.sheet_id));

        reverse
    }

    /// Removes validation from a Selection. Returns the reverse operations.
    pub fn unlink_validation(&mut self, selection: Selection) -> Vec<Operation> {
        let mut reverse = vec![];

        if selection.all {
            if let Some(all) = self.all {
                reverse.push(Operation::SetValidationSelection {
                    selection: Selection::all(selection.sheet_id),
                    validation_id: Some(all),
                });
                self.all = None;
            }
        }

        if let Some(columns) = selection.columns {
            columns.iter().for_each(|column| {
                if let Some(old) = self.column_validations.remove(column) {
                    reverse.push(Operation::SetValidationSelection {
                        selection: Selection::columns(&[*column], selection.sheet_id),
                        validation_id: Some(old),
                    });
                }
            });
        }
        if let Some(rows) = selection.rows {
            rows.iter().for_each(|row| {
                if let Some(old) = self.row_validations.remove(row) {
                    reverse.push(Operation::SetValidationSelection {
                        selection: Selection::rows(&[*row], selection.sheet_id),
                        validation_id: Some(old),
                    });
                }
            });
        }
        if let Some(rects) = selection.rects {
            rects.iter().for_each(|rect| {
                for pos in rect.iter() {
                    if let Some(old) = self.cell_validations.remove(&pos) {
                        reverse.push(Operation::SetValidationSelection {
                            selection: Selection::pos(pos.x, pos.y, selection.sheet_id),
                            validation_id: Some(old),
                        });
                    }
                }
            });
        }
        reverse.extend(self.cleanup(selection.sheet_id));

        reverse
    }

    /// Creates or deletes a validation. Returns the reverse operations.
    pub fn set_validation(
        &mut self,
        sheet_id: SheetId,
        validation_id: Uuid,
        validation: Option<Validation>,
    ) -> Vec<Operation> {
        // let name = create
        //     .name
        //     .unwrap_or(format!("Validation {}", self.validations.len() + 1));

        // let id = Uuid::new_v4();
        // let validation = Validation {
        //     id,
        //     name,
        //     rule: create.rule,
        //     message: create.message,
        //     error: create.error,
        // };

        let mut reverse = vec![];
        if let Some(validation) = validation {
            // add the validation
            reverse.push(Operation::AddValidation {
                sheet_id,
                validation_id: validation.id,
                validation: None,
            });
            self.validations.insert(validation.id, validation);
        } else {
            // delete the validation
            let old = self.validations.get(&validation_id);
            reverse.push(Operation::AddValidation {
                sheet_id,
                validation_id,
                validation: old.cloned(),
            });
            self.validations.remove(&validation_id);
        }
        reverse
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::{
        sheet::validations::{
            validation::Validation,
            validation_rules::{
                validation_list::{ValidationList, ValidationListSource},
                ValidationRule,
            },
        },
        Sheet,
    };

    use super::*;

    /// Create a validation (list) for testing.
    fn create_validation() -> Validation {
        Validation {
            id: Uuid::new_v4(),
            name: "test".to_string(),
            rule: ValidationRule::List(ValidationList {
                source: ValidationListSource::List(vec!["a".to_string(), "b".to_string()]),
                ignore_blank: true,
                drop_down: true,
            }),
            message: Default::default(),
            error: Default::default(),
        }
    }

    #[test]
    fn add_validation() {
        let mut sheet = Sheet::test();

        let validation = create_validation();
        let reverse =
            sheet
                .validations
                .set_validation(sheet.id, validation.id, Some(validation.clone()));
        assert_eq!(reverse.len(), 1);
        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(
            sheet.validations.validations.get(&validation.id).unwrap(),
            &validation
        );
    }

    #[test]
    fn remove_validation() {
        let mut sheet = Sheet::test();

        let validation = create_validation();
        sheet
            .validations
            .set_validation(sheet.id, validation.id, Some(validation.clone()));
        let reverse = sheet
            .validations
            .set_validation(sheet.id, validation.id, None);
        assert_eq!(reverse.len(), 1);
        assert_eq!(sheet.validations.validations.len(), 0);
    }

    #[test]
    fn set_validation_all() {
        let mut sheet = Sheet::test();

        // this validations gets overwritten by the all validation
        let validation_to_overwrite = create_validation();
        let reverse = sheet.validations.set_validation(
            sheet.id,
            validation_to_overwrite.id,
            Some(validation_to_overwrite.clone()),
        );
        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(reverse.len(), 1);

        let selection = Selection {
            columns: Some(vec![2, 3]),
            rows: Some(vec![0, 1]),
            rects: Some(vec![Rect::new(0, 0, 10, 10)]),
            ..Default::default()
        };
        let reverse = sheet
            .validations
            .link_validation(selection.clone(), validation_to_overwrite.id);
        assert_eq!(reverse.len(), 125);

        let validation = create_validation();
        let reverse =
            sheet
                .validations
                .set_validation(sheet.id, validation.id, Some(validation.clone()));
        assert_eq!(reverse.len(), 1);
        let reverse = sheet
            .validations
            .link_validation(Selection::all(sheet.id), validation.id);
        assert_eq!(reverse.len(), 127);

        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(sheet.validations.all.unwrap(), validation.id);
        assert_eq!(sheet.validations.cell_validations.len(), 0);
        assert_eq!(sheet.validations.column_validations.len(), 0);
        assert_eq!(sheet.validations.row_validations.len(), 0);
        assert_eq!(
            sheet.validations.all,
            Some(*sheet.validations.validations.keys().next().unwrap())
        );
    }

    #[test]
    fn add_validation_row() {
        let mut sheet = Sheet::test();

        // these validations get overwritten by the row validation
        let validation_deleted = create_validation();
        let reverse = sheet.validations.set_validation(
            sheet.id,
            validation_deleted.id,
            Some(validation_deleted.clone()),
        );
        assert_eq!(reverse.len(), 1);
        let selection = Selection::rect(Rect::new(0, 0, 10, 0), sheet.id);
        let reverse = sheet
            .validations
            .link_validation(selection, validation_deleted.id);
        assert_eq!(reverse.len(), 11);

        let validation = create_validation();
        let reverse =
            sheet
                .validations
                .set_validation(sheet.id, validation.id, Some(validation.clone()));
        assert_eq!(reverse.len(), 1);

        let reverse = sheet
            .validations
            .link_validation(Selection::rows(&[0], sheet.id), validation.id);
        assert_eq!(reverse.len(), 13);

        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(sheet.validations.row_validations.len(), 1);
        assert_eq!(sheet.validations.column_validations.len(), 0);
        assert_eq!(sheet.validations.cell_validations.len(), 0);
        assert_eq!(
            sheet.validations.row_validations.get(&0).unwrap(),
            &validation.id
        );
    }

    #[test]
    fn add_validation_column() {
        let mut sheet = Sheet::test();

        // these validations get overwritten by the column validation
        let validation_deleted = create_validation();
        let reverse = sheet.validations.set_validation(
            sheet.id,
            validation_deleted.id,
            Some(validation_deleted.clone()),
        );
        assert_eq!(reverse.len(), 1);
        let selection = Selection::rect(Rect::new(0, 0, 0, 10), sheet.id);
        let reverse = sheet
            .validations
            .link_validation(selection, validation_deleted.id);
        assert_eq!(reverse.len(), 11);

        let validation = create_validation();
        let reverse =
            sheet
                .validations
                .set_validation(sheet.id, validation.id, Some(validation.clone()));
        assert_eq!(reverse.len(), 1);
        let reverse = sheet
            .validations
            .link_validation(Selection::columns(&[0], sheet.id), validation.id);
        assert_eq!(reverse.len(), 13);

        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(sheet.validations.column_validations.len(), 1);
        assert_eq!(sheet.validations.row_validations.len(), 0);
        assert_eq!(sheet.validations.cell_validations.len(), 0);
        assert_eq!(
            sheet.validations.column_validations.get(&0).unwrap(),
            &validation.id
        );
    }

    #[test]
    fn add_validation_rect() {
        let mut sheet = Sheet::test();

        // some of these validations get overwritten by the rect validation
        let selection = Selection::rect(Rect::new(0, 0, 9, 9), sheet.id);
        let validation_old = create_validation();
        let reverse = sheet.validations.set_validation(
            sheet.id,
            validation_old.id,
            Some(validation_old.clone()),
        );
        assert_eq!(reverse.len(), 1);
        let reverse = sheet
            .validations
            .link_validation(selection.clone(), validation_old.id);
        assert_eq!(reverse.len(), 100);

        let validation = create_validation();
        let reverse =
            sheet
                .validations
                .set_validation(sheet.id, validation.id, Some(validation.clone()));
        assert_eq!(reverse.len(), 1);

        let reverse = sheet.validations.link_validation(
            Selection::rect(Rect::new(0, 0, 5, 5), sheet.id),
            validation.id,
        );
        assert_eq!(reverse.len(), 36);

        assert_eq!(sheet.validations.validations.len(), 2);
        assert_eq!(sheet.validations.cell_validations.len(), 100);
        assert_eq!(sheet.validations.column_validations.len(), 0);
        assert_eq!(sheet.validations.row_validations.len(), 0);
        assert_eq!(
            sheet.validations.validation_id((0, 0).into()),
            Some(validation.id)
        );
        assert_eq!(
            sheet.validations.validation_id((6, 6).into()),
            Some(validation_old.id)
        );
    }

    #[test]
    fn link_validation() {
        let mut sheet = Sheet::test();

        let validation = create_validation();
        let reverse =
            sheet
                .validations
                .set_validation(sheet.id, validation.id, Some(validation.clone()));
        assert_eq!(reverse.len(), 1);
        let reverse = sheet
            .validations
            .link_validation(Selection::pos(-1, -1, sheet.id), validation.id);
        assert_eq!(reverse.len(), 1);

        let selection = Selection::rect(Rect::new(0, 0, 9, 9), sheet.id);
        let reverse = sheet.validations.link_validation(selection, validation.id);
        assert_eq!(reverse.len(), 100);

        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(sheet.validations.cell_validations.len(), 101);
        assert_eq!(sheet.validations.column_validations.len(), 0);
        assert_eq!(sheet.validations.row_validations.len(), 0);
        assert_eq!(
            sheet.validations.validation_id((0, 0).into()),
            Some(validation.id)
        );
    }

    #[test]
    fn unlink_validation() {
        let mut sheet = Sheet::test();

        let validation = create_validation();
        let reverse =
            sheet
                .validations
                .set_validation(sheet.id, validation.id, Some(validation.clone()));
        assert_eq!(reverse.len(), 1);
        let reverse = sheet
            .validations
            .link_validation(Selection::pos(-1, -1, sheet.id), validation.id);
        assert_eq!(reverse.len(), 1);

        let selection = Selection::rect(Rect::new(0, 0, 9, 9), sheet.id);
        let reverse = sheet.validations.link_validation(selection, validation.id);
        assert_eq!(reverse.len(), 100);

        let reverse = sheet
            .validations
            .unlink_validation(Selection::rect(Rect::new(0, 0, 9, 9), sheet.id));
        assert_eq!(reverse.len(), 100);

        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(sheet.validations.cell_validations.len(), 1);
        assert_eq!(sheet.validations.column_validations.len(), 0);
        assert_eq!(sheet.validations.row_validations.len(), 0);
        assert_eq!(sheet.validations.all, None);
    }
}
