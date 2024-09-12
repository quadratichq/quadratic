use std::collections::HashSet;

use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::formats::Formats,
    renderer_constants::CELL_SHEET_HEIGHT,
    selection::Selection,
    Pos, SheetPos,
};

use super::Sheet;

const MAX_OPERATION_SIZE: i64 = 10000;

impl Sheet {
    // create reverse operations for values in the column broken up by MAX_OPERATION_SIZE
    fn values_ops_for_column(&self, column: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        if let Some((min, max)) = self.column_bounds(column, true) {
            let mut current_min = min;
            while current_min <= max {
                let current_max = (current_min + MAX_OPERATION_SIZE).min(max);
                let mut values = CellValues::new(1, (current_max - current_min) as u32 + 1);

                if let Some(col) = self.columns.get(&column) {
                    for y in current_min..=current_max {
                        if let Some(cell_value) = col.values.get(&y) {
                            values.set(0, (y - current_min) as u32, cell_value.clone());
                        }
                    }
                }
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: SheetPos::new(self.id, 0, 0),
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
                let current_max = (current_min + MAX_OPERATION_SIZE).min(range.end);
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
        let undoable = transaction.is_user_undo_redo();
        let mut reverse_operations = Vec::new();

        // create undo operations for the deleted column
        if undoable {
            // reverse operation to create the column (this will also shift all impacted columns)
            reverse_operations.push(Operation::InsertColumn {
                sheet_id: self.id,
                column,
            });

            reverse_operations.extend(self.values_ops_for_column(column));
            reverse_operations.extend(self.formats_ops_for_column(column));
            reverse_operations.extend(self.code_runs_for_column(column));
            reverse_operations.extend(self.borders.get_column_ops(self.id, column));

            // todo: create reverse operations for validations

            // create reverse operation for column-based formatting
            if let Some(format) = self.try_format_column(column) {
                reverse_operations.push(Operation::SetCellFormatsSelection {
                    selection: Selection::columns(&[column], self.id),
                    formats: Formats::repeat(format.to_replace(), 1),
                });
            }
        }

        // remove all the column's data from the sheet
        self.columns.remove(&column);
        self.code_runs.retain(|pos, _| pos.x != column);
        self.formats_columns.remove(&column);
        self.borders.remove_column(self.id, column);

        let mut updated_cols = HashSet::new();

        // update the indices of all columns impacted by the deletion
        if column < 0 {
            let mut columns_to_update = Vec::new();
            for col in self.columns.keys() {
                if *col < column {
                    columns_to_update.push(*col);
                }
            }
            for col in columns_to_update {
                if let Some(mut column_data) = self.columns.remove(&col) {
                    column_data.x += 1;
                    self.columns.insert(col + 1, column_data);
                    updated_cols.insert(col + 1);
                }
            }
        } else {
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
                    updated_cols.insert(col - 1);
                }
            }
        }

        // update the indices of all code_runs impacted by the deletion
        let mut code_runs_to_move = Vec::new();
        for (pos, _) in self.code_runs.iter() {
            if (column < 0 && pos.x < column) || (column >= 0 && pos.x > column) {
                code_runs_to_move.push(*pos);
            }
        }
        for old_pos in code_runs_to_move {
            if let Some(code_run) = self.code_runs.shift_remove(&old_pos) {
                let new_pos = if column < 0 && old_pos.x < column {
                    Pos {
                        x: old_pos.x + 1,
                        y: old_pos.y,
                    }
                } else {
                    Pos {
                        x: old_pos.x - 1,
                        y: old_pos.y,
                    }
                };
                self.code_runs.insert(new_pos, code_run);
            }
        }

        // update the indices of all column-based formats impacted by the deletion
        let mut formats_to_update = Vec::new();
        for col in self.formats_columns.keys() {
            if (column < 0 && *col < column) || (column >= 0 && *col > column) {
                formats_to_update.push(*col);
            }
        }
        for col in formats_to_update {
            if let Some(format) = self.formats_columns.remove(&col) {
                let new_col = if column < 0 { col + 1 } else { col - 1 };
                self.formats_columns.insert(new_col, format);
            }
        }

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

        reverse_operations
    }

    pub fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
    ) -> Vec<Operation> {
        let undoable = transaction.is_user_undo_redo();
        let mut reverse_operations = Vec::new();

        // create undo operations for the inserted column
        if undoable {
            // reverse operation to delete the column (this will also shift all impacted columns)
            reverse_operations.push(Operation::DeleteColumn {
                sheet_id: self.id,
                column,
            });
        }

        reverse_operations
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::execution::TransactionType,
        grid::{
            formats::{format::Format, format_update::FormatUpdate},
            CellWrap,
        },
        CellValue,
    };

    use super::*;

    #[test]
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
}
