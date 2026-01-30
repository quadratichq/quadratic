use crate::{
    SheetRect,
    a1::A1Selection,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::js_types::{JsColumnWidth, JsRowHeight},
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

            if (cfg!(target_family = "wasm") || cfg!(test))
                && (transaction.is_undo_redo()
                    || transaction.is_multiplayer()
                    || (!client_resized && transaction.is_user_ai()))
            {
                transaction
                    .offsets_modified
                    .entry(sheet_id)
                    .or_default()
                    .insert((Some(column), None), new_size);
            }

            if transaction.is_user_ai() {
                let rows = sheet.get_rows_with_wrap_in_column(column, false);
                if !rows.is_empty() {
                    let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                    resize_rows.extend(rows);
                }
            }

            transaction.add_fill_cells_from_columns(sheet, column);
            transaction.add_borders(sheet_id);
            self.thumbnail_dirty_sheet_rect(
                transaction,
                SheetRect::single_pos((column, 1).into(), sheet_id),
            );
            if transaction.is_user_ai_undo_redo() {
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

            if (cfg!(target_family = "wasm") || cfg!(test))
                && (transaction.is_undo_redo()
                    || transaction.is_multiplayer()
                    || (!client_resized && transaction.is_user_ai()))
            {
                transaction
                    .offsets_modified
                    .entry(sheet_id)
                    .or_default()
                    .insert((None, Some(row)), new_size);
            }

            transaction.add_fill_cells_from_rows(sheet, row);
            transaction.add_borders(sheet_id);
            self.thumbnail_dirty_sheet_rect(
                transaction,
                SheetRect::single_pos((1, row).into(), sheet_id),
            );

            if transaction.is_user_ai_undo_redo() {
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
            }
        }
    }

    pub fn execute_resize_rows(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::ResizeRows {
            sheet_id,
            mut row_heights,
            client_resized,
        } = op
        {
            if row_heights.is_empty() {
                return;
            }
            let Some(sheet) = self.try_sheet_mut(sheet_id) else {
                // sheet may have been deleted
                return;
            };

            row_heights.sort_by_key(|JsRowHeight { row, .. }| *row);

            let mut old_row_heights: Vec<JsRowHeight> = row_heights
                .iter()
                .map(|JsRowHeight { row, height }| {
                    let old_size = sheet.offsets.set_row_height(*row, *height);
                    JsRowHeight {
                        row: *row,
                        height: old_size,
                    }
                })
                .collect();

            // Update the row resize mode (Auto or Manual) for all rows
            let old_client_resized = row_heights
                .iter()
                .any(|JsRowHeight { row, .. }| sheet.update_row_resize(*row, client_resized));

            old_row_heights.sort_by_key(|JsRowHeight { row, .. }| *row);

            if old_row_heights == row_heights && old_client_resized == client_resized {
                return;
            }

            if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                row_heights.iter().for_each(|&JsRowHeight { row, height }| {
                    transaction.offsets_modified(sheet_id, None, Some(row), Some(height));
                });
            }

            let min_row = row_heights.iter().map(|row_height| row_height.row).min();
            if let Some(min_row) = min_row {
                let sheet = self.try_sheet(sheet_id).expect("sheet should exist");
                transaction.add_fill_cells_from_rows(sheet, min_row);
            }
            transaction.add_borders(sheet_id);
            if let Some(min_row) = min_row {
                self.thumbnail_dirty_sheet_rect(
                    transaction,
                    SheetRect::single_pos((1, min_row).into(), sheet_id),
                );
            }

            if transaction.is_user_ai_undo_redo() {
                transaction.forward_operations.push(Operation::ResizeRows {
                    sheet_id,
                    row_heights: row_heights.clone(),
                    client_resized,
                });

                transaction.reverse_operations.push(Operation::ResizeRows {
                    sheet_id,
                    row_heights: old_row_heights,
                    client_resized: old_client_resized,
                });
            }
        }
    }

    pub fn execute_resize_columns(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::ResizeColumns {
            sheet_id,
            column_widths,
        } = op
        {
            let Some(sheet) = self.try_sheet_mut(sheet_id) else {
                // sheet may have been deleted
                return;
            };

            let mut old_column_widths: Vec<JsColumnWidth> = column_widths
                .iter()
                .map(|JsColumnWidth { column, width }| {
                    let old_size = sheet.offsets.set_column_width(*column, *width);
                    JsColumnWidth {
                        column: *column,
                        width: old_size,
                    }
                })
                .collect();

            old_column_widths.sort_by_key(|JsColumnWidth { column, .. }| *column);

            if old_column_widths == column_widths {
                return;
            }

            if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                column_widths
                    .iter()
                    .for_each(|&JsColumnWidth { column, width }| {
                        transaction.offsets_modified(sheet_id, Some(column), None, Some(width));
                    });
            }

            if transaction.is_user_ai() {
                for JsColumnWidth { column, .. } in column_widths.iter() {
                    let rows = sheet.get_rows_with_wrap_in_column(*column, false);
                    if !rows.is_empty() {
                        let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                        resize_rows.extend(rows);
                    }
                }
            }

            let min_column = column_widths
                .iter()
                .map(|column_width| column_width.column)
                .min();
            if let Some(min_column) = min_column {
                let sheet = self.try_sheet(sheet_id).expect("sheet should exist");
                transaction.add_fill_cells_from_columns(sheet, min_column);
            }
            transaction.add_borders(sheet_id);
            if let Some(min_column) = min_column {
                self.thumbnail_dirty_sheet_rect(
                    transaction,
                    SheetRect::single_pos((min_column, 1).into(), sheet_id),
                );
            }

            if transaction.is_user_ai_undo_redo() {
                transaction
                    .forward_operations
                    .push(Operation::ResizeColumns {
                        sheet_id,
                        column_widths: column_widths.clone(),
                    });

                transaction
                    .reverse_operations
                    .push(Operation::ResizeColumns {
                        sheet_id,
                        column_widths: old_column_widths,
                    });
            }
        }
    }

    pub fn execute_default_column_size(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let DefaultColumnSize { sheet_id, size } = op);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return;
        };

        let existing_offsets = sheet.offsets.clear_widths();

        let old_size = sheet.offsets.set_default_width(size);

        if (cfg!(target_family = "wasm") || cfg!(test))
            && !transaction.is_server()
            && let Some(sheet) = self.try_sheet(sheet_id)
        {
            transaction.sheet_info.insert(sheet_id);
            transaction.add_dirty_hashes_from_selections(
                sheet,
                &self.a1_context,
                vec![A1Selection::all(sheet_id)],
            );
            transaction.add_all_fill_cells(sheet);
            transaction.add_borders(sheet_id);
        }

        // Changing default column size affects all columns including thumbnail area
        self.thumbnail_dirty_sheet_rect(
            transaction,
            SheetRect::single_pos((1, 1).into(), sheet_id),
        );

        if transaction.is_user_ai_undo_redo() {
            transaction.forward_operations.push(op);

            transaction
                .reverse_operations
                .push(Operation::ResizeColumns {
                    sheet_id,
                    column_widths: existing_offsets
                        .into_iter()
                        .map(|(i, size)| JsColumnWidth {
                            column: i,
                            width: size,
                        })
                        .collect(),
                });

            transaction
                .reverse_operations
                .push(Operation::DefaultColumnSize {
                    sheet_id,
                    size: old_size,
                });
        }
    }

    pub fn execute_default_row_size(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let DefaultRowSize { sheet_id, size } = op);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return;
        };

        let existing_offsets = sheet.offsets.clear_heights();

        let old_size = sheet.offsets.set_default_height(size);

        if (cfg!(target_family = "wasm") || cfg!(test))
            && !transaction.is_server()
            && let Some(sheet) = self.try_sheet(sheet_id)
        {
            transaction.sheet_info.insert(sheet_id);
            transaction.add_dirty_hashes_from_selections(
                sheet,
                &self.a1_context,
                vec![A1Selection::all(sheet_id)],
            );
            transaction.add_all_fill_cells(sheet);
            transaction.add_borders(sheet_id);
        }

        // Changing default row size affects all rows including thumbnail area
        self.thumbnail_dirty_sheet_rect(
            transaction,
            SheetRect::single_pos((1, 1).into(), sheet_id),
        );

        if transaction.is_user_ai_undo_redo() {
            transaction.forward_operations.push(op);

            transaction.reverse_operations.push(Operation::ResizeRows {
                sheet_id,
                row_heights: existing_offsets
                    .into_iter()
                    .map(|(i, size)| JsRowHeight {
                        row: i,
                        height: size,
                    })
                    .collect(),
                client_resized: true, // These were manually set heights
            });

            transaction
                .reverse_operations
                .push(Operation::DefaultRowSize {
                    sheet_id,
                    size: old_size,
                });
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::{
        controller::GridController,
        grid::js_types::JsColumnWidth,
        wasm_bindings::js::{clear_js_calls, expect_js_call, expect_js_offsets},
    };

    use crate::test_util::*;

    // also see tests in sheet_offsets.rs

    #[test]
    fn test_execute_operation_resize_column() {
        clear_js_calls();

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let column = 0;
        let new_size = 120.0;
        gc.commit_single_resize(sheet_id, Some(column), None, new_size, None, false);
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
        gc.commit_single_resize(sheet_id, None, Some(row), new_size, None, false);
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

    #[test]
    fn test_execute_resize_columns() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        gc.resize_columns(
            sheet_id,
            vec![
                JsColumnWidth {
                    column: 2,
                    width: 200.0,
                },
                JsColumnWidth {
                    column: 4,
                    width: 400.0,
                },
            ],
            None,
            false,
        );
        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.offsets.column_width(2), 200.0);
        assert_eq!(sheet.offsets.column_width(4), 400.0);
    }

    #[test]
    fn test_thumbnail_dirty_resize_column_in_range() {
        clear_js_calls();

        // Resizing a column within thumbnail range should mark thumbnail as dirty
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Get thumbnail bounds
        let thumbnail = gc.sheet(sheet_id).offsets.thumbnail();

        // Resize a column within the thumbnail range (column 1 is always in range)
        let column = 1;
        assert!(column <= thumbnail.max.x, "Column should be in thumbnail range");

        gc.commit_single_resize(sheet_id, Some(column as i32), None, 150.0, None, false);

        // Verify that jsGenerateThumbnail was called, indicating thumbnail was marked dirty
        expect_js_call("jsGenerateThumbnail", "".to_string(), true);
    }

    #[test]
    fn test_thumbnail_dirty_resize_row_in_range() {
        clear_js_calls();

        // Resizing a row within thumbnail range should mark thumbnail as dirty
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Get thumbnail bounds
        let thumbnail = gc.sheet(sheet_id).offsets.thumbnail();

        // Resize a row within the thumbnail range (row 1 is always in range)
        let row = 1;
        assert!(row <= thumbnail.max.y, "Row should be in thumbnail range");

        gc.commit_single_resize(sheet_id, None, Some(row as i32), 30.0, None, false);

        // Verify that jsGenerateThumbnail was called, indicating thumbnail was marked dirty
        expect_js_call("jsGenerateThumbnail", "".to_string(), true);
    }

    #[test]
    fn test_thumbnail_dirty_default_column_size() {
        clear_js_calls();

        // Changing default column size should always mark thumbnail as dirty
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Change default column width (select all + resize)
        gc.resize_all_columns(sheet_id, 150.0, None, false);

        // Verify the default was changed
        let (default_width, _) = gc.sheet(sheet_id).offsets.defaults();
        assert_eq!(default_width, 150.0);

        // Verify that jsGenerateThumbnail was called, indicating thumbnail was marked dirty
        expect_js_call("jsGenerateThumbnail", "".to_string(), true);
    }

    #[test]
    fn test_thumbnail_dirty_default_row_size() {
        clear_js_calls();

        // Changing default row size should always mark thumbnail as dirty
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Change default row height (select all + resize)
        gc.resize_all_rows(sheet_id, 30.0, None, false);

        // Verify the default was changed
        let (_, default_height) = gc.sheet(sheet_id).offsets.defaults();
        assert_eq!(default_height, 30.0);

        // Verify that jsGenerateThumbnail was called, indicating thumbnail was marked dirty
        expect_js_call("jsGenerateThumbnail", "".to_string(), true);
    }
}
