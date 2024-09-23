use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    formulas::{replace_cell_references_with, CellRefCoord},
    grid::{GridBounds, SheetId},
    CellValue, CodeCellValue,
};

impl GridController {
    fn adjust_formulas(
        &self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        sheet_name: String,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) {
        self.grid.sheets().iter().for_each(|sheet| {
            sheet.code_runs.iter().for_each(|(pos, code_run)| {
                if let Some(column) = column {
                    if code_run.cells_accessed.iter().any(|sheet_rect| {
                        // if the cells accessed is beyond the column that was deleted
                        sheet_rect.sheet_id == sheet_id && sheet_rect.max.x >= column
                    }) {
                        // only update formulas (for now)
                        if let Some(CellValue::Code(code)) = sheet.cell_value_ref(*pos) {
                            let new_code = replace_cell_references_with(
                                &code.code,
                                *pos,
                                |coord_sheet_name, cell_ref| {
                                    let coord_sheet_name =
                                        coord_sheet_name.as_ref().unwrap_or(&sheet.name);
                                    if *coord_sheet_name == sheet_name {
                                        match cell_ref {
                                            CellRefCoord::Relative(x) => {
                                                if x + pos.x >= column {
                                                    CellRefCoord::Relative(x + delta)
                                                } else {
                                                    CellRefCoord::Relative(x)
                                                }
                                            }
                                            CellRefCoord::Absolute(x) => {
                                                if x >= column {
                                                    CellRefCoord::Absolute(x + delta)
                                                } else {
                                                    CellRefCoord::Absolute(x)
                                                }
                                            }
                                        }
                                    } else {
                                        cell_ref
                                    }
                                },
                                |_, cell_ref| cell_ref,
                            );
                            if new_code != code.code {
                                let code_cell_value = CellValue::Code(CodeCellValue {
                                    code: new_code,
                                    ..code.clone()
                                });
                                transaction.operations.push_back(Operation::SetCellValues {
                                    sheet_pos: pos.to_sheet_pos(sheet_id),
                                    values: code_cell_value.into(),
                                });
                            }
                        }
                    }
                } else if let Some(row) = row {
                    if code_run.cells_accessed.iter().any(|sheet_rect| {
                        // if the cells accessed is beyond the row that was deleted
                        sheet_rect.sheet_id == sheet_id && sheet_rect.max.y >= row
                    }) {
                        // only update formulas (for now)
                        if let Some(CellValue::Code(code)) = sheet.cell_value_ref(*pos) {
                            let new_code = replace_cell_references_with(
                                &code.code,
                                *pos,
                                |_, cell_ref| cell_ref,
                                |coord_sheet_name, cell_ref| {
                                    let coord_sheet_name =
                                        coord_sheet_name.as_ref().unwrap_or(&sheet.name);
                                    if *coord_sheet_name == sheet_name {
                                        match cell_ref {
                                            CellRefCoord::Relative(y) => {
                                                if y + pos.y >= row {
                                                    CellRefCoord::Relative(y + delta)
                                                } else {
                                                    CellRefCoord::Relative(y)
                                                }
                                            }
                                            CellRefCoord::Absolute(y) => {
                                                if y >= row {
                                                    CellRefCoord::Absolute(y + delta)
                                                } else {
                                                    CellRefCoord::Absolute(y)
                                                }
                                            }
                                        }
                                    } else {
                                        cell_ref
                                    }
                                },
                            );
                            if new_code != code.code {
                                let code_cell_value = CellValue::Code(CodeCellValue {
                                    code: new_code,
                                    ..code.clone()
                                });
                                let sheet_pos = pos.to_sheet_pos(sheet_id);
                                transaction.operations.push_back(Operation::SetCellValues {
                                    sheet_pos,
                                    values: code_cell_value.into(),
                                });
                            }
                        }
                    }
                }
            });
        });
    }

    pub fn execute_delete_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumn { sheet_id, column } = op.clone() {
            let sheet_name: String;
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.delete_column(transaction, column);
                transaction.forward_operations.push(op);

                sheet.recalculate_bounds();
                sheet_name = sheet.name.clone();
            } else {
                // nothing more can be done
                return;
            }

