use uuid::Uuid;

use crate::{
    controller::operations::operation::Operation, grid::SheetId, selection::Selection, Pos, Rect,
};

use super::Validations;

impl Validations {
    /// Cleans up validations that are no longer needed.
    fn cleanup(&mut self) {
        self.validations.retain(|id, _| {
            self.cell_validations.values().any(|v| v == id)
                || self.column_validations.values().any(|v| v == id)
                || self.row_validations.values().any(|v| v == id)
                || self.all == Some(*id)
        });
    }

    /// Removes cell validations if it matches the function.
    fn remove_cell_validations(&mut self, matches: impl Fn(Pos) -> bool) {
        self.cell_validations.retain(|pos, _| !matches(*pos));
    }

    /// Links a validation for a column to an existing Validation. Removes
    /// existing cell_validations for cells that are in the column.
    fn link_validation_column(&mut self, column: i64, id: Uuid) {
        // if validation was deleted, then nothing more to do
        if self.validations.get(&id).is_none() {
            return;
        }
        self.column_validations.insert(column, id);
        self.remove_cell_validations(|pos| pos.x == column);
    }

    /// Links a validation for a row to an existing Validation. Removes existing
    /// cell_validations for cells that are in the row.
    fn link_validation_row(&mut self, row: i64, id: Uuid) {
        // if validation was deleted, then nothing more to do
        if self.validations.get(&id).is_none() {
            return;
        }
        self.row_validations.insert(row, id);
        self.remove_cell_validations(|pos| pos.y == row);
    }

    // Links a validation for a rect to an existing Validation.
    fn link_validation_rect(&mut self, rect: Rect, id: Uuid) {
        // if validation was deleted, then nothing more to do
        if self.validations.get(&id).is_none() {
            return;
        }
        for pos in rect.iter() {
            self.cell_validations.insert(pos, id);
        }
    }

    fn link_validation_all(&mut self, id: Uuid, sheet_id: SheetId) -> Vec<Operation> {
        // if validation was deleted, then nothing more to do
        if self.validations.get(&id).is_none() {
            return vec![];
        }

        let mut reverse = vec![];
        if let Some(all) = self.all {
            reverse.push(Operation::SetValidation {
                selection: Selection::all(sheet_id),
                validation: Some(self.validations[&all].clone()),
            });
        }
        self.all = Some(id);
        self.cell_validations.clear();
        self.column_validations.clear();
        self.row_validations.clear();

        reverse
    }

    pub fn link_validation(&mut self, selection: Selection, id: Uuid) -> Vec<Operation> {
        let mut reverse = vec![];

        if selection.all {
            reverse.extend(self.link_validation_all(id, selection.sheet_id));
        }

        if let Some(columns) = selection.columns {
            columns.iter().for_each(|column| {
                reverse.extend(self.link_validation_column(*column, id));
            });
        }
        if let Some(rows) = selection.rows {
            rows.iter().for_each(|row| {
                self.link_validation_row(*row, id);
            });
        }
        if let Some(rects) = selection.rects {
            rects.iter().for_each(|rect| {
                self.link_validation_rect(*rect, id);
            });
        }
        self.cleanup();

        reverse
    }

    /// Creates a new validation and applies it to the selection
    pub fn add_validation(&mut self, validation: Validation, selection: Selection) {
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
        self.validations.insert(id, validation);
        self.link_validation(selection, id);
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

    fn create_validation() -> Validation {
        Validation {
            id: Uuid::new_v4(),
            name: None,
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
    fn add_validation_all() {
        let mut validations = Validations::default();
        let sheet = Sheet::test();

        // these validations get overwritten by the all validation
        let validation_deleted = create_validation();
        let selection = Selection {
            columns: Some(vec![2, 3]),
            rows: Some(vec![0, 1]),
            rects: Some(vec![Rect::new(0, 0, 10, 10)]),
            ..Default::default()
        };
        validations.add_validation(selection, validation_deleted);

        let validation = create_validation();
        validations.add_validation(Selection::all(sheet.id), validation.clone());

        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.all.unwrap(), validation.id);
        assert_eq!(validations.cell_validations.len(), 0);
        assert_eq!(validations.column_validations.len(), 0);
        assert_eq!(validations.row_validations.len(), 0);
        assert_eq!(
            validations.all,
            Some(validations.validations.keys().next().unwrap().clone())
        );
    }

    #[test]
    fn add_validation_row() {
        let mut validations = Validations::default();
        let sheet = Sheet::test();

        // these validations get overwritten by the row validation
        let selection = Selection::rect(Rect::new(0, 0, 10, 0), sheet.id);
        let validation_deleted = create_validation();
        validations.add_validation(selection, validation_deleted);

        let validation = create_validation();
        validations.add_validation(Selection::rows(&[0], sheet.id), validation.clone());

        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.row_validations.len(), 1);
        assert_eq!(validations.column_validations.len(), 0);
        assert_eq!(validations.cell_validations.len(), 0);
        assert_eq!(validations.row_validations.get(&0).unwrap(), &validation.id);
    }

    #[test]
    fn add_validation_column() {
        let mut validations = Validations::default();
        let sheet = Sheet::test();

        // these validations get overwritten by the column validation
        let selection = Selection::rect(Rect::new(0, 0, 0, 10), sheet.id);
        let validation_deleted = create_validation();
        validations.add_validation(selection, validation_deleted);

        let validation = create_validation();
        validations.add_validation(Selection::columns(&[0], sheet.id), validation.clone());

        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.column_validations.len(), 1);
        assert_eq!(validations.row_validations.len(), 0);
        assert_eq!(validations.cell_validations.len(), 0);
        assert_eq!(
            validations.column_validations.get(&0).unwrap(),
            &validation.id
        );
    }

    #[test]
    fn add_validation_rect() {
        let mut validations = Validations::default();
        let sheet = Sheet::test();

        // some of these validations get overwritten by the rect validation
        let selection = Selection::rect(Rect::new(0, 0, 9, 9), sheet.id);
        let validation_old = create_validation();
        validations.add_validation(selection, validation_old.clone());

        let validation = create_validation();
        validations.add_validation(
            Selection::rect(Rect::new(0, 0, 5, 5), sheet.id),
            validation.clone(),
        );

        assert_eq!(validations.validations.len(), 2);
        assert_eq!(validations.cell_validations.len(), 100);
        assert_eq!(validations.column_validations.len(), 0);
        assert_eq!(validations.row_validations.len(), 0);
        assert_eq!(
            validations.validation_id((0, 0).into()),
            Some(validation.id)
        );
        assert_eq!(
            validations.validation_id((6, 6).into()),
            Some(validation_old.id)
        );
    }

    #[test]
    fn link_validation() {
        let mut validations = Validations::default();
        let sheet = Sheet::test();

        let validation = create_validation();
        validations.add_validation(Selection::pos(-1, -1, sheet.id), validation.clone());

        let id = validation.id;
        let selection = Selection::rect(Rect::new(0, 0, 9, 9), sheet.id);
        validations.link_validation(selection, id);

        assert_eq!(validations.validations.len(), 1);
        assert_eq!(validations.cell_validations.len(), 101);
        assert_eq!(validations.column_validations.len(), 0);
        assert_eq!(validations.row_validations.len(), 0);
        assert_eq!(
            validations.validation_id((0, 0).into()),
            Some(validation.id)
        );
    }
}
