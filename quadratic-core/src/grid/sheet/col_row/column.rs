use std::collections::HashSet;

use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::{CopyFormats, Operation},
    },
    grid::{formats::Formats, Sheet},
    renderer_constants::CELL_SHEET_HEIGHT,
    selection::Selection,
    Pos, Rect, SheetPos,
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
        let mut formats = Formats::new();
        let mut selection = Selection::new(self.id);

        if let Some(format) = self.try_format_column(column) {
            selection.columns = Some(vec![column]);
            formats.push(format.to_replace());
        }

        if let Some(range) = self.columns.get(&column).and_then(|c| c.format_range()) {
            for y in range.start..=range.end {
                let format = self.format_cell(column, y, false).to_replace();
                formats.push(format);
            }
            selection.rects = Some(vec![Rect::new(column, range.start, column, range.end)]);
        }
        if !selection.is_empty() {
            vec![Operation::SetCellFormatsSelection { selection, formats }]
        } else {
            vec![]
        }
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

    pub fn delete_column_offset(&mut self, transaction: &mut PendingTransaction, column: i64) {
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
                transaction
                    .offsets_modified
                    .push((self.id, Some(*index), None, *size));
            });
        }
    }

    /// Deletes columns and returns the operations to undo the deletion.
    pub fn delete_column(&mut self, transaction: &mut PendingTransaction, column: i64) {
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
                .extend(self.code_runs_for_column(column));
            transaction
                .reverse_operations
                .extend(self.borders.get_column_ops(self.id, column));
        }

        self.delete_column_offset(transaction, column);

        if transaction.is_user_undo_redo() {
            // reverse operation to create the column (this will also shift all impacted columns)
            transaction
                .reverse_operations
                .push(Operation::InsertColumn {
                    sheet_id: self.id,
                    column,
                    copy_formats: CopyFormats::None,
                });
        }

        let mut updated_cols = HashSet::new();

        // remove the column's data from the sheet
        if let Some(c) = self.columns.get(&column) {
            if !c.fill_color.is_empty() {
                transaction.fill_cells.insert(self.id);
            }
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
        if let Some((format, _)) = self.formats_columns.get(&column) {
            if format.fill_color.is_some() {
                transaction.fill_cells.insert(self.id);
            }
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
            if *col >= column {
                formats_to_update.push(*col);
            }
        }
        for col in formats_to_update {
            if let Some(format) = self.formats_columns.remove(&col) {
                self.formats_columns.insert(col - 1, format);
                updated_cols.insert(col);
                updated_cols.insert(col - 1);
            }
        }

        // send the value hashes that have changed to the client
        let dirty_hashes = transaction.dirty_hashes.entry(self.id).or_default();
        updated_cols.iter().for_each(|col| {
            if let Some((start, end)) = self.column_bounds(*col, false) {
                for y in (start..=end).step_by(CELL_SHEET_HEIGHT as usize) {
                    let mut pos = Pos { x: *col, y };
                    pos.to_quadrant();
                    dirty_hashes.insert(pos);
                }
            }
        });

        self.validations.remove_column(transaction, self.id, column);
    }

    /// Copies column formats to the new column.
    ///
    /// We don't need reverse operations since the updated column will be
    /// deleted during an undo.
    fn copy_column_formats(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_direction: CopyFormats,
    ) {
        let delta = match copy_direction {
            CopyFormats::After => 1,
            CopyFormats::Before => -1,
            CopyFormats::None => return,
        };
        if let Some(format) = self.try_format_column(column + delta) {
            self.set_formats_columns(&[column], &Formats::repeat(format.to_replace(), 1));
        }
        if let Some(range) = self
            .columns
            .get(&(column + delta))
            .and_then(|c| c.format_range())
        {
            for y in range {
                if let Some(format) = self.try_format_cell(column + delta, y) {
                    if format.fill_color.is_some() {
                        transaction.fill_cells.insert(self.id);
                    }
                    self.set_format_cell(Pos { x: column, y }, &format.to_replace(), false);
                }
            }
        }
    }

    pub fn insert_column(
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
            if *col >= column {
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
        let dirty_hashes = transaction.dirty_hashes.entry(self.id).or_default();
        updated_cols.iter().for_each(|col| {
            if let Some((start, end)) = self.column_bounds(*col, false) {
                for y in (start..=end).step_by(CELL_SHEET_HEIGHT as usize) {
                    let mut pos = Pos { x: *col, y };
                    pos.to_quadrant();
                    dirty_hashes.insert(pos);
                }
            }
        });

        self.validations.insert_column(transaction, self.id, column);

        self.copy_column_formats(transaction, column, copy_formats);

        let changes = self.offsets.insert_column(column);
        if !changes.is_empty() {
            changes.iter().for_each(|(index, size)| {
                transaction
                    .offsets_modified
                    .push((self.id, Some(*index), None, *size));
            });
        }
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
        CellValue, DEFAULT_COLUMN_WIDTH,
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

        let mut transaction = PendingTransaction {
            transaction_type: TransactionType::User,
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
