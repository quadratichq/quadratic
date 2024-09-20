use std::collections::HashSet;

use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{
        formats::{format_update::FormatUpdate, Formats},
        GridBounds, Sheet,
    },
    renderer_constants::CELL_SHEET_WIDTH,
    selection::Selection,
    Pos, SheetPos,
};

use super::MAX_OPERATION_SIZE_COL_ROW;

impl Sheet {
    // create reverse operations for values in the row broken up by MAX_OPERATION_SIZE
    fn values_ops_for_row(&self, row: i64) -> Vec<Operation> {
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
    fn formats_ops_for_row(&self, row: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();
        // create reverse operations for rows formatting broken up by MAX_OPERATION_SIZE

        if let Some((min, max)) = self.row_bounds(row, false) {
            let mut formats = Formats::new();
            for x in min..=max {
                if let Some(column) = self.columns.get(&x) {
                    if let Some(format) = column.format(row) {
                        formats.push(format.to_replace());
                    } else {
                        formats.push(FormatUpdate::default());
                    }
                }
            }
            reverse_operations.push(Operation::SetCellFormatsSelection {
                selection: Selection::columns(&[row], self.id),
                formats,
            });
        }
        reverse_operations
    }

    /// Creates reverse operations for code runs within the column.
    fn code_runs_for_row(&self, row: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        self.code_runs
            .iter()
            .enumerate()
            .for_each(|(index, (pos, code_run))| {
                if pos.y == row {
                    reverse_operations.push(Operation::SetCodeRun {
                        sheet_pos: SheetPos::new(self.id, pos.x, pos.y),
                        code_run: Some(code_run.clone()),
                        index,
                    });
                }
            });

        reverse_operations
    }

    /// Removes any value at row and shifts the remaining values up by 1.
    fn delete_and_shift_values(&mut self, row: i64, updated_rows: &mut HashSet<i64>) {
        // use the sheet bounds to determine the approximate bounds for the impacted range
        if let GridBounds::NonEmpty(bounds) = self.bounds(true) {
            for x in bounds.min.x..=bounds.max.x {
                if let Some(column) = self.columns.get_mut(&x) {
                    if column.values.contains_key(&row) {
                        column.values.remove(&row);
                        updated_rows.insert(row);
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
                            updated_rows.insert(key - 1);
                            updated_rows.insert(key);
                        }
                    }
                }
            }
        }
    }

