use std::collections::HashSet;

use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{
        formats::{format_update::FormatUpdate, Formats},
        Sheet,
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
                        values.set(0, (x - current_min) as u32, cell);
                    }
                }
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: crate::SheetPos::new(self.id, min, row),
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

            // reverse operation to create the column (this will also shift all impacted columns)
            reverse_operations.push(Operation::InsertRow {
                sheet_id: self.id,
                row,
            });
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

        // todo: need to update every row that was impacted by the deletion
        // // update the indices of all columns impacted by the deletion
        // let mut columns_to_update = Vec::new();
        // for col in self.columns.keys() {
        //     if *col > column {
        //         columns_to_update.push(*col);
        //     }
        // }
        // for col in columns_to_update {
        //     if let Some(mut column_data) = self.columns.remove(&col) {
        //         column_data.x -= 1;
        //         self.columns.insert(col - 1, column_data);
        //         updated_rows.insert(col - 1);
        //     }
        // }

        // update the indices of all code_runs impacted by the deletion
        let mut code_runs_to_move = Vec::new();
        for (pos, _) in self.code_runs.iter() {
            if pos.y > row {
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

        // todo: need to update every row that was impacted by the deletion
        // // update the indices of all column-based formats impacted by the deletion
        // let mut formats_to_update = Vec::new();
        // for col in self.formats_columns.keys() {
        //     if *col > column {
        //         formats_to_update.push(*col);
        //     }
        // }
        // for col in formats_to_update {
        //     if let Some(format) = self.formats_columns.remove(&col) {
        //         self.formats_columns.insert(col - 1, format);
        //         updated_rows.insert(col - 1);
        //     }
        // }

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

        // todo: fill_color needs a separate update
        // todo: html needs a separate update as well

        reverse_operations
    }
}
