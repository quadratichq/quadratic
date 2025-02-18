use crate::{
    a1::{A1Context, CellRefRange, CellRefRangeEnd, UNBOUNDED},
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    formulas::replace_cell_references_with,
    grid::{CodeCellLanguage, CodeCellValue, GridBounds, SheetId},
    CellValue, SheetPos,
};

impl GridController {
    pub fn adjust_formula_column_row(
        code_cell: &CodeCellValue,
        parse_ctx: &A1Context,
        code_cell_pos: SheetPos,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) -> String {
        if let Some(column) = column {
            replace_cell_references_with(
                &code_cell.code,
                parse_ctx,
                code_cell_pos,
                |sheet_id, cell_ref| CellRefRangeEnd {
                    col: if sheet_id == code_cell_pos.sheet_id
                        && cell_ref.col.coord >= column
                        && cell_ref.col.coord < UNBOUNDED
                    {
                        cell_ref.col + delta
                    } else {
                        cell_ref.col
                    },
                    row: cell_ref.row,
                },
            )
        } else if let Some(row) = row {
            replace_cell_references_with(
                &code_cell.code,
                parse_ctx,
                code_cell_pos,
                |sheet_id, cell_ref| CellRefRangeEnd {
                    col: cell_ref.col,
                    row: if sheet_id == code_cell_pos.sheet_id
                        && cell_ref.row.coord >= row
                        && cell_ref.row.coord < UNBOUNDED
                    {
                        cell_ref.row + delta
                    } else {
                        cell_ref.row
                    },
                },
            )
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
                        let ref_range_bounds = match cells_range {
                            CellRefRange::Sheet { range } => range,
                            CellRefRange::Table { .. } => continue,
                        };
                        let cells_rect = sheet.ref_range_bounds_to_rect(ref_range_bounds);

                        if cells_rect.max.x < column.unwrap_or(UNBOUNDED)
                            && cells_rect.max.y < row.unwrap_or(UNBOUNDED)
                        {
                            continue;
                        }

                        if let Some(CellValue::Code(code)) = sheet.cell_value_ref(pos) {
                            let new_code = match code.language {
                                CodeCellLanguage::Formula => {
                                    let pos = pos.to_sheet_pos(sheet.id);
                                    GridController::adjust_formula_column_row(
                                        code,
                                        self.a1_context(),
                                        pos,
                                        column,
                                        row,
                                        delta,
                                    )
                                }
                                _ => {
                                    let mut new_code = code.clone();
                                    let context = self.a1_context();
                                    new_code.adjust_code_cell_column_row(
                                        column, row, delta, &sheet_id, context,
                                    );
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

                transaction
                    .operations
                    .extend(self.check_chart_delete_col_operations(sheet_id, column as u32));

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

            self.send_updated_bounds(transaction, sheet_id);
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

                transaction
                    .operations
                    .extend(self.check_chart_delete_row_operations(sheet_id, row as u32));

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

            self.send_updated_bounds(transaction, sheet_id);
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
                sheet.insert_column(transaction, column, copy_formats, true);
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

                transaction
                    .operations
                    .extend(self.check_chart_insert_col_operations(sheet_id, column as u32));

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

            self.send_updated_bounds(transaction, sheet_id);
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
                sheet.insert_row(transaction, row, copy_formats, true);
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

                transaction
                    .operations
                    .extend(self.check_chart_insert_row_operations(sheet_id, row as u32));

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

            self.send_updated_bounds(transaction, sheet_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use uuid::Uuid;

    use crate::{
        a1::A1Selection,
        grid::{
            sheet::validations::{validation::Validation, validation_rules::ValidationRule},
            CellsAccessed, CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind,
        },
        wasm_bindings::js::{clear_js_calls, expect_js_call_count, expect_js_offsets},
        Array, CellValue, Pos, Rect, SheetPos, SheetRect, Value, DEFAULT_COLUMN_WIDTH,
        DEFAULT_ROW_HEIGHT,
    };

    use super::*;

    #[test]
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
                    code: "B1 + B3".to_string()
                })
                .into(),
            }
        );
    }

    #[test]
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
            r#"q.cells("B1:B2")"#.into(),
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
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "test",
            Value::Array(Array::from(vec![vec!["3"]])),
            false,
            false,
            false,
            None,
        );
        let transaction = &mut PendingTransaction::default();
        gc.finalize_data_table(transaction, sheet_pos, Some(data_table), None);

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
                    code: r#"q.cells("B1:B3")"#.to_string()
                })
                .into(),
            }
        );
    }

    #[test]
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
            r#"return q.cells("B1:B2");"#.into(),
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
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run),
            "test",
            Value::Array(Array::from(vec![vec!["3"]])),
            false,
            false,
            false,
            None,
        );
        let transaction = &mut PendingTransaction::default();
        gc.finalize_data_table(transaction, sheet_pos, Some(data_table), None);

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
                    code: r#"return q.cells("B1:B3");"#.to_string()
                })
                .into(),
            }
        );
    }

    #[test]
    fn execute_insert_column() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["A".into(), "B".into(), "C".into()]],
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
    fn execute_insert_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["A".into()], vec!["B".into()], vec!["C".into()]],
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
    fn delete_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![vec!["A".into(), "B".into(), "C".into(), "D".into()]],
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
    fn test_delete_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos {
                x: 1,
                y: 1,
                sheet_id,
            },
            vec![
                vec!["A".into()],
                vec!["B".into()],
                vec!["C".into()],
                vec!["D".into()],
            ],
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

    #[test]
    fn test_insert_delete_chart() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.test_set_chart(pos![A1], 3, 3);
        sheet.test_set_chart(pos![B5], 3, 3);

        gc.insert_column(sheet_id, 3, true, None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.data_table(pos![A1]).unwrap().chart_output.unwrap(),
            (4, 3)
        );
        assert_eq!(
            sheet.data_table(pos![B5]).unwrap().chart_output.unwrap(),
            (4, 3)
        );

        gc.undo(None);

        let sheet = gc.sheet(sheet_id);
        let dt = sheet.data_table(pos![A1]).unwrap();
        assert_eq!(dt.chart_output.unwrap(), (3, 3));
        let dt_2 = sheet.data_table(pos![B5]).unwrap();
        assert_eq!(dt_2.chart_output.unwrap(), (3, 3));

        gc.insert_row(sheet_id, 3, true, None);

        let sheet = gc.sheet(sheet_id);
        let dt = sheet.data_table(pos![A1]).unwrap();
        assert_eq!(dt.chart_output.unwrap(), (3, 4));
        let dt_2 = sheet.data_table(pos![B6]).unwrap();
        assert_eq!(dt_2.chart_output.unwrap(), (3, 3));

        gc.undo(None);
        let sheet = gc.sheet(sheet_id);
        let dt = sheet.data_table(pos![A1]).unwrap();
        assert_eq!(dt.chart_output.unwrap(), (3, 3));
        let dt_2 = sheet.data_table(pos![B5]).unwrap();
        assert_eq!(dt_2.chart_output.unwrap(), (3, 3));
    }
}