    /// Removes format at row and shifts remaining formats to the left by 1.
    fn formats_remove_and_shift_up(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
        updated_rows: &mut HashSet<i64>,
    ) {
        if let GridBounds::NonEmpty(bounds) = self.bounds(false) {
            for x in bounds.min.x..=bounds.max.x {
                if let Some(column) = self.columns.get_mut(&x) {
                    if column.align.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.align.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.vertical_align.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.wrap.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.numeric_format.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.numeric_decimals.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.numeric_commas.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.bold.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.italic.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.text_color.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.fill_color.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                        transaction.fill_cells.insert(self.id);
                    }
                    if column.render_size.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                    if column.date_time.remove_and_shift_left(row) {
                        updated_rows.insert(row);
                    }
                }
            }
        }
    }

    pub fn delete_row(&mut self, transaction: &mut PendingTransaction, row: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        // create undo operations for the deleted column (only when needed since
        // it's a bit expensive)
        if transaction.is_user_undo_redo() {
            reverse_operations.extend(self.values_ops_for_row(row));
            reverse_operations.extend(self.formats_ops_for_row(row));
            reverse_operations.extend(self.code_runs_for_row(row));
            reverse_operations.extend(self.borders.get_row_ops(self.id, row));

            // todo: create reverse operations for validations

            // create reverse operation for row-based formatting
            if let Some(format) = self.try_format_row(row) {
                reverse_operations.push(Operation::SetCellFormatsSelection {
                    selection: Selection::rows(&[row], self.id),
                    formats: Formats::repeat(format.to_replace(), 1),
                });
            }
        }

        // remove the column's code runs from the sheet
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

        let mut updated_rows = HashSet::new();

        // remove the column's formats from the sheet
        if self.formats_rows.contains_key(&row) {
            self.formats_rows.remove(&row);
            updated_rows.insert(row);
        }

        // remove the column's borders from the sheet
        if self.borders.remove_row(row) {
            transaction.sheet_borders.insert(self.id);
        }

        // update all cells that were impacted by the deletion
        self.delete_and_shift_values(row, &mut updated_rows);

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
        self.formats_remove_and_shift_up(transaction, row, &mut updated_rows);

        // send the value hashes that have changed to the client
        let dirty_hashes = transaction
            .dirty_hashes
            .entry(self.id)
            .or_insert_with(HashSet::new);
        updated_rows.iter().for_each(|row| {
            if let Some((start, end)) = self.row_bounds(*row, false) {
                for x in (start..=end).step_by(CELL_SHEET_WIDTH as usize) {
                    let mut pos = Pos { x, y: *row };
                    pos.to_quadrant();
                    dirty_hashes.insert(pos);
                }
            }
        });

        // reverse operation to create the column (this will also shift all impacted columns)
        reverse_operations.push(Operation::InsertRow {
            sheet_id: self.id,
            row,
        });

        reverse_operations
    }

    /// Removes any value at row and shifts the remaining values up by 1.
    fn insert_and_shift_values(&mut self, row: i64, updated_rows: &mut HashSet<i64>) {
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
                            updated_rows.insert(key);
                            updated_rows.insert(key + 1);
                        }
                    }
                }
            }
        }
    }

    /// Removes format at row and shifts remaining formats to the left by 1.
    fn formats_insert_and_shift_down(&mut self, row: i64, updated_rows: &mut HashSet<i64>) {
        if let GridBounds::NonEmpty(bounds) = self.bounds(false) {
            for x in bounds.min.x..=bounds.max.x {
                if let Some(column) = self.columns.get_mut(&x) {
                    if column.align.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.vertical_align.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.wrap.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.numeric_format.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.numeric_decimals.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.numeric_commas.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.bold.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.italic.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.text_color.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.fill_color.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.render_size.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                    if column.date_time.insert_and_shift_right(row) {
                        updated_rows.insert(row);
                    }
                }
            }
        }
    }

    pub fn insert_row(&mut self, transaction: &mut PendingTransaction, row: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        // create undo operations for the inserted column
        if transaction.is_user_undo_redo() {
            // reverse operation to delete the row (this will also shift all impacted rows)
            reverse_operations.push(Operation::DeleteRow {
                sheet_id: self.id,
                row,
            });
        }

        let mut updated_rows = HashSet::new();

        self.insert_and_shift_values(row, &mut updated_rows);

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
        self.formats_insert_and_shift_down(row, &mut updated_rows);

        // signal client to update the borders for changed columns
        if self.borders.insert_row(row) {
            transaction.sheet_borders.insert(self.id);
        }

        // signal client to update the hashes for changed columns
        let dirty_hashes = transaction
            .dirty_hashes
            .entry(self.id)
            .or_insert_with(HashSet::new);
        updated_rows.iter().for_each(|row| {
            if let Some((start, end)) = self.row_bounds(*row, false) {
                for x in (start..=end).step_by(CELL_SHEET_WIDTH as usize) {
                    let mut pos = Pos { x, y: *row };
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
mod test {
    use serial_test::parallel;

    use crate::{
        controller::execution::TransactionType,
        grid::{formats::format::Format, BorderStyle, CellBorderLine, CellWrap},
        CellValue,
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
        sheet.calculate_bounds();
        sheet.delete_and_shift_values(1, &mut HashSet::new());
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
        sheet.test_set_format(
            1,
            2,
            FormatUpdate {
                fill_color: Some(Some("red".to_string())),
                ..Default::default()
            },
        );
        sheet.test_set_format(
            2,
            2,
            FormatUpdate {
                wrap: Some(Some(CellWrap::Clip)),
                ..Default::default()
            },
        );
        sheet.test_set_format(
            3,
            2,
            FormatUpdate {
                fill_color: Some(Some("blue".to_string())),
                ..Default::default()
            },
        );
        sheet.test_set_code_run_array(1, 3, vec!["=A1", "=A2"], false);
        sheet.test_set_code_run_array(1, 4, vec!["=A1", "=A2"], false);

        sheet.set_formats_rows(
            &[1],
            &Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(true)),
                    italic: Some(Some(true)),
                    ..Default::default()
                },
                1,
            ),
        );

        sheet.set_formats_rows(
            &[2],
            &Formats::repeat(
                FormatUpdate {
                    bold: Some(Some(false)),
                    italic: Some(Some(false)),
                    ..Default::default()
                },
                1,
            ),
        );

        sheet.calculate_bounds();

        let mut transaction = PendingTransaction::default();
        transaction.transaction_type = TransactionType::User;
        let ops = sheet.delete_row(&mut transaction, 1);
        assert_eq!(ops.len(), 4);

        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("E".to_string()))
        );
        assert_eq!(
            sheet.format_cell(3, 1, false),
            Format {
                fill_color: Some("blue".to_string()),
                ..Default::default()
            }
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

        sheet.calculate_bounds();

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(&mut transaction, 1);

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

        sheet.insert_row(&mut transaction, 2);

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

        sheet.insert_row(&mut transaction, 3);

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
        let ops = sheet.values_ops_for_row(2);
        assert_eq!(ops.len(), 1);
    }
}
