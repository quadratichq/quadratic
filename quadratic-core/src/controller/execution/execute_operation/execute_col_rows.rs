use itertools::Itertools;

use crate::{
    CellValue, CopyFormats, RefAdjust, Value,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{DataTableKind, GridBounds, SheetId, data_table::DataTable},
};

use anyhow::{Result, bail};

impl GridController {
    fn adjust_code_cell_references(
        &self,
        transaction: &mut PendingTransaction,
        adjustments: &[RefAdjust],
    ) {
        for sheet in self.grid.sheets().values() {
            // Check DataTables
            for (data_table_pos, data_table) in sheet.data_tables.expensive_iter() {
                if let Some(code_run) = data_table.code_run() {
                    let sheet_pos = data_table_pos.to_sheet_pos(sheet.id);
                    let mut new_code_run = code_run.clone();
                    for &adj in adjustments {
                        new_code_run.adjust_references(
                            sheet_pos.sheet_id,
                            &self.a1_context,
                            sheet_pos,
                            adj,
                        );
                    }
                    if code_run.code != new_code_run.code {
                        let mut data_table = data_table.clone();
                        data_table.kind = DataTableKind::CodeRun(new_code_run);
                        transaction.operations.push_back(Operation::SetDataTable {
                            sheet_pos,
                            data_table: Some(data_table),
                            index: usize::MAX,
                            ignore_old_data_table: true,
                        });
                        transaction
                            .operations
                            .push_back(Operation::ComputeCode { sheet_pos });
                    }
                }
            }

            // Check CellValue::Code cells
            for pos in sheet.iter_code_cells_positions() {
                if let Some(CellValue::Code(code_cell)) = sheet.cell_value_ref(pos) {
                    let sheet_pos = pos.to_sheet_pos(sheet.id);
                    let mut new_code_run = code_cell.code_run.clone();
                    for &adj in adjustments {
                        new_code_run.adjust_references(
                            sheet_pos.sheet_id,
                            &self.a1_context,
                            sheet_pos,
                            adj,
                        );
                    }
                    if code_cell.code_run.code != new_code_run.code {
                        // Convert to DataTable for the operation (will be converted back after execution if qualifies)
                        let data_table = DataTable::new(
                            DataTableKind::CodeRun(new_code_run),
                            &format!("{}1", code_cell.code_run.language.as_string()),
                            Value::Single((*code_cell.output).clone()),
                            false,
                            None,
                            None,
                            None,
                        )
                        .with_last_modified(code_cell.last_modified);
                        transaction.operations.push_back(Operation::SetDataTable {
                            sheet_pos,
                            data_table: Some(data_table),
                            index: usize::MAX,
                            ignore_old_data_table: true,
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
        ignore_tables: bool,
        copy_formats: CopyFormats,
    ) {
        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            let min_column = *columns.iter().min().unwrap_or(&1);
            let mut columns_to_adjust = columns.clone();

            sheet.delete_columns(
                transaction,
                columns,
                ignore_tables,
                copy_formats,
                &self.a1_context,
            );

            if let Some(sheet) = self.try_sheet(sheet_id)
                && let GridBounds::NonEmpty(bounds) = sheet.bounds(true)
            {
                let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                sheet_rect.min.x = min_column;

                self.update_spills_in_sheet_rect(transaction, &sheet_rect);

                if transaction.is_user_ai() {
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

    pub fn execute_delete_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumn {
            sheet_id,
            column,
            ignore_tables,
            copy_formats,
        } = op.clone()
        {
            self.handle_delete_columns(
                transaction,
                sheet_id,
                vec![column],
                ignore_tables,
                copy_formats,
            );
            transaction.forward_operations.push(op);
        }
    }

    pub fn execute_delete_columns(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::DeleteColumns {
            sheet_id,
            columns,
            ignore_tables,
            copy_formats,
        } = op.clone()
        {
            self.handle_delete_columns(transaction, sheet_id, columns, ignore_tables, copy_formats);
            transaction.forward_operations.push(op);
        }
    }

    #[allow(clippy::result_unit_err)]
    pub fn handle_delete_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        rows: Vec<i64>,
        ignore_tables: bool,
        copy_formats: CopyFormats,
    ) -> Result<()> {
        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            let min_row = *rows.iter().min().unwrap_or(&1);
            let mut rows_to_adjust = rows.clone();

            sheet.delete_rows(
                transaction,
                rows,
                ignore_tables,
                copy_formats,
                &self.a1_context,
            )?;

            if let Some(sheet) = self.try_sheet(sheet_id)
                && let GridBounds::NonEmpty(bounds) = sheet.bounds(true)
            {
                let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                sheet_rect.min.y = min_row;

                self.update_spills_in_sheet_rect(transaction, &sheet_rect);

                if transaction.is_user_ai() {
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
            ignore_tables,
            copy_formats,
        } = op.clone()
        {
            self.handle_delete_rows(
                transaction,
                sheet_id,
                vec![row],
                ignore_tables,
                copy_formats,
            )?;
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
            ignore_tables,
            copy_formats,
        } = op.clone()
        {
            self.handle_delete_rows(transaction, sheet_id, rows, ignore_tables, copy_formats)?;
            transaction.forward_operations.push(op);
            return Ok(());
        };

        bail!("Expected Operation::DeleteRows in execute_delete_rows");
    }

    pub fn execute_insert_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertColumn {
            sheet_id,
            column,
            ignore_tables,
            copy_formats,
        } = op
        {
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
                sheet.insert_column(
                    transaction,
                    column,
                    copy_formats,
                    ignore_tables,
                    &self.a1_context,
                );

                transaction.forward_operations.push(op);
            } else {
                // nothing more can be done
                return;
            }

            if let Some(sheet) = self.try_sheet(sheet_id)
                && let GridBounds::NonEmpty(bounds) = sheet.bounds(true)
            {
                let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                sheet_rect.min.x = column + 1;

                self.update_spills_in_sheet_rect(transaction, &sheet_rect);

                if transaction.is_user_ai() {
                    self.adjust_code_cell_references(
                        transaction,
                        &[RefAdjust::new_insert_column(sheet_id, column)],
                    );
                    self.add_compute_operations(transaction, sheet_rect, None);
                }
            }
        }
    }

    pub fn execute_insert_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::InsertRow {
            sheet_id,
            row,
            ignore_tables,
            copy_formats,
        } = op
        {
            if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
                sheet.insert_row(
                    transaction,
                    row,
                    ignore_tables,
                    copy_formats,
                    &self.a1_context,
                );

                transaction.forward_operations.push(op);
            } else {
                // nothing more can be done
                return;
            }

            if let Some(sheet) = self.try_sheet(sheet_id)
                && let GridBounds::NonEmpty(bounds) = sheet.bounds(true)
            {
                let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                sheet_rect.min.y = row + 1;

                self.update_spills_in_sheet_rect(transaction, &sheet_rect);

                if transaction.is_user_ai() {
                    self.adjust_code_cell_references(
                        transaction,
                        &[RefAdjust::new_insert_row(sheet_id, row)],
                    );

                    self.add_compute_operations(transaction, sheet_rect, None);
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

    use crate::{
        Array, CellValue, DEFAULT_COLUMN_WIDTH, DEFAULT_ROW_HEIGHT, Pos, Rect, SheetPos, SheetRect,
        Value, a1::A1Selection,
        grid::{
            CellsAccessed, CodeCellLanguage, CodeRun, DataTable, DataTableKind,
            sheet::validations::{rules::ValidationRule, validation::ValidationUpdate},
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
        gc.add_sheet(Some("Other".to_string()), None, None, false);
        gc.set_cell_value(SheetPos::new(sheet_id, 2, 16), "1".into(), None, false);
        gc.set_cell_value(SheetPos::new(sheet_id, 2, 17), "2".into(), None, false);
        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Formula,
            "B$16 + $B17".into(),
            None,
            None,
            false,
        );
        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 2),
            CodeCellLanguage::Formula,
            "'Sheet1'!F1+Other!F1 - Nonexistent!F1".into(),
            None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "3".to_string()
        );

        // 1x1 formulas are now stored as CellValue::Code, not DataTable
        let CellValue::Code(code_cell) = sheet.cell_value_ref(pos![A1]).unwrap().clone() else {
            panic!("Expected CellValue::Code at A1");
        };
        let old_code_run = code_cell.code_run.clone();

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cell_references(&mut transaction, &[RefAdjust::new_insert_row(sheet_id, 2)]);

        // The operation converts CellValue::Code to DataTable for the SetDataTable operation
        assert_eq!(transaction.operations.len(), 2);
        let Some(Operation::SetDataTable {
            sheet_pos,
            data_table: Some(data_table),
            index,
            ignore_old_data_table,
        }) = transaction.operations.front()
        else {
            panic!("Expected SetDataTable operation");
        };
        assert_eq!(*sheet_pos, pos![sheet_id!A1]);
        assert_eq!(*index, usize::MAX);
        assert!(*ignore_old_data_table);
        let Some(code_run) = data_table.code_run() else {
            panic!("Expected CodeRun in DataTable");
        };
        assert_eq!(code_run.language, CodeCellLanguage::Formula);
        assert_eq!(code_run.code, "B$17 + $B18");
        assert!(code_run.formula_ast.is_none()); // formula_ast is cleared when code is adjusted
        assert_eq!(code_run.cells_accessed, old_code_run.cells_accessed);

        assert_eq!(
            transaction.operations.get(1),
            Some(&Operation::ComputeCode {
                sheet_pos: SheetPos::new(sheet_id, 1, 1)
            })
        );

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cell_references(
            &mut transaction,
            &[RefAdjust::new_insert_column(sheet_id, 5)],
        );

        let Operation::SetDataTable {
            data_table:
                Some(DataTable {
                    kind: DataTableKind::CodeRun(code_run),
                    ..
                }),
            ..
        } = &transaction.operations[0]
        else {
            panic!("Expected DataTableKind::CodeRun");
        };
        // first formula doesn't change because all X coordinates are < 5
        // so no operations needed
        //
        // second formula, x += 1 for x >= 5
        assert_eq!(code_run.code, "Sheet1!G1+Other!F1 - Nonexistent!F1");
        assert_eq!(
            &transaction.operations[1],
            &Operation::ComputeCode {
                sheet_pos: SheetPos::new(sheet_id, 1, 2)
            }
        );
        assert_eq!(transaction.operations.len(), 2);
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
            false,
        );
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 2,
                y: 2,
            },
            "2".into(),
            None,
            false,
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
            false,
        );

        let mut cells_accessed = CellsAccessed::default();
        cells_accessed.add_sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id));
        let code_run = CodeRun {
            language: CodeCellLanguage::Python,
            code: r#"q.cells("B1:B2")"#.into(),
            formula_ast: None,
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run.clone()),
            "test",
            Value::Array(Array::from(vec![vec!["3"]])),
            false,
            Some(false),
            Some(false),
            None,
        );
        let transaction = &mut PendingTransaction::default();
        gc.finalize_data_table(transaction, sheet_pos, Some(data_table), None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "3".to_string()
        );

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cell_references(&mut transaction, &[RefAdjust::new_insert_row(sheet_id, 2)]);
        assert_eq!(transaction.operations.len(), 2);
        let Operation::SetDataTable { data_table, .. } = &transaction.operations[0] else {
            panic!("Expected SetDataTable");
        };
        assert_eq!(
            data_table.as_ref().unwrap().kind,
            DataTableKind::CodeRun(CodeRun {
                code: "q.cells(\"B1:B3\")".to_string(),
                ..code_run
            })
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
            false,
        );
        gc.set_cell_value(
            SheetPos {
                sheet_id,
                x: 2,
                y: 2,
            },
            "2".into(),
            None,
            false,
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
            false,
        );

        let mut cells_accessed = CellsAccessed::default();
        cells_accessed.add_sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id));

        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: r#"return q.cells("B1:B2");"#.into(),
            formula_ast: None,
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed,
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run.clone()),
            "test",
            Value::Array(Array::from(vec![vec!["3"]])),
            false,
            Some(false),
            Some(false),
            None,
        );
        let transaction = &mut PendingTransaction::default();
        gc.finalize_data_table(
            transaction,
            sheet_pos,
            Some(data_table.clone()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "3".to_string()
        );

        let mut transaction = PendingTransaction::default();
        gc.adjust_code_cell_references(&mut transaction, &[RefAdjust::new_insert_row(sheet_id, 2)]);
        assert_eq!(transaction.operations.len(), 2);
        let expected_code_run = CodeRun {
            code: r#"return q.cells("B1:B3");"#.to_string(),
            ..code_run
        };
        let Operation::SetDataTable { data_table, .. } = &transaction.operations[0] else {
            panic!("Expected SetDataTable");
        };
        assert_eq!(
            data_table.as_ref().unwrap().kind,
            DataTableKind::CodeRun(expected_code_run)
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
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 3, 1))
        );
        gc.insert_columns(sheet_id, 3, 1, true, None, false);

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
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 1, 3))
        );
        gc.insert_rows(sheet_id, 3, 1, true, None, false);

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
            false,
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
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.delete_rows(sheet_id, vec![2], None, false);

        // rerun the code cell to get the new value
        gc.rerun_code_cell(
            A1Selection::test_a1_context("A1", gc.a1_context()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.undo(1, None, false);
        gc.rerun_code_cell(
            A1Selection::test_a1_context("A1", gc.a1_context()),
            None,
            false,
        );

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
            false,
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
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.delete_rows(sheet_id, vec![2], None, false);

        // rerun the code cell to get the new value
        gc.rerun_code_cell(
            A1Selection::test_a1_context("A1", gc.a1_context()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );

        gc.undo(1, None, false);
        gc.rerun_code_cell(
            A1Selection::test_a1_context("A1", gc.a1_context()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.rendered_value(Pos { x: 1, y: 1 }).unwrap(),
            "1".to_string()
        );
    }

    #[test]
    fn delete_columns_rows_formulas() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        gc.set_code_cell(
            pos![sheet_id!J10], // 10,10
            CodeCellLanguage::Formula,
            "$F6".into(),
            None,
            None,
            false,
        );

        gc.delete_columns(sheet_id, vec![1, 3, 4, 5], None, false);
        gc.delete_rows(sheet_id, vec![2, 7, 8], None, false);

        assert_code_language(
            &gc,
            pos![sheet_id!F7],
            CodeCellLanguage::Formula,
            "$B5".to_string(),
        );
    }

    #[test]
    fn insert_column_validation() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.update_validation(
            ValidationUpdate {
                id: None,
                selection: A1Selection::test_a1("A1:C3,B"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
            false,
        );

        gc.insert_columns(sheet_id, 2, 1, true, None, false);

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
            ValidationUpdate {
                id: None,
                selection: A1Selection::test_a1("A1:C3,2"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
            false,
        );

        gc.insert_rows(sheet_id, 2, 1, true, None, false);

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
            ValidationUpdate {
                id: None,
                selection: A1Selection::test_a1("A1:C3,B"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
            false,
        );

        gc.delete_columns(sheet_id, vec![2], None, false);

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
            ValidationUpdate {
                id: None,
                selection: A1Selection::test_a1("A1:C3,2"),
                rule: ValidationRule::Logical(Default::default()),
                message: Default::default(),
                error: Default::default(),
            },
            None,
            false,
        );

        gc.delete_rows(sheet_id, vec![2], None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.validations.validations.len(), 1);
        assert_eq!(
            sheet.validations.validations[0].selection,
            A1Selection::test_a1("A1:C2")
        );
    }

    #[test]
    fn test_content_delete_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            pos![sheet_id!A1],
            vec![vec!["A".into(), "B".into(), "C".into(), "D".into()]],
            None,
            false,
        );

        gc.delete_columns(sheet_id, vec![2, 3], None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 2, 1))
        );

        gc.undo(1, None, false);
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
            false,
        );

        gc.delete_rows(sheet_id, vec![2, 3], None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.bounds(false),
            GridBounds::NonEmpty(Rect::new(1, 1, 1, 2))
        );

        gc.undo(1, None, false);
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

        gc.insert_columns(sheet_id, 1, 1, true, None, false);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        gc.insert_columns(sheet_id, 2, 1, true, None, false);
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

        gc.delete_columns(sheet_id, vec![2], None, false);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        gc.delete_columns(sheet_id, vec![2], None, false);
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

        gc.insert_rows(sheet_id, 1, 1, true, None, false);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        gc.insert_rows(sheet_id, 2, 1, true, None, false);
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

        gc.delete_rows(sheet_id, vec![2, 3], None, false);
        expect_js_call_count("jsOffsetsModified", 0, true);

        let sheet = gc.sheet_mut(sheet_id);
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(3, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        gc.delete_rows(sheet_id, vec![2, 3], None, false);
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

        gc.delete_rows(sheet_id, vec![3], None, false);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 2, false);

        gc.undo(1, None, false);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);

        gc.redo(1, None, false);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 2, false);

        gc.undo(1, None, false);
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
        gc.delete_rows(sheet_id, vec![3, 4], None, false);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 1, false);

        gc.undo(1, None, false);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);
    }

    #[test]
    fn test_insert_col_next_to_code() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let table = test_create_code_table(&mut gc, sheet_id, pos![C2], 2, 2);

        gc.insert_columns(sheet_id, 3, 1, false, None, false);

        assert_eq!(&table, gc.data_table_at(pos![sheet_id!d2]).unwrap());
        assert_data_table_eq(&gc, pos![sheet_id!d2], &table);
    }

    #[test]
    fn test_insert_column_before_data_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![C2], 2, 2);

        gc.insert_columns(sheet_id, 3, 1, false, None, false);

        assert_data_table_size(&gc, sheet_id, pos![c2], 3, 2, false);
    }
}
