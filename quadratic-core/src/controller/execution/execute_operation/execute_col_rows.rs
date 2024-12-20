use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    formulas::{replace_cell_references_with, CellRefCoord},
    grid::{CodeCellLanguage, CodeCellValue, GridBounds, SheetId},
    CellValue, Pos, UNBOUNDED,
};

impl GridController {
    pub fn adjust_formula_column_row(
        code_cell: &CodeCellValue,
        sheet_name: &String,
        code_cell_pos: &Pos,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) -> String {
        if let Some(column) = column {
            let new_code = replace_cell_references_with(
                &code_cell.code,
                *code_cell_pos,
                |coord_sheet_name, cell_ref| {
                    let coord_sheet_name = coord_sheet_name.as_ref().unwrap_or(sheet_name);
                    if coord_sheet_name == sheet_name {
                        match cell_ref {
                            CellRefCoord::Relative(x) => {
                                if x + code_cell_pos.x >= column {
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
            new_code
        } else if let Some(row) = row {
            let new_code = replace_cell_references_with(
                &code_cell.code,
                *code_cell_pos,
                |_, cell_ref| cell_ref,
                |coord_sheet_name, cell_ref| {
                    let coord_sheet_name = coord_sheet_name.as_ref().unwrap_or(sheet_name);
                    if coord_sheet_name == sheet_name {
                        match cell_ref {
                            CellRefCoord::Relative(y) => {
                                if y + code_cell_pos.y >= row {
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
            new_code
        } else {
            code_cell.code.clone()
        }
    }

    fn adjust_code_cells_column_row(
        &self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) {
        for sheet in self.grid.sheets().iter() {
            for (pos, code_run) in sheet.iter_code_runs() {
                if let Some(cells_ranges) = code_run.cells_accessed.cells.get(&sheet_id) {
                    let Some(sheet) = self.try_sheet(sheet_id) else {
                        continue;
                    };

                    for cells_range in cells_ranges.iter() {
                        let cells_rect = sheet.cell_ref_range_to_rect(*cells_range);

                        if cells_rect.max.x < column.unwrap_or(UNBOUNDED)
                            && cells_rect.max.y < row.unwrap_or(UNBOUNDED)
                        {
                            continue;
                        }

                        if let Some(CellValue::Code(code)) = sheet.cell_value_ref(*pos) {
                            let new_code = match code.language {
                                CodeCellLanguage::Formula => {
                                    GridController::adjust_formula_column_row(
                                        code,
                                        &sheet.name,
                                        pos,
                                        column,
                                        row,
                                        delta,
                                    )
                                }
                                _ => {
                                    let mut new_code = code.clone();
                                    new_code.adjust_code_cell_column_row(column, row, delta);
                                    new_code.code
                                }
                            };
                            if new_code != code.code {
                                let code_cell_value = CellValue::Code(CodeCellValue {
                                    code: new_code,
                                    ..code.clone()
                                });
                                let sheet_pos = pos.to_sheet_pos(sheet.id);
                                transaction.operations.push_back(Operation::SetCellValues {
                                    sheet_pos,
                                    values: code_cell_value.into(),
                                });
                                transaction
                                    .operations
                                    .push_back(Operation::ComputeCode { sheet_pos });
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn execute_delete_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumn { sheet_id, column } = op.clone() {
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.delete_column(transaction, column);
                transaction.forward_operations.push(op);

                sheet.recalculate_bounds();
            } else {
                // nothing more can be done
                return;
            }

            if transaction.is_user() {
                // adjust formulas to account for deleted column (needs to be
                // here since it's across sheets)
                self.adjust_code_cells_column_row(transaction, sheet_id, Some(column), None, -1);

                // update information for all cells to the right of the deleted column
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                        let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                        sheet_rect.min.x = column;
                        self.check_deleted_data_tables(transaction, &sheet_rect);
                        self.add_compute_operations(transaction, &sheet_rect, None);
                        self.check_all_spills(transaction, sheet_rect.sheet_id);
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
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.delete_row(transaction, row);
                transaction.forward_operations.push(op);

                sheet.recalculate_bounds();
            } else {
                // nothing more can be done
                return;
            }

            if transaction.is_user() {
                // adjust formulas to account for deleted column (needs to be
                // here since it's across sheets)
                self.adjust_code_cells_column_row(transaction, sheet_id, None, Some(row), -1);

                // update information for all cells below the deleted row
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                        let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                        sheet_rect.min.y = row;
                        self.check_deleted_data_tables(transaction, &sheet_rect);
                        self.add_compute_operations(transaction, &sheet_rect, None);
                        self.check_all_spills(transaction, sheet_rect.sheet_id);
                    }
                }
            }

            if !transaction.is_server() {
                self.send_updated_bounds(sheet_id);
            }
        }
    }

    pub fn execute_insert_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertColumn {
            sheet_id,
            column,
            copy_formats,
        } = op
        {
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.insert_column(transaction, column, copy_formats);
                transaction.forward_operations.push(op);

                sheet.recalculate_bounds();
            } else {
                // nothing more can be done
                return;
            }

            if transaction.is_user() {
                // adjust formulas to account for inserted column (needs to be
                // here since it's across sheets)
                self.adjust_code_cells_column_row(transaction, sheet_id, Some(column), None, 1);

                // update information for all cells to the right of the inserted column
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                        let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                        sheet_rect.min.x = column + 1;
                        self.check_deleted_data_tables(transaction, &sheet_rect);
                        self.add_compute_operations(transaction, &sheet_rect, None);
                        self.check_all_spills(transaction, sheet_rect.sheet_id);
                    }
                }
            }

            if !transaction.is_server() {
                self.send_updated_bounds(sheet_id);
            }
        }
    }

    pub fn execute_insert_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertRow {
            sheet_id,
            row,
            copy_formats,
        } = op
        {
            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                sheet.insert_row(transaction, row, copy_formats);
                transaction.forward_operations.push(op);

                sheet.recalculate_bounds();
            } else {
                // nothing more can be done
                return;
            }

            if transaction.is_user() {
                // adjust formulas to account for deleted column (needs to be
                // here since it's across sheets)
                self.adjust_code_cells_column_row(transaction, sheet_id, None, Some(row), 1);

                // update information for all cells below the deleted row
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                        let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                        sheet_rect.min.y = row + 1;
                        self.check_deleted_data_tables(transaction, &sheet_rect);
                        self.add_compute_operations(transaction, &sheet_rect, None);
                        self.check_all_spills(transaction, sheet_rect.sheet_id);
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
    use std::collections::HashMap;

    use serial_test::{parallel, serial};
    use uuid::Uuid;

    use crate::{
        grid::{
            sheet::validations::{validation::Validation, validation_rules::ValidationRule},
            CellsAccessed, CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind,
        },
        wasm_bindings::js::{clear_js_calls, expect_js_call_count, expect_js_offsets},
        A1Selection, Array, CellValue, Pos, Rect, SheetPos, SheetRect, Value, DEFAULT_COLUMN_WIDTH,
        DEFAULT_ROW_HEIGHT,
    };

    use super::*;

    #[test]
    #[parallel]
    fn adjust_code_cells_nothing() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let column = 0;
        let row = 0;
        let delta = 1;
        gc.adjust_code_cells_column_row(
            &mut PendingTransaction::default(),
            sheet_id,
            Some(column),
            None,
            delta,
        );
        gc.adjust_code_cells_column_row(
            &mut PendingTransaction::default(),
            sheet_id,
            None,
            Some(row),
            delta,
        );
    }

    #[test]
    #[parallel]
    fn adjust_code_cells_formula() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 2,
                y: 1,
            },
            "1".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 2,
                y: 2,
            },
            "2".into(),
            None,
        );
        gc.set_code_cell(
            SheetPos {
                sheet_id,
                x: 1,
                y: 1,
            },
            CodeCellLanguage::Formula,
            "B1 + B2".into(),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "3".to_string()
        );

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cells_column_row(&mut transaction, sheet_id, None, Some(2), 1);

        assert_eq!(transaction.operations.len(), 2);
        assert_eq!(
            transaction.operations[0],
            Operation::SetCellValues {
                sheet_pos: SheetPos {
                    sheet_id,
                    x: 1,
                    y: 1
                },
                values: CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Formula,
                    code: "R[0]C[1] + R[2]C[1]".to_string()
                })
                .into(),
            }
        );
    }

    #[test]
    #[parallel]
    fn adjust_code_cells_python() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 2,
                y: 1,
            },
            "1".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 2,
                y: 2,
            },
            "2".into(),
            None,
        );

        let sheet_pos = SheetPos {
            sheet_id,
            x: 1,
            y: 1,
        };

        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Python,
            "q.cells('B1:B2')".into(),
            None,
        );

        let mut cells_accessed = CellsAccessed::default();
        cells_accessed.add_sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id));
        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed,
            formatted_code_string: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "test",
            Value::Array(Array::from(vec![vec!["3"]])),
            false,
            false,
            true,
            None,
        );
        let transaction = &mut PendingTransaction::default();
        gc.finalize_code_run(transaction, sheet_pos, Some(data_table), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "3".to_string()
        );

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cells_column_row(&mut transaction, sheet_id, None, Some(2), 1);
        assert_eq!(transaction.operations.len(), 2);
        assert_eq!(
            transaction.operations[0],
            Operation::SetCellValues {
                sheet_pos,
                values: CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Python,
                    code: "q.cells('B1:B3')".to_string()
                })
                .into(),
            }
        );
    }

    #[test]
    #[parallel]
    fn adjust_code_cells_javascript() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 2,
                y: 1,
            },
            "1".into(),
            None,
        );
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 2,
                y: 2,
            },
            "2".into(),
            None,
        );

        let sheet_pos = SheetPos {
            sheet_id,
            x: 1,
            y: 1,
        };

        gc.set_code_cell(
            sheet_pos,
            CodeCellLanguage::Javascript,
            "return q.cells('B1:B2');".into(),
            None,
        );

        let mut cells_accessed = CellsAccessed::default();
        cells_accessed.add_sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id));

        let code_run = CodeRun {
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed,
            formatted_code_string: None,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "test",
            Value::Array(Array::from(vec![vec!["3"]])),
            false,
            false,
            true,
            None,
        );
        let transaction = &mut PendingTransaction::default();
        gc.finalize_code_run(transaction, sheet_pos, Some(data_table), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "3".to_string()
        );

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cells_column_row(&mut transaction, sheet_id, None, Some(2), 1);
        assert_eq!(transaction.operations.len(), 2);
        assert_eq!(
            transaction.operations[0],
            Operation::SetCellValues {
                sheet_pos,
                values: CellValue::Code(CodeCellValue {
                    language: CodeCellLanguage::Javascript,
                    code: "return q.cells('B1:B3');".to_string()
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
        gc.insert_column(sheet_id, 3, true, None);

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
        gc.insert_row(sheet_id, 3, true, None);

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
            "C1".into(),
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
            "A3".into(),
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
                selection: A1Selection::test_a1("A1:C3,B"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        gc.insert_column(sheet_id, 2, true, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(
            sheet.validations.validations[0].selection,
            A1Selection::test_a1("A1:D3,C")
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
                selection: A1Selection::test_a1("A1:C3,2"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        gc.insert_row(sheet_id, 2, true, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(
            sheet.validations.validations[0].selection,
            A1Selection::test_a1("A1:C4,3")
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
                selection: A1Selection::test_a1("A1:C3,B"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        gc.delete_columns(sheet_id, vec![2], None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(
            sheet.validations.validations[0].selection,
            A1Selection::test_a1("A1:B3")
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
                selection: A1Selection::test_a1("A1:C3,2"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
        );

        gc.delete_rows(sheet_id, vec![2], None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(
            sheet.validations.validations[0].selection,
            A1Selection::test_a1("A1:C2")
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
    fn test_delete_row() {
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

    #[test]
    #[serial]
    fn insert_column_offsets() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.insert_column(sheet_id, 1, true, None);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        gc.insert_column(sheet_id, 2, true, None);
        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((Some(2), None), DEFAULT_COLUMN_WIDTH);
        offsets.insert((Some(3), None), 200.0);
        offsets.insert((Some(4), None), DEFAULT_COLUMN_WIDTH);
        offsets.insert((Some(5), None), 400.0);
        expect_js_offsets(sheet_id, offsets, true);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), DEFAULT_COLUMN_WIDTH);
        assert_eq!(sheet.offsets.column_width(3), 200.0);
        assert_eq!(sheet.offsets.column_width(5), 400.0);
    }

    #[test]
    #[serial]
    fn delete_column_offsets() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.delete_columns(sheet_id, vec![2], None);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        gc.delete_columns(sheet_id, vec![2], None);
        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((Some(2), None), DEFAULT_COLUMN_WIDTH);
        offsets.insert((Some(3), None), 400.0);
        offsets.insert((Some(4), None), DEFAULT_COLUMN_WIDTH);
        expect_js_offsets(sheet_id, offsets, true);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), DEFAULT_COLUMN_WIDTH);
        assert_eq!(sheet.offsets.column_width(3), 400.0);
    }

    #[test]
    #[serial]
    fn insert_row_offsets() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.insert_row(sheet_id, 1, true, None);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        gc.insert_row(sheet_id, 2, true, None);
        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((None, Some(2)), DEFAULT_ROW_HEIGHT);
        offsets.insert((None, Some(3)), 200.0);
        offsets.insert((None, Some(4)), DEFAULT_ROW_HEIGHT);
        offsets.insert((None, Some(5)), 400.0);
        expect_js_offsets(sheet_id, offsets, true);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), DEFAULT_ROW_HEIGHT);
        assert_eq!(sheet.offsets.row_height(3), 200.0);
        assert_eq!(sheet.offsets.row_height(5), 400.0);
    }

    #[test]
    #[serial]
    fn delete_row_offsets() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.delete_rows(sheet_id, vec![2, 3], None);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(3, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        gc.delete_rows(sheet_id, vec![2, 3], None);
        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((None, Some(2)), 400.0);
        offsets.insert((None, Some(3)), DEFAULT_ROW_HEIGHT);
        offsets.insert((None, Some(4)), DEFAULT_ROW_HEIGHT);
        expect_js_offsets(sheet_id, offsets, true);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), 400.0);
        assert_eq!(sheet.offsets.row_height(3), DEFAULT_ROW_HEIGHT);
    }
}
