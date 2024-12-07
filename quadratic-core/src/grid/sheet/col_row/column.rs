use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
    CopyFormats, Pos, SheetPos,
};

use super::MAX_OPERATION_SIZE_COL_ROW;

impl Sheet {
    // create reverse operations for values in the column broken up by MAX_OPERATION_SIZE
    fn reverse_values_ops_for_column(&self, column: i64) -> Vec<Operation> {
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
    fn reverse_formats_ops_for_column(&self, column: i64) -> Vec<Operation> {
        if let Some(formats) = self.formats.copy_column(column) {
            vec![Operation::SetCellFormatsA1 {
                sheet_id: self.id,
                formats,
            }]
        } else {
            vec![]
        }
    }

    /// Creates reverse operations for borders within the column.
    fn reverse_borders_ops_for_column(&self, column: i64) -> Vec<Operation> {
        if let Some(borders) = self.borders_a1.copy_column(column) {
            vec![Operation::SetBordersA1 {
                sheet_id: self.id,
                borders,
            }]
        } else {
            vec![]
        }
    }

    /// Creates reverse operations for code runs within the column.
    fn reverse_code_runs_ops_for_column(&self, column: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        self.code_runs
            .iter()
            .enumerate()
            .for_each(|(index, (pos, code_run))| {
                if pos.x == column {
                    reverse_operations.push(Operation::SetCodeRunVersion {
                        sheet_pos: SheetPos::new(self.id, pos.x, pos.y),
                        code_run: Some(code_run.clone()),
                        index,
                        version: 1,
                    });
                }
            });

        reverse_operations
    }

    fn delete_column_offset(&mut self, transaction: &mut PendingTransaction, column: i64) {
        let (changed, new_size) = self.offsets.delete_column(column);
        if let Some(new_size) = new_size {
            transaction
                .reverse_operations
                .push(Operation::ResizeColumn {
                    sheet_id: self.id,
                    column,
                    new_size,
                    client_resized: false,
                });
        }
        if !changed.is_empty() && !transaction.is_server() {
            changed.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, Some(*index), None, Some(*size));
            });
        }
    }

    /// Deletes columns and returns the operations to undo the deletion.
    pub(crate) fn delete_column(&mut self, transaction: &mut PendingTransaction, column: i64) {
        // create undo operations for the deleted column (only when needed since
        // it's a bit expensive)
        if transaction.is_user_undo_redo() {
            transaction
                .reverse_operations
                .extend(self.reverse_values_ops_for_column(column));
            transaction
                .reverse_operations
                .extend(self.reverse_formats_ops_for_column(column));
            transaction
                .reverse_operations
                .extend(self.reverse_borders_ops_for_column(column));
            transaction
                .reverse_operations
                .extend(self.reverse_code_runs_ops_for_column(column));

            // reverse operation to create the column (this will also shift all impacted columns)
            transaction
                .reverse_operations
                .push(Operation::InsertColumn {
                    sheet_id: self.id,
                    column,
                    copy_formats: CopyFormats::None,
                });
        }

        self.delete_column_offset(transaction, column);

        // mark hashes of existing columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);

        // remove the column's data from the sheet
        self.formats.remove_column(column);
        transaction.fill_cells.insert(self.id);

        // remove the column's borders from the sheet
        self.borders_a1.remove_column(column);
        transaction.sheet_borders.insert(self.id);

        self.columns.remove(&column);

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
                self.columns.insert(col - 1, column_data);
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

                self.code_runs.insert_sorted(new_pos, code_run);

                // signal client to update the code runs
                transaction.add_code_cell(self.id, old_pos);
                transaction.add_code_cell(self.id, new_pos);
            }
        }

        // mark hashes of new columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);

        let changed_selections = self.validations.remove_column(transaction, self.id, column);
        transaction.add_dirty_hashes_from_selections(self, changed_selections);
    }

    pub(crate) fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
    ) {
        // create undo operations for the inserted column
        if transaction.is_user_undo_redo() {
            // reverse operation to delete the column (this will also shift all impacted columns)
            transaction
                .reverse_operations
                .push(Operation::DeleteColumn {
                    sheet_id: self.id,
                    column,
                });
        }

        // mark hashes of existing columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);

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

                self.code_runs.insert_sorted(new_pos, code_run);

                // signal the client to updates to the code cells (to draw the code arrays)
                transaction.add_code_cell(self.id, old_pos);
                transaction.add_code_cell(self.id, new_pos);
            }
        }

        // update formatting
        self.formats.insert_column(column, copy_formats);
        transaction.fill_cells.insert(self.id);

        // signal client ot update the borders for changed columns
        self.borders_a1.insert_column(column, copy_formats);
        transaction.sheet_borders.insert(self.id);

        // mark hashes of new columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);

        let changed_selections = self.validations.insert_column(transaction, self.id, column);
        transaction.add_dirty_hashes_from_selections(self, changed_selections);

        let changes = self.offsets.insert_column(column);
        if !changes.is_empty() {
            changes.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, Some(*index), None, Some(*size));
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        controller::execution::TransactionSource,
        grid::{BorderStyle, CellBorderLine, CellWrap},
        CellValue, DEFAULT_COLUMN_WIDTH,
    };

    use super::*;

    #[test]
    #[parallel]
    fn delete_column() {
        // will delete column 0 and -1
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            1,
            1,
            4,
            4,
            vec![
                "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
            ],
        );
        sheet
            .formats
            .fill_color
            .set(pos![A1], Some("red".to_string()));
        sheet.formats.wrap.set(pos![C4], Some(CellWrap::Clip));

        sheet
            .formats
            .fill_color
            .set(pos![D4], Some("blue".to_string()));
        sheet.test_set_code_run_array(2, 5, vec!["=A1", "=B1"], true);
        sheet.test_set_code_run_array(4, 5, vec!["=A1", "=B1"], true);

        sheet.formats.bold.set_rect(1, 1, Some(1), None, Some(true));
        sheet
            .formats
            .italic
            .set_rect(4, 1, Some(4), None, Some(true));

        let mut transaction = PendingTransaction {
            source: TransactionSource::User,
            ..Default::default()
        };
        sheet.delete_column(&mut transaction, 0);
        assert_eq!(transaction.reverse_operations.len(), 3);
        assert_eq!(sheet.columns.len(), 3);

        assert_eq!(
            sheet.cell_value(Pos { x: 0, y: 1 }),
            Some(CellValue::Text("P".to_string()))
        );
        assert_eq!(
            sheet.formats.fill_color.get(Pos { x: 3, y: 4 }),
            Some("blue".to_string())
        );
        assert!(sheet.code_runs.get(&Pos { x: 2, y: 5 }).is_some());
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

        sheet.insert_column(&mut transaction, 1, CopyFormats::None);

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

        sheet.insert_column(&mut transaction, 2, CopyFormats::None);

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

        sheet.insert_column(&mut transaction, 3, CopyFormats::None);

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
    fn values_ops_for_column() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 2, vec!["a", "b", "c", "d"]);
        let ops = sheet.reverse_values_ops_for_column(2);
        assert_eq!(ops.len(), 1);
    }

    #[test]
    #[parallel]
    fn insert_column_offset() {
        let mut sheet = Sheet::test();

        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        let mut transaction = PendingTransaction::default();
        sheet.insert_column(&mut transaction, 2, CopyFormats::None);
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), DEFAULT_COLUMN_WIDTH);
        assert_eq!(sheet.offsets.column_width(3), 200.0);
        assert_eq!(sheet.offsets.column_width(5), 400.0);
    }

    #[test]
    #[parallel]
    fn delete_column_offset() {
        let mut sheet = Sheet::test();

        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        let mut transaction = PendingTransaction::default();
        sheet.delete_column(&mut transaction, 2);
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), DEFAULT_COLUMN_WIDTH);
        assert_eq!(sheet.offsets.column_width(3), 400.0);
    }
}