            if transaction.is_user() {
                // adjust formulas to account for deleted column (needs to be
                // here since it's across sheets)
                self.adjust_formulas(transaction, sheet_id, sheet_name, Some(column), None, -1);

                // update information for all cells to the right of the deleted column
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                        let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                        sheet_rect.min.x = column;
                        self.check_deleted_code_runs(transaction, &sheet_rect);
                        self.add_compute_operations(transaction, &sheet_rect, None);
                        self.check_all_spills(transaction, sheet_rect.sheet_id, true);
                    }
                }
            }

            if !transaction.is_server() {
                self.send_updated_bounds(sheet_id);
            }
        }
    }

    pub fn execute_delete_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteRow { sheet_id, row } = op.clone() {
            let sheet_name: String;
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.delete_row(transaction, row);
                transaction.forward_operations.push(op);

                sheet.recalculate_bounds();
                sheet_name = sheet.name.clone();
            } else {
                // nothing more can be done
                return;
            }

            if transaction.is_user() {
                // adjust formulas to account for deleted column (needs to be
                // here since it's across sheets)
                self.adjust_formulas(transaction, sheet_id, sheet_name, None, Some(row), -1);

                // update information for all cells below the deleted row
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                        let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                        sheet_rect.min.y = row;
                        self.check_deleted_code_runs(transaction, &sheet_rect);
                        self.add_compute_operations(transaction, &sheet_rect, None);
                        self.check_all_spills(transaction, sheet_rect.sheet_id, true);
                    }
                }
            }

            if !transaction.is_server() {
                self.send_updated_bounds(sheet_id);
            }
        }
    }

    pub fn execute_insert_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertColumn { sheet_id, column } = op {
            let sheet_name: String;
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.insert_column(transaction, column);
                transaction.forward_operations.push(op);

                sheet.recalculate_bounds();
                sheet_name = sheet.name.clone();
            } else {
                // nothing more can be done
                return;
            }

            if transaction.is_user() {
                // adjust formulas to account for deleted column (needs to be
                // here since it's across sheets)
                self.adjust_formulas(transaction, sheet_id, sheet_name, Some(column), None, 1);

                // update information for all cells to the right of the deleted column
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                        let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                        sheet_rect.min.x = column + 1;
                        self.check_deleted_code_runs(transaction, &sheet_rect);
                        self.add_compute_operations(transaction, &sheet_rect, None);
                        self.check_all_spills(transaction, sheet_rect.sheet_id, true);
                    }
                }
            }

            if !transaction.is_server() {
                self.send_updated_bounds(sheet_id);
            }
        }
    }

    pub fn execute_insert_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertRow { sheet_id, row } = op {
            let sheet_name: String;
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.insert_row(transaction, row);
                transaction.forward_operations.push(op);

                sheet.recalculate_bounds();
                sheet_name = sheet.name.clone();
            } else {
                // nothing more can be done
                return;
            }

            if transaction.is_user() {
                // adjust formulas to account for deleted column (needs to be
                // here since it's across sheets)
                self.adjust_formulas(transaction, sheet_id, sheet_name, None, Some(row), 1);

                // update information for all cells below the deleted row
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                        let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                        sheet_rect.min.y = row + 1;
                        self.check_deleted_code_runs(transaction, &sheet_rect);
                        self.add_compute_operations(transaction, &sheet_rect, None);
                        self.check_all_spills(transaction, sheet_rect.sheet_id, true);
                    }
                }
            }

            if !transaction.is_server() {
                self.send_updated_bounds(sheet_id);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;
    use uuid::Uuid;

    use crate::{
        grid::{
            sheet::validations::{validation::Validation, validation_rules::ValidationRule},
            CodeCellLanguage,
        },
        selection::Selection,
        Pos, Rect, SheetPos,
    };

    use super::*;

    #[test]
    #[parallel]
    fn adjust_formulas_nothing() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        let column = 0;
        let row = 0;
        let delta = 1;
        gc.adjust_formulas(
            &mut PendingTransaction::default(),
            sheet_id,
            sheet.name.clone(),
            Some(column),
            None,
            delta,
        );
        gc.adjust_formulas(
            &mut PendingTransaction::default(),
            sheet_id,
            sheet.name.clone(),
            None,
            Some(row),
            delta,
        );
    }

    #[test]
    #[parallel]
    fn adjust_formulas() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 1,
                y: 0,
            },
            "1".into(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                sheet_id,
                x: 0,
                y: 0,
            },
            CodeCellLanguage::Formula,
            "B0".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 0, y: 0 }).unwrap(),
            "1".to_string()
        );

        let mut transaction = PendingTransaction::default();
        gc.adjust_formulas(
            &mut transaction,
            sheet_id,
            sheet.name.clone(),
            Some(1),
            None,
            1,
        );

        assert_eq!(transaction.operations.len(), 1);
        assert_eq!(
            transaction.operations[0],
            Operation::SetCellValues {
                sheet_pos: SheetPos {
                    sheet_id,
                    x: 0,
                    y: 0
                },
                values: CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code: "R[0]C[2]".to_string()
                })
                .into(),
            }
        );
    }

    #[test]
    #[parallel]
    fn execute_insert_column() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["A", "B", "C"]],
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 3, 1))
        );
        gc.insert_column(sheet_id, 3, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 4, 1))
        );
    }

    #[test]
    #[parallel]
    fn execute_insert_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["A"], vec!["B"], vec!["C"]],
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 1, 3))
        );
        gc.insert_row(sheet_id, 3, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 1, 4))
        );
    }

    #[test]
    #[parallel]
    fn delete_column_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 3,
                y: 1,
                sheet_id,
            },
            "1".into(),
            None,
        );

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "D1".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.delete_rows(sheet_id, vec![2], None);

        // rerun the code cell to get the new value
        gc.rerun_code_cell(SheetPos::new(sheet_id, 1, 1), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.undo(None);
        gc.rerun_code_cell(SheetPos::new(sheet_id, 1, 1), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );
    }

    #[test]
    #[parallel]
    fn delete_row_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_value(
            SheetPos {
                x: 1,
                y: 3,
                sheet_id,
            },
            "1".into(),
            None,
        );

        gc.set_code_cell(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            CodeCellLanguage::Formula,
            "B3".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.delete_rows(sheet_id, vec![2], None);

        // rerun the code cell to get the new value
        gc.rerun_code_cell(SheetPos::new(sheet_id, 1, 1), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.undo(None);
        gc.rerun_code_cell(SheetPos::new(sheet_id, 1, 1), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );
    }

    #[test]
    #[parallel]
    fn insert_column_validation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.update_validation(
            Validation {
                id: Uuid::new_v4(),
                selection: Selection {
                    sheet_id,
                    rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                    columns: Some(vec![2]),
                    ..Default::default()
                },
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        gc.insert_column(sheet_id, 2, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);

        assert_eq!(
            sheet.validations.validations[0].selection.columns,
            Some(vec![3])
        );
        assert_eq!(
            sheet.validations.validations[0].selection.rects,
            Some(vec![Rect::new(1, 1, 4, 3)])
        );
    }

    #[test]
    #[parallel]
    fn insert_row_validation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.update_validation(
            Validation {
                id: Uuid::new_v4(),
                selection: Selection {
                    sheet_id,
                    rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                    rows: Some(vec![2]),
                    ..Default::default()
                },
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        gc.insert_row(sheet_id, 2, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);

        assert_eq!(
            sheet.validations.validations[0].selection.rows,
            Some(vec![3])
        );
        assert_eq!(
            sheet.validations.validations[0].selection.rects,
            Some(vec![Rect::new(1, 1, 3, 4)])
        );
    }

    #[test]
    #[parallel]
    fn delete_column_validation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.update_validation(
            Validation {
                id: Uuid::new_v4(),
                selection: Selection {
                    sheet_id,
                    rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                    columns: Some(vec![2]),
                    ..Default::default()
                },
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        gc.delete_columns(sheet_id, vec![2], None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);

        assert_eq!(sheet.validations.validations[0].selection.columns, None);
        assert_eq!(
            sheet.validations.validations[0].selection.rects,
            Some(vec![Rect::new(1, 1, 2, 3)])
        );
    }

    #[test]
    #[parallel]
    fn delete_row_validation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.update_validation(
            Validation {
                id: Uuid::new_v4(),
                selection: Selection {
                    sheet_id,
                    rects: Some(vec![Rect::new(1, 1, 3, 3)]),
                    rows: Some(vec![2]),
                    ..Default::default()
                },
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        gc.delete_rows(sheet_id, vec![2], None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);

        assert_eq!(sheet.validations.validations[0].selection.rows, None);
        assert_eq!(
            sheet.validations.validations[0].selection.rects,
            Some(vec![Rect::new(1, 1, 3, 2)])
        );
    }

    #[test]
    #[parallel]
    fn delete_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["A", "B", "C", "D"]],
            None,
        );

        gc.delete_columns(sheet_id, vec![2, 3], None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 2, 1))
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 4, 1))
        );
    }

    #[test]
    #[parallel]
    fn delete_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["A"], vec!["B"], vec!["C"], vec!["D"]],
            None,
        );

        gc.delete_rows(sheet_id, vec![2, 3], None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 1, 2))
        );

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 1, 4))
        );
    }
}
