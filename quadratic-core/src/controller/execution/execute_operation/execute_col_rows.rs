use itertools::Itertools;

use crate::{
    CellValue, CopyFormats, RefAdjust,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{GridBounds, SheetId},
};

use anyhow::{Result, bail};

impl GridController {
    fn adjust_code_cell_references(
        &self,
        transaction: &mut PendingTransaction,
        adjustments: &[RefAdjust],
    ) {
        for sheet in self.grid.sheets().values() {
            for (pos, _) in sheet.data_tables.expensive_iter_code_runs() {
                if let Some(CellValue::Code(code)) = sheet.cell_value_ref(pos) {
                    let sheet_pos = pos.to_sheet_pos(sheet.id);
                    let mut new_code = code.clone();
                    for &adj in adjustments {
                        new_code.adjust_references(
                            sheet_pos.sheet_id,
                            &self.a1_context,
                            sheet_pos,
                            adj,
                        );
                    }
                    if code.code != new_code.code {
                        transaction.operations.push_back(Operation::SetCellValues {
                            sheet_pos,
                            values: CellValue::Code(new_code).into(),
                        });
                        transaction
                            .operations
                            .push_back(Operation::ComputeCode { sheet_pos });
                    }
                }
            }
        }
    }

    fn handle_delete_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        columns: Vec<i64>,
        copy_formats: CopyFormats,
    ) {
        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            let min_column = *columns.iter().min().unwrap_or(&1);
            let mut columns_to_adjust = columns.clone();

            sheet.delete_columns(transaction, columns, copy_formats, &self.a1_context);

            if let Some(sheet) = self.try_sheet(sheet_id) {
                if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                    let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                    sheet_rect.min.x = min_column;

                    self.check_deleted_data_tables(transaction, &sheet_rect);
                    self.update_spills_in_sheet_rect(transaction, &sheet_rect);

                    if transaction.is_user() {
                        columns_to_adjust.sort_unstable();
                        columns_to_adjust.dedup();
                        columns_to_adjust.reverse();

                        self.adjust_code_cell_references(
                            transaction,
                            &columns_to_adjust
                                .iter()
                                .map(|&column| RefAdjust::new_delete_column(sheet_id, column))
                                .collect_vec(),
                        );
                        self.add_compute_operations(transaction, sheet_rect, None);
                    }
                }
            }
        }
    }

    pub fn execute_delete_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumn {
            sheet_id,
            column,
            copy_formats,
        } = op.clone()
        {
            self.handle_delete_columns(transaction, sheet_id, vec![column], copy_formats);
            transaction.forward_operations.push(op);
        }
    }

    pub fn execute_delete_columns(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumns {
            sheet_id,
            columns,
            copy_formats,
        } = op.clone()
        {
            self.handle_delete_columns(transaction, sheet_id, columns, copy_formats);
            transaction.forward_operations.push(op);
        }
    }

    #[allow(clippy::result_unit_err)]
    pub fn handle_delete_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        rows: Vec<i64>,
        copy_formats: CopyFormats,
    ) -> Result<()> {
        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            let min_row = *rows.iter().min().unwrap_or(&1);
            let mut rows_to_adjust = rows.clone();

            sheet.delete_rows(transaction, rows, copy_formats, &self.a1_context)?;

            if let Some(sheet) = self.try_sheet(sheet_id) {
                if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                    let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                    sheet_rect.min.y = min_row;

                    self.check_deleted_data_tables(transaction, &sheet_rect);
                    self.update_spills_in_sheet_rect(transaction, &sheet_rect);

                    if transaction.is_user() {
                        rows_to_adjust.sort_unstable();
                        rows_to_adjust.dedup();
                        rows_to_adjust.reverse();

                        self.adjust_code_cell_references(
                            transaction,
                            &rows_to_adjust
                                .iter()
                                .map(|&row| RefAdjust::new_delete_row(sheet_id, row))
                                .collect_vec(),
                        );
                        self.add_compute_operations(transaction, sheet_rect, None);
                    }
                }
            }
        }
        Ok(())
    }

    pub fn execute_delete_row(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DeleteRow {
            sheet_id,
            row,
            copy_formats,
        } = op.clone()
        {
            self.handle_delete_rows(transaction, sheet_id, vec![row], copy_formats)?;
            transaction.forward_operations.push(op);
            return Ok(());
        };

        bail!("Expected Operation::DeleteRow in execute_delete_row");
    }

    pub fn execute_delete_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DeleteRows {
            sheet_id,
            rows,
            copy_formats,
        } = op.clone()
        {
            self.handle_delete_rows(transaction, sheet_id, rows, copy_formats)?;
            transaction.forward_operations.push(op);
            return Ok(());
        };

        bail!("Expected Operation::DeleteRows in execute_delete_rows");
    }

    pub fn execute_insert_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertColumn {
            sheet_id,
            column,
            copy_formats,
        } = op
        {
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
                sheet.insert_column(transaction, column, copy_formats, &self.a1_context);

                transaction.forward_operations.push(op);
            } else {
                // nothing more can be done
                return;
            }

            if let Some(sheet) = self.try_sheet(sheet_id) {
                if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                    let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                    sheet_rect.min.x = column + 1;

                    self.check_deleted_data_tables(transaction, &sheet_rect);
                    self.update_spills_in_sheet_rect(transaction, &sheet_rect);

                    if transaction.is_user() {
                        self.adjust_code_cell_references(
                            transaction,
                            &[RefAdjust::new_insert_column(sheet_id, column)],
                        );
                        self.add_compute_operations(transaction, sheet_rect, None);
                    }
                }
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
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
                sheet.insert_row(transaction, row, copy_formats, &self.a1_context);

                transaction.forward_operations.push(op);
            } else {
                // nothing more can be done
                return;
            }

            if let Some(sheet) = self.try_sheet(sheet_id) {
                if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                    let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                    sheet_rect.min.y = row + 1;

                    self.check_deleted_data_tables(transaction, &sheet_rect);
                    self.update_spills_in_sheet_rect(transaction, &sheet_rect);

                    if transaction.is_user() {
                        self.adjust_code_cell_references(
                            transaction,
                            &[RefAdjust::new_insert_row(sheet_id, row)],
                        );

                        self.add_compute_operations(transaction, sheet_rect, None);
                    }
                }
            }
        }
    }

    pub fn execute_move_columns(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::MoveColumns {
            sheet_id,
            col_start,
            col_end,
            to,
        } = op.clone()
        {
            self.move_columns_action(transaction, sheet_id, col_start, col_end, to);
            transaction.forward_operations.push(op);
        }
    }

    pub fn execute_move_rows(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::MoveRows {
            sheet_id,
            row_start,
            row_end,
            to,
        } = op.clone()
        {
            self.move_rows_action(transaction, sheet_id, row_start, row_end, to);
            transaction.forward_operations.push(op);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use uuid::Uuid;

    use crate::{
        Array, CellValue, DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, Pos, Rect, SheetPos, SheetRect,
        Value,
        a1::A1Selection,
        cell_values::CellValues,
        grid::{
            CellsAccessed, CodeCellLanguage, CodeCellValue, CodeRun, DataTable, DataTableKind,
            sheet::validations::{rules::ValidationRule, validation::Validation},
        },
        test_create_gc,
        test_util::*,
        wasm_bindings::js::{clear_js_calls, expect_js_call_count, expect_js_offsets},
    };

    use super::*;

    #[test]
    fn adjust_code_cells_nothing() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let column = 1;
        let row = 1;
        gc.adjust_code_cell_references(
            &mut PendingTransaction::default(),
            &[RefAdjust::new_insert_column(sheet_id, column)],
        );
        gc.adjust_code_cell_references(
            &mut PendingTransaction::default(),
            &[RefAdjust::new_insert_row(sheet_id, row)],
        );
    }

    #[test]
    fn adjust_code_cells_formula() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        gc.add_sheet(Some("Other".to_string()), None, None);
        gc.set_cell_value(SheetPos::new(sheet_id, 2, 16), "1".into(), None);
        gc.set_cell_value(SheetPos::new(sheet_id, 2, 17), "2".into(), None);
        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Formula,
            "B$16 + $B17".into(),
            None,
            None,
        );
        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 2),
            CodeCellLanguage::Formula,
            "'Sheet 1'!F1+Other!F1 - Nonexistent!F1".into(),
            None,
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "3".to_string()
        );

        let single_formula = |formula_str: &str| {
            CellValues::from(CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: formula_str.to_string(),
            }))
        };

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cell_references(&mut transaction, &[RefAdjust::new_insert_row(sheet_id, 2)]);
        assert_eq!(
            &transaction.operations,
            &[
                // first formula, y += 1 for y >= 2
                Operation::SetCellValues {
                    sheet_pos: SheetPos::new(sheet_id, 1, 1),
                    values: single_formula("B$17 + $B18"),
                },
                Operation::ComputeCode {
                    sheet_pos: SheetPos::new(sheet_id, 1, 1)
                },
                // second formula doesn't change because all Y coordinates are < 2
                // so no operations needed
            ]
        );

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cell_references(
            &mut transaction,
            &[RefAdjust::new_insert_column(sheet_id, 5)],
        );
        assert_eq!(
            &transaction.operations,
            &[
                // first formula doesn't change because all X coordinates are < 5
                // so no operations needed
                //
                // second formula, x += 1 for x >= 5
                Operation::SetCellValues {
                    sheet_pos: SheetPos::new(sheet_id, 1, 2),
                    values: single_formula("'Sheet 1'!G1+Other!F1 - Nonexistent!F1"),
                },
                Operation::ComputeCode {
                    sheet_pos: SheetPos::new(sheet_id, 1, 2)
                },
            ]
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
            None,
        );

        let mut cells_accessed = CellsAccessed::default();
        cells_accessed.add_sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id));
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("B1:B2")"#.into(),
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
            Some(false),
            Some(false),
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
        gc.adjust_code_cell_references(&mut transaction, &[RefAdjust::new_insert_row(sheet_id, 2)]);
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
            None,
        );

        let mut cells_accessed = CellsAccessed::default();
        cells_accessed.add_sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id));

        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: r#"return q.cells("B1:B2");"#.into(),
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
            Some(false),
            Some(false),
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
        gc.adjust_code_cell_references(&mut transaction, &[RefAdjust::new_insert_row(sheet_id, 2)]);
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
    fn test_execute_insert_column() {
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
        gc.insert_columns(sheet_id, 3, 1, true, None);

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
        gc.insert_rows(sheet_id, 3, 1, true, None);

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
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.delete_rows(sheet_id, vec![2], None);

        // rerun the code cell to get the new value
        gc.rerun_code_cell(A1Selection::test_a1_context("A1", gc.a1_context()), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.undo(None);
        gc.rerun_code_cell(A1Selection::test_a1_context("A1", gc.a1_context()), None);

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
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.delete_rows(sheet_id, vec![2], None);

        // rerun the code cell to get the new value
        gc.rerun_code_cell(A1Selection::test_a1_context("A1", gc.a1_context()), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.undo(None);
        gc.rerun_code_cell(A1Selection::test_a1_context("A1", gc.a1_context()), None);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );
    }

    #[test]
    fn delete_columns_rows_formulas() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            pos![sheet_id!J10], // 10,10
            CodeCellLanguage::Formula,
            "$F6".into(),
            None,
            None,
        );

        gc.delete_columns(sheet_id, vec![1, 3, 4, 5], None);
        gc.delete_rows(sheet_id, vec![2, 7, 8], None);

        assert_eq!(
            gc.sheet(sheet_id).cell_value(pos![F7]).unwrap(), // 6,10
            CellValue::Code(CodeCellValue {
                language: CodeCellLanguage::Formula,
                code: "$B5".to_owned(),
            })
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

        gc.insert_columns(sheet_id, 2, 1, true, None);

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

        gc.insert_rows(sheet_id, 2, 1, true, None);

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

        gc.insert_columns(sheet_id, 1, 1, true, None);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        gc.insert_columns(sheet_id, 2, 1, true, None);
        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((Some(3), None), 200.0);
        offsets.insert((Some(4), None), DEFAULT_COLUMN_WIDTH);
        offsets.insert((Some(5), None), 400.0);
        expect_js_offsets(sheet_id, offsets, true);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), 200.0);
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

        gc.insert_rows(sheet_id, 1, 1, true, None);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        gc.insert_rows(sheet_id, 2, 1, true, None);
        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((None, Some(3)), 200.0);
        offsets.insert((None, Some(4)), DEFAULT_ROW_HEIGHT);
        offsets.insert((None, Some(5)), 400.0);
        expect_js_offsets(sheet_id, offsets, true);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), 200.0);
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
    fn test_delete_rows_chart() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_html_chart(&mut gc, sheet_id, pos![B2], 3, 3);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);

        gc.delete_rows(sheet_id, vec![3], None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 2, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 2, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);
    }

    #[test]
    fn test_delete_bottom_rows_chart() {
        // tests for adjust_chart_size in rows_delete_table.rs#delete_table_rows()
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_js_chart(&mut gc, sheet_id, pos![B2], 3, 3);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);

        // deletes the bottom tow rows of the chart
        gc.delete_rows(sheet_id, vec![3, 4], None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 1, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);
    }

    #[test]
    fn test_insert_col_next_to_code() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let table = test_create_code_table(&mut gc, sheet_id, pos![C2], 2, 2);

        gc.insert_columns(sheet_id, 3, 1, false, None);

        assert_eq!(&table, gc.data_table_at(pos![sheet_id!d2]).unwrap());
        assert_data_table_eq(&gc, pos![sheet_id!d2], &table);
    }

    #[test]
    fn test_insert_column_before_data_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let _table = test_create_data_table(&mut gc, sheet_id, pos![C2], 2, 2);

        print_first_sheet(&gc);
        gc.insert_columns(sheet_id, 3, 1, false, None);

        // todo: this should be correct
        // assert_data_table_eq(&gc, pos![sheet_id!d2], &table);

        // this is what happens (for now)
        assert_data_table_size(&gc, sheet_id, pos![c2], 3, 2, false);
    }
}
