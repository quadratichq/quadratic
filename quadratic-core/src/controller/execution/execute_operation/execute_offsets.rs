use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::js_types::JsRowHeight,
    SheetPos,
};

impl GridController {
    pub fn execute_resize_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::ResizeColumn {
            sheet_id,
            column,
            new_size,
            client_resized,
        } = op
        {
            let Some(sheet) = self.try_sheet_mut(sheet_id) else {
                // sheet may have been deleted
                return;
            };

            let old_size = sheet.offsets.set_column_width(column, new_size);
            if old_size == new_size {
                return;
            }

            transaction
                .forward_operations
                .push(Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size,
                    client_resized,
                });

            transaction
                .reverse_operations
                .push(Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size: old_size,
                    client_resized: false,
                });

            if (cfg!(target_family = "wasm") || cfg!(test))
                && (transaction.is_undo_redo()
                    || transaction.is_multiplayer()
                    || (!client_resized && transaction.is_user()))
            {
                transaction
                    .offsets_modified
                    .entry(sheet_id)
                    .or_default()
                    .insert((Some(column), None), new_size);
            }

            if transaction.is_user() {
                let rows = sheet.get_rows_with_wrap_in_column(column);
                if !rows.is_empty() {
                    let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                    resize_rows.extend(rows);
                }
            }

            if !transaction.is_server() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_pos(SheetPos {
                    x: column,
                    y: 0,
                    sheet_id,
                });
            }
        }
    }

    pub fn execute_resize_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::ResizeRow {
            sheet_id,
            row,
            new_size,
            client_resized,
        } = op
        {
            let Some(sheet) = self.try_sheet_mut(sheet_id) else {
                // sheet may have been deleted
                return;
            };

            let old_size = sheet.offsets.set_row_height(row, new_size);
            let old_client_resize = sheet.update_row_resize(row, client_resized);
            if old_size == new_size && old_client_resize == client_resized {
                return;
            }

            transaction.forward_operations.push(Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
                client_resized,
            });

            transaction.reverse_operations.push(Operation::ResizeRow {
                sheet_id,
                row,
                new_size: old_size,
                client_resized: old_client_resize,
            });

            if (cfg!(target_family = "wasm") || cfg!(test))
                && (transaction.is_undo_redo()
                    || transaction.is_multiplayer()
                    || (!client_resized && transaction.is_user()))
            {
                transaction
                    .offsets_modified
                    .entry(sheet_id)
                    .or_default()
                    .insert((None, Some(row)), new_size);
            }

            if !transaction.is_server() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_pos(SheetPos {
                    x: 0,
                    y: row,
                    sheet_id,
                });
            }
        }
    }

    pub fn execute_resize_rows(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::ResizeRows {
            sheet_id,
            row_heights,
        } = op
        {
            if row_heights.is_empty() {
                return;
            }
            let Some(sheet) = self.try_sheet_mut(sheet_id) else {
                // sheet may have been deleted
                return;
            };

            let old_row_heights: Vec<JsRowHeight> = row_heights
                .iter()
                .map(|JsRowHeight { row, height }| {
                    let old_size = sheet.offsets.set_row_height(*row, *height);
                    JsRowHeight {
                        row: *row,
                        height: old_size,
                    }
                })
                .collect();

            if old_row_heights == row_heights {
                return;
            }

            transaction.forward_operations.push(Operation::ResizeRows {
                sheet_id,
                row_heights: row_heights.clone(),
            });

            transaction.reverse_operations.push(Operation::ResizeRows {
                sheet_id,
                row_heights: old_row_heights,
            });

            if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                row_heights.iter().for_each(|&JsRowHeight { row, height }| {
                    transaction.offsets_modified(sheet_id, None, Some(row), Some(height));
                });
            }

            // if transaction.is_user() {
            //     let mut changes = vec![];
            //     row_heights.iter().for_each(|&JsRowHeight { row, .. }| {
            //         changes.extend(self.check_chart_size_row_change(sheet_id, row));
            //     });
            //     if !changes.is_empty() {
            //         transaction.operations.extend(changes);
            //         self.check_all_spills(transaction, sheet_id);
            //     }
            // }

            if !transaction.is_server() {
                row_heights.iter().any(|JsRowHeight { row, .. }| {
                    transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_pos(SheetPos {
                        x: 0,
                        y: *row,
                        sheet_id,
                    });
                    transaction.generate_thumbnail
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::{
        controller::GridController,
        wasm_bindings::js::{clear_js_calls, expect_js_offsets},
    };

    // also see tests in sheet_offsets.rs

    #[test]
    fn test_execute_operation_resize_column() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let column = 0;
        let new_size = 120.0;
        gc.commit_single_resize(sheet_id, Some(column), None, new_size, None);
        let column_width = gc
            .grid
            .try_sheet(sheet_id)
            .unwrap()
            .offsets
            .column_width(column as i64);
        assert_eq!(column_width, new_size);

        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((Some(column as i64), None), new_size);
        expect_js_offsets(sheet_id, offsets, true);
    }

    #[test]
    fn test_execute_operation_resize_row() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let row = 0;
        let new_size = 100.0;
        gc.commit_single_resize(sheet_id, None, Some(row), new_size, None);
        let row_height = gc
            .grid
            .try_sheet(sheet_id)
            .unwrap()
            .offsets
            .row_height(row as i64);
        assert_eq!(row_height, new_size);

        let mut offsets = HashMap::<(Option<i64>, Option<i64>), f64>::new();
        offsets.insert((None, Some(row as i64)), new_size);
        expect_js_offsets(sheet_id, offsets, true);
    }
}
