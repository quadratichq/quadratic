use std::collections::HashSet;

use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{formats::Formats, Sheet},
    renderer_constants::CELL_SHEET_HEIGHT,
    selection::Selection,
    Pos, SheetPos,
};

use super::MAX_OPERATION_SIZE_COL_ROW;

impl Sheet {
    // create reverse operations for values in the column broken up by MAX_OPERATION_SIZE
    fn values_ops_for_column(&self, column: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        if let Some((min, max)) = self.column_bounds(column, true) {
            let mut current_min = min;
            while current_min <= max {
                let current_max = (current_min + MAX_OPERATION_SIZE_COL_ROW).min(max);
                let mut values = CellValues::new(1, (current_max - current_min) as u32 + 1);

                if let Some(col) = self.columns.get(&column) {
                    for y in current_min..=current_max {
                        if let Some(cell_value) = col.values.get(&y) {
                            values.set(0, (y - current_min) as u32, cell_value.clone());
                        }
                    }
                }
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: crate::SheetPos::new(self.id, column, min),
                    values,
                });
                current_min = current_max + 1;
            }
        }

        reverse_operations
    }

    /// Creates reverse operations for cell formatting within the column.
    fn formats_ops_for_column(&self, column: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();
        // create reverse operations for column formatting broken up by MAX_OPERATION_SIZE
        if let Some(range) = self.columns.get(&column).and_then(|c| c.format_range()) {
            let mut current_min = range.start;
            while current_min <= range.end {
                let current_max = (current_min + MAX_OPERATION_SIZE_COL_ROW).min(range.end);
                let mut formats = Formats::new();

                for y in current_min..=current_max {
                    let format = self.format_cell(column, y, false).to_replace();
                    formats.push(format);
                }

                current_min = current_max + 1;

                reverse_operations.push(Operation::SetCellFormatsSelection {
                    selection: Selection::columns(&[column], self.id),
                    formats,
                });
            }
        }
        reverse_operations
    }

    /// Creates reverse operations for code runs within the column.
    fn code_runs_for_column(&self, column: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        self.code_runs
            .iter()
            .enumerate()
            .for_each(|(index, (pos, code_run))| {
                if pos.x == column {
                    reverse_operations.push(Operation::SetCodeRun {
                        sheet_pos: SheetPos::new(self.id, pos.x, pos.y),
                        code_run: Some(code_run.clone()),
                        index,
                    });
                }
            });

        reverse_operations
    }

    /// Deletes columns and returns the operations to undo the deletion.
    pub fn delete_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
    ) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        // create undo operations for the deleted column (only when needed since
        // it's a bit expensive)
        if transaction.is_user_undo_redo() {
            reverse_operations.extend(self.values_ops_for_column(column));
            reverse_operations.extend(self.formats_ops_for_column(column));
            reverse_operations.extend(self.code_runs_for_column(column));
            reverse_operations.extend(self.borders.get_column_ops(self.id, column));

            // create reverse operation for column-based formatting
            if let Some(format) = self.try_format_column(column) {
                reverse_operations.push(Operation::SetCellFormatsSelection {
                    selection: Selection::columns(&[column], self.id),
                    formats: Formats::repeat(format.to_replace(), 1),
                });
            }

            // reverse operation to create the column (this will also shift all impacted columns)
            reverse_operations.push(Operation::InsertColumn {
                sheet_id: self.id,
                column,
            });
        }

        let mut updated_cols = HashSet::new();

        // remove the column's data from the sheet
        if self.columns.contains_key(&column) {
            self.columns.remove(&column);
            updated_cols.insert(column);
        }

        // remove the column's code runs from the sheet
        self.code_runs.retain(|pos, code_run| {
            if pos.x == column {
                transaction.add_code_cell(self.id, *pos);

                // signal that html and image cells are removed
                if code_run.is_html() {
                    transaction.add_html_cell(self.id, *pos);
                } else if code_run.is_image() {
                    transaction.add_image_cell(self.id, *pos);
                }
                false
            } else {
                true
            }
        });

        // remove the column's formats from the sheet
        if self.formats_columns.contains_key(&column) {
            self.formats_columns.remove(&column);
            updated_cols.insert(column);
        }

        // remove the column's borders from the sheet
        if self.borders.remove_column(column) {
            transaction.sheet_borders.insert(self.id);
        }

        // update the indices of all columns impacted by the deletion
        let mut columns_to_update = Vec::new();
        for col in self.columns.keys() {
            if *col > column {
                columns_to_update.push(*col);
            }
        }
        for col in columns_to_update {
            if let Some(mut column_data) = self.columns.remove(&col) {
                column_data.x -= 1;
                if !column_data.fill_color.is_empty() {
                    transaction.fill_cells.insert(self.id);
                }
                self.columns.insert(col - 1, column_data);
                updated_cols.insert(col - 1);
            }
        }

        // update the indices of all code_runs impacted by the deletion
        let mut code_runs_to_move = Vec::new();
        for (pos, _) in self.code_runs.iter() {
            if pos.x > column {
                code_runs_to_move.push(*pos);
            }
        }
        for old_pos in code_runs_to_move {
            if let Some(code_run) = self.code_runs.shift_remove(&old_pos) {
                let new_pos = Pos {
                    x: old_pos.x - 1,
                    y: old_pos.y,
                };

                // signal html and image cells to update
                if code_run.is_html() {
                    transaction.add_html_cell(self.id, old_pos);
                    transaction.add_html_cell(self.id, new_pos);
                } else if code_run.is_image() {
                    transaction.add_image_cell(self.id, old_pos);
                    transaction.add_image_cell(self.id, new_pos);
                }

                self.code_runs.insert(new_pos, code_run);

                // signal client to update the code runs
                transaction.add_code_cell(self.id, old_pos);
                transaction.add_code_cell(self.id, new_pos);
            }
        }

        // update the indices of all column-based formats impacted by the deletion
        let mut formats_to_update = Vec::new();
        for col in self.formats_columns.keys() {
            if *col > column {
                formats_to_update.push(*col);
            }
        }
        for col in formats_to_update {
            if let Some(format) = self.formats_columns.remove(&col) {
                self.formats_columns.insert(col - 1, format);
                updated_cols.insert(col - 1);
            }
        }

        // send the value hashes that have changed to the client
        let dirty_hashes = transaction
            .dirty_hashes
            .entry(self.id)
            .or_insert_with(HashSet::new);
        updated_cols.iter().for_each(|col| {
            if let Some((start, end)) = self.column_bounds(*col, false) {
                for y in (start..=end).step_by(CELL_SHEET_HEIGHT as usize) {
                    let mut pos = Pos { x: *col, y };
                    pos.to_quadrant();
                    dirty_hashes.insert(pos);
                }
            }
        });

        reverse_operations.extend(self.validations.remove_column(column));

        reverse_operations
    }

    pub fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
    ) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        // create undo operations for the inserted column
        if transaction.is_user_undo_redo() {
            // reverse operation to delete the column (this will also shift all impacted columns)
            reverse_operations.push(Operation::DeleteColumn {
                sheet_id: self.id,
                column,
            });
        }

        let mut updated_cols = HashSet::new();

        // update the indices of all columns impacted by the insertion
        let mut columns_to_update = Vec::new();
        for col in self.columns.keys() {
            if *col >= column {
                columns_to_update.push(*col);
            }
        }
        columns_to_update.reverse();
        for col in columns_to_update {
            if let Some(mut column_data) = self.columns.remove(&col) {
                column_data.x += 1;
                self.columns.insert(col + 1, column_data);
                updated_cols.insert(col + 1);
            }
        }

        // update the indices of all code_runs impacted by the insertion
        let mut code_runs_to_move = Vec::new();
        for (pos, _) in self.code_runs.iter() {
            if pos.x >= column {
                code_runs_to_move.push(*pos);
            }
        }
        code_runs_to_move.reverse();
        for old_pos in code_runs_to_move {
            let new_pos = Pos {
                x: old_pos.x + 1,
                y: old_pos.y,
            };
            if let Some(code_run) = self.code_runs.shift_remove(&old_pos) {
                // signal html and image cells to update
                if code_run.is_html() {
                    transaction.add_html_cell(self.id, old_pos);
                    transaction.add_html_cell(self.id, new_pos);
                } else if code_run.is_image() {
                    transaction.add_image_cell(self.id, old_pos);
                    transaction.add_image_cell(self.id, new_pos);
                }

                self.code_runs.insert(new_pos, code_run);

                // signal the client to updates to the code cells (to draw the code arrays)
                transaction.add_code_cell(self.id, old_pos);
                transaction.add_code_cell(self.id, new_pos);
            }
        }

        // update the indices of all column-based formats impacted by the deletion
        let mut formats_to_update = Vec::new();
        for col in self.formats_columns.keys() {
            if *col > column {
                formats_to_update.push(*col);
            }
        }
        formats_to_update.reverse();
        for col in formats_to_update {
            if let Some(format) = self.formats_columns.remove(&col) {
                self.formats_columns.insert(col + 1, format);
                updated_cols.insert(col + 1);
            }
        }

        // signal client ot update the borders for changed columns
        if self.borders.insert_column(column) {
            transaction.sheet_borders.insert(self.id);
        }

        // signal client to update the hashes for changed columns
        let dirty_hashes = transaction
            .dirty_hashes
            .entry(self.id)
            .or_insert_with(HashSet::new);
        updated_cols.iter().for_each(|col| {
            if let Some((start, end)) = self.column_bounds(*col, false) {
                for y in (start..=end).step_by(CELL_SHEET_HEIGHT as usize) {
                    let mut pos = Pos { x: *col, y };
                    pos.to_quadrant();
                    dirty_hashes.insert(pos);
                }
            }
        });

        // todo: fill_color needs a separate update

        reverse_operations
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        controller::execution::TransactionType,
        grid::{
            formats::{format::Format, format_update::FormatUpdate},
            BorderStyle, CellBorderLine, CellWrap,
        },
        CellValue,
    };

    use super::*;

    #[test]
    #[parallel]
    fn delete_column() {
        // will delete column 0 and -1
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            -2,
            -2,
            4,
            4,
            vec![
                "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
            ],
        );
        sheet.test_set_format(
            -2,
            -2,
            FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
        );
        sheet.test_set_format(
            0,
            1,
            FormatUpdate {
                wrap: Some(Some(CellWrap::Clip)),
                ..Default::default()
            },
        );
        sheet.test_set_format(
            1,
            1,
            FormatUpdate {
                fill_color: Some(Some("blue".to_string())),
                ..Default::default()
            },
        );
        sheet.test_set_code_run_array(-1, 2, vec!["=A1", "=B1"], true);
        sheet.test_set_code_run_array(1, 2, vec!["=A1", "=B1"], true);

        sheet.set_formats_columns(
            &[-1],
            &Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    ..Default::default()
                },
                1,
            ),
        );
        sheet.set_formats_columns(
            &[1],
            &Formats::repeat(
                FormatUpdate {
                    italic: Some(Some(true)),
                    ..Default::default()
                },
                1,
            ),
        );

        let mut transaction = PendingTransaction::default();
        transaction.transaction_type = TransactionType::User;
        let ops = sheet.delete_column(&mut transaction, 0);
        assert_eq!(ops.len(), 3);
        assert_eq!(sheet.columns.len(), 3);

        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("P".to_string()))
        );
        assert_eq!(
            sheet.format_cell(0, 1, false),
            Format {
                fill_color: Some("blue".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.code_runs.get(&Pos { x: 0, y: 2 }).is_some());
    }

    #[test]
    #[parallel]
    fn insert_column_start() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);
        sheet.borders.set(
            1,
            1,
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
        );
        sheet.borders.set(
            2,
            1,
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
        );
        sheet.borders.set(
            3,
            1,
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
        );

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(&mut transaction, 1);

        assert_eq!(sheet.display_value(Pos { x: 1, y: 1 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 4, y: 1 }),
            Some(CellValue::Text("C".to_string()))
        );

        assert_eq!(sheet.borders.get(1, 1).top, None);
        assert_eq!(
            sheet.borders.get(2, 1).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get(3, 1).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get(4, 1).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(sheet.borders.get(5, 1).top, None);
    }

    #[test]
    #[parallel]
    fn insert_column_middle() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(&mut transaction, 2);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 4, y: 1 }),
            Some(CellValue::Text("C".to_string()))
        );
    }

    #[test]
    #[parallel]
    fn insert_column_end() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 1, vec!["A", "B"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(&mut transaction, 3);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 3, y: 1 }), None);
    }

    #[test]
    #[parallel]
    fn test_values_ops_for_column() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 2, vec!["a", "b", "c", "d"]);
        let ops = sheet.values_ops_for_column(2);
        assert_eq!(ops.len(), 1);
    }
}
