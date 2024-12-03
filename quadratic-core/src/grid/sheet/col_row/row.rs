use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{GridBounds, Sheet},
    CopyFormats, Pos, SheetPos,
};

use super::MAX_OPERATION_SIZE_COL_ROW;

impl Sheet {
    // create reverse operations for values in the row broken up by MAX_OPERATION_SIZE
    fn reverse_values_ops_for_row(&self, row: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        if let Some((min, max)) = self.row_bounds(row, true) {
            let mut current_min = min;
            while current_min <= max {
                let current_max = (current_min + MAX_OPERATION_SIZE_COL_ROW).min(max);
                let mut values = CellValues::new((current_max - current_min) as u32 + 1, 1);
                for x in current_min..=current_max {
                    if let Some(cell) = self.cell_value(Pos { x, y: row }) {
                        values.set((x - current_min) as u32, 0, cell);
                    }
                }
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: SheetPos::new(self.id, min, row),
                    values,
                });
                current_min = current_max + 1;
            }
        }

        reverse_operations
    }

    /// Creates reverse operations for cell formatting within the row.
    fn reverse_formats_ops_for_row(&self, row: i64) -> Vec<Operation> {
        if let Some(formats) = self.formats.copy_row(row) {
            vec![Operation::SetCellFormatsA1 {
                sheet_id: self.id,
                formats,
            }]
        } else {
            vec![]
        }
    }

    /// Creates reverse operations for code runs within the column.
    fn code_runs_for_row(&self, row: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        self.code_runs
            .iter()
            .enumerate()
            .for_each(|(index, (pos, code_run))| {
                if pos.y == row {
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

    /// Removes any value at row and shifts the remaining values up by 1.
    fn delete_and_shift_values(&mut self, row: i64) {
        // use the sheet bounds to determine the approximate bounds for the impacted range
        if let GridBounds::NonEmpty(bounds) = self.bounds(true) {
            for x in bounds.min.x..=bounds.max.x {
                if let Some(column) = self.columns.get_mut(&x) {
                    if column.values.contains_key(&row) {
                        column.values.remove(&row);
                    }

                    let mut keys_to_move: Vec<i64> = column
                        .values
                        .keys()
                        .filter(|&key| *key > row)
                        .cloned()
                        .collect();

                    keys_to_move.sort_unstable();

                    // Move up remaining values
                    for key in keys_to_move {
                        if let Some(value) = column.values.remove(&key) {
                            column.values.insert(key - 1, value);
                        }
                    }
                }
            }
        }
    }

    pub(crate) fn delete_row_offset(&mut self, transaction: &mut PendingTransaction, row: i64) {
        let (changed, new_size) = self.offsets.delete_row(row);

        if let Some(new_size) = new_size {
            transaction.reverse_operations.push(Operation::ResizeRow {
                sheet_id: self.id,
                row,
                new_size,
                client_resized: false,
            });
        }
        if !changed.is_empty() && !transaction.is_server() {
            changed.iter().for_each(|(index, size)| {
                transaction
                    .offsets_modified
                    .entry(self.id)
                    .or_default()
                    .insert((None, Some(*index)), *size);
            });
        }
    }

    pub(crate) fn delete_row(&mut self, transaction: &mut PendingTransaction, row: i64) {
        // create undo operations for the deleted column (only when needed since
        // it's a bit expensive)
        if transaction.is_user_undo_redo() {
            transaction
                .reverse_operations
                .extend(self.reverse_values_ops_for_row(row));
            transaction
                .reverse_operations
                .extend(self.reverse_formats_ops_for_row(row));
            transaction
                .reverse_operations
                .extend(self.code_runs_for_row(row));
            transaction
                .reverse_operations
                .extend(self.borders.get_row_ops(self.id, row));
        }

        self.delete_row_offset(transaction, row);

        // remove the row's code runs from the sheet
        self.code_runs.retain(|pos, code_run| {
            if pos.y == row {
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

        // mark hashes of existing rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);

        // remove the row's formats from the sheet
        self.formats.remove_row(row);
        // TODO: only update fill cells if necessary due to removed formatting?

        transaction.fill_cells.insert(self.id);

        // remove the column's borders from the sheet
        if self.borders.remove_row(row) {
            transaction.sheet_borders.insert(self.id);
        }

        // update all cells that were impacted by the deletion
        self.delete_and_shift_values(row);

        // update the indices of all code_runs impacted by the deletion
        let mut code_runs_to_move = Vec::new();
        for (pos, _) in self.code_runs.iter() {
            if pos.y > row {
                code_runs_to_move.push(*pos);
            }
        }
        code_runs_to_move.sort_unstable();
        for old_pos in code_runs_to_move {
            if let Some(code_run) = self.code_runs.shift_remove(&old_pos) {
                let new_pos = Pos {
                    x: old_pos.x,
                    y: old_pos.y - 1,
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
        self.formats.remove_row(row); // TODO: save formats returned here

        dbgjs!("actually save the row formatting and update transaction appropriately");

        // mark hashes of new rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);

        // reverse operation to create the column (this will also shift all impacted columns)
        transaction.reverse_operations.push(Operation::InsertRow {
            sheet_id: self.id,
            row,
            copy_formats: CopyFormats::None,
        });

        let changed_selections = self.validations.remove_row(transaction, self.id, row);
        transaction.add_dirty_hashes_from_selections(self, changed_selections);
    }

    /// Removes any value at row and shifts the remaining values up by 1.
    fn insert_and_shift_values(&mut self, row: i64) {
        // use the sheet bounds to determine the approximate bounds for the impacted range
        if let GridBounds::NonEmpty(bounds) = self.bounds(true) {
            for x in bounds.min.x..=bounds.max.x {
                if let Some(column) = self.columns.get_mut(&x) {
                    let mut keys_to_move: Vec<i64> = column
                        .values
                        .keys()
                        .filter(|&key| *key >= row)
                        .cloned()
                        .collect();

                    keys_to_move.sort_unstable_by(|a, b| b.cmp(a));

                    // Move down values
                    for key in keys_to_move {
                        if let Some(value) = column.values.remove(&key) {
                            column.values.insert(key + 1, value);
                        }
                    }
                }
            }
        }
    }

    /// Copies row formats to the new row.
    ///
    /// We don't need reverse operations since the updated column will be
    /// deleted during an undo.
    fn copy_row_formats(
        &mut self,
        _transaction: &mut PendingTransaction,
        _row: i64,
        _copy_formats: CopyFormats,
    ) {
        dbgjs!(
            "copy_row_formats - this function isn't necessary; the data structure does it for you!"
        );
        // let delta = match copy_formats {
        //     CopyFormats::After => 1,
        //     CopyFormats::Before => -1,
        //     CopyFormats::None => return,
        // };
        // if let Some((min, max)) = self.row_bounds_formats(row + delta) {
        //     for x in min..=max {
        //         if let Some(format) = self.try_format_cell(x, row + delta) {
        //             if format.fill_color.is_some() {
        //                 transaction.fill_cells.insert(self.id);
        //             }
        //             self.set_format_cell(Pos { x, y: row }, &format.to_replace(), false);
        //         }
        //     }
        // }
        // if let Some((format, _)) = self.formats_rows.get(&(row + delta)) {
        //     if format.fill_color.is_some() {
        //         transaction.fill_cells.insert(self.id);
        //     }
        //     self.formats_rows
        //         .insert(row, (format.clone(), Utc::now().timestamp()));
        // }
    }

    pub(crate) fn insert_row(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
        copy_formats: CopyFormats,
    ) {
        // create undo operations for the inserted column
        if transaction.is_user_undo_redo() {
            // reverse operation to delete the row (this will also shift all impacted rows)
            transaction.reverse_operations.push(Operation::DeleteRow {
                sheet_id: self.id,
                row,
            });
        }

        // mark hashes of existing rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);

        self.insert_and_shift_values(row);

        // update the indices of all code_runs impacted by the insertion
        let mut code_runs_to_move = Vec::new();
        for (pos, _) in self.code_runs.iter() {
            if pos.y >= row {
                code_runs_to_move.push(*pos);
            }
        }
        code_runs_to_move.reverse();

        for old_pos in code_runs_to_move {
            let new_pos = Pos {
                x: old_pos.x,
                y: old_pos.y + 1,
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
        if true {
            dbgjs!("todo: insert row with format data");
        }

        // signal client to update the borders for changed columns
        if self.borders.insert_row(row) {
            transaction.sheet_borders.insert(self.id);
        }

        // update formatting
        self.formats.insert_row(row, copy_formats);

        // mark hashes of new rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);

        let changed_selections = self.validations.insert_row(transaction, self.id, row);
        transaction.add_dirty_hashes_from_selections(self, changed_selections);

        self.copy_row_formats(transaction, row, copy_formats);

        let changes = self.offsets.insert_row(row);
        if !changes.is_empty() {
            changes.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, None, Some(*index), Some(*size));
            });
        }
    }
}

#[cfg(test)]
mod test {
    use serial_test::parallel;

    use crate::{
        controller::execution::TransactionSource,
        grid::{BorderStyle, CellBorderLine, CellWrap},
        CellValue, DEFAULT_ROW_HEIGHT,
    };

    use super::*;

    #[test]
    #[parallel]
    fn delete_row_values() {
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
        sheet.recalculate_bounds();
        sheet.delete_and_shift_values(1);
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("E".to_string()))
        );
    }

    #[test]
    #[parallel]
    fn delete_row() {
        // will delete row 1
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
            .set(pos![A2], Some("red".to_string()));
        sheet.formats.wrap.set(pos![B2], Some(CellWrap::Clip));
        sheet
            .formats
            .fill_color
            .set(pos![C2], Some("blue".to_string()));
        sheet.test_set_code_run_array(1, 3, vec!["=A1", "=A2"], false);
        sheet.test_set_code_run_array(1, 4, vec!["=A1", "=A2"], false);

        sheet.formats.bold.set_rect(1, 1, Some(1), None, Some(true));
        sheet
            .formats
            .italic
            .set_rect(1, 1, Some(1), None, Some(true));

        sheet
            .formats
            .bold
            .set_rect(2, 1, Some(2), None, Some(false));
        sheet
            .formats
            .italic
            .set_rect(2, 1, Some(2), None, Some(false));

        sheet.recalculate_bounds();

        let mut transaction = PendingTransaction {
            source: TransactionSource::User,
            ..Default::default()
        };
        sheet.delete_row(&mut transaction, 1);
        assert_eq!(transaction.reverse_operations.len(), 3);

        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("E".to_string()))
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![C1]),
            Some(&"blue".to_string())
        );

        assert!(sheet.code_runs.get(&Pos { x: 1, y: 2 }).is_some());
        assert!(sheet.code_runs.get(&Pos { x: 1, y: 3 }).is_some());
    }

    #[test]
    #[parallel]
    fn insert_row_start() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);
        sheet.borders.set(
            1,
            1,
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
        );
        sheet.borders.set(
            1,
            2,
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
        );
        sheet.borders.set(
            1,
            3,
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
            Some(BorderStyle::default()),
        );
        sheet.test_set_code_run_array(4, 1, vec!["A", "B"], false);

        sheet.recalculate_bounds();

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(&mut transaction, 1, CopyFormats::None);

        assert_eq!(sheet.display_value(Pos { x: 1, y: 1 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 3 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 4 }),
            Some(CellValue::Text("C".to_string()))
        );

        assert_eq!(sheet.borders.get(1, 1).top, None);
        assert_eq!(
            sheet.borders.get(1, 2).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get(1, 3).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get(1, 4).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(sheet.borders.get(5, 1).top, None);

        assert!(sheet.code_runs.get(&Pos { x: 4, y: 1 }).is_none());
        assert!(sheet.code_runs.get(&Pos { x: 4, y: 2 }).is_some());

        assert_eq!(
            sheet.display_value(Pos { x: 4, y: 2 }),
            Some(CellValue::Text("A".to_string()))
        );
    }

    #[test]
    #[parallel]
    fn insert_row_middle() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(&mut transaction, 2, CopyFormats::None);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 2 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 3 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 4 }),
            Some(CellValue::Text("C".to_string()))
        );
    }

    #[test]
    #[parallel]
    fn insert_row_end() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 2, vec!["A", "B"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(&mut transaction, 3, CopyFormats::None);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 3 }), None);
    }

    #[test]
    #[parallel]
    fn test_values_ops_for_column() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 2, vec!["a", "b", "c", "d"]);
        let ops = sheet.reverse_values_ops_for_row(2);
        assert_eq!(ops.len(), 1);
    }

    #[test]
    #[parallel]
    fn insert_row_offset() {
        let mut sheet = Sheet::test();
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        let mut transaction = PendingTransaction::default();
        sheet.insert_row(&mut transaction, 2, CopyFormats::None);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), DEFAULT_ROW_HEIGHT);
        assert_eq!(sheet.offsets.row_height(3), 200.0);
        assert_eq!(sheet.offsets.row_height(5), 400.0);
    }

    #[test]
    #[parallel]
    fn delete_column_offset() {
        let mut sheet = Sheet::test();
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        let mut transaction = PendingTransaction::default();
        sheet.delete_row(&mut transaction, 2);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), DEFAULT_ROW_HEIGHT);
        assert_eq!(sheet.offsets.row_height(3), 400.0);
    }
}
