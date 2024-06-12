use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    Pos, SheetPos, SheetRect,
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
            transaction
                .forward_operations
                .push(Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size,
                    client_resized,
                });

            let old_size = sheet.offsets.set_column_width(column, new_size);

            transaction.reverse_operations.insert(
                0,
                Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size: old_size,
                    client_resized: false,
                },
            );

            if (cfg!(target_family = "wasm") || cfg!(test))
                && (transaction.is_undo_redo()
                    || transaction.is_multiplayer()
                    || (!client_resized && transaction.is_user()))
            {
                crate::wasm_bindings::js::jsOffsetsModified(
                    sheet_id.to_string(),
                    Some(column),
                    None,
                    new_size,
                );
            }

            if !transaction.is_server() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_pos(SheetPos {
                    x: column,
                    y: 0,
                    sheet_id,
                });

                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let Some(column_bounds) = sheet.column_bounds(column, true) {
                        let sheet_rect = SheetRect {
                            min: Pos {
                                x: column,
                                y: column_bounds.0,
                            },
                            max: Pos {
                                x: column,
                                y: column_bounds.1,
                            },
                            sheet_id,
                        };
                        self.send_render_cells(&sheet_rect);
                        self.start_auto_resize_row_heights(transaction, &sheet_rect);
                    }
                }
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
            transaction.forward_operations.push(Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
                client_resized,
            });

            let old_size = sheet.offsets.set_row_height(row, new_size);
            let old_client_resize = sheet.update_row_resize(row, client_resized);

            transaction.reverse_operations.insert(
                0,
                Operation::ResizeRow {
                    sheet_id,
                    row,
                    new_size: old_size,
                    client_resized: old_client_resize,
                },
            );

            if (cfg!(target_family = "wasm") || cfg!(test))
                && (transaction.is_undo_redo()
                    || transaction.is_multiplayer()
                    || (!client_resized && transaction.is_user()))
            {
                crate::wasm_bindings::js::jsOffsetsModified(
                    sheet_id.to_string(),
                    None,
                    Some(row),
                    new_size,
                );
            }

            if !transaction.is_server() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_pos(SheetPos {
                    x: 0,
                    y: row,
                    sheet_id,
                });

                if let Some(sheet) = self.try_sheet(sheet_id) {
                    if let Some(row_bounds) = sheet.row_bounds(row, true) {
                        let sheet_rect = SheetRect {
                            min: Pos {
                                x: row_bounds.0,
                                y: row,
                            },
                            max: Pos {
                                x: row_bounds.1,
                                y: row,
                            },
                            sheet_id,
                        };
                        self.send_render_cells(&sheet_rect);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{controller::GridController, wasm_bindings::js::expect_js_call};
    use serial_test::serial;

    // also see tests in sheet_offsets.rs

    #[test]
    #[serial]
    fn test_execute_operation_resize_column() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let column = 0;
        let new_size = 100.0;
        gc.commit_single_resize(sheet_id, Some(column), None, new_size, None);
        let column_width = gc
            .grid
            .try_sheet(sheet_id)
            .unwrap()
            .offsets
            .column_width(column as i64);
        assert_eq!(column_width, new_size);

        expect_js_call(
            "jsOffsetsModified",
            format!(
                "{},{:?},{:?},{}",
                sheet_id,
                Some(column),
                None::<i64>,
                new_size
            ),
            true,
        );
    }

    #[test]
    #[serial]
    fn test_execute_operation_resize_row() {
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

        expect_js_call(
            "jsOffsetsModified",
            format!(
                "{},{:?},{:?},{}",
                sheet_id,
                None::<i64>,
                Some(row),
                new_size
            ),
            true,
        );
    }
}
