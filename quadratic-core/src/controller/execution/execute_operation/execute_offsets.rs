use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    SheetPos,
};

impl GridController {
    pub fn execute_resize_column(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::ResizeColumn {
            sheet_id,
            column,
            new_size,
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
                });

            let old_size = sheet.offsets.set_column_width(column, new_size);

            transaction.reverse_operations.insert(
                0,
                Operation::ResizeColumn {
                    sheet_id,
                    column,
                    new_size: old_size,
                },
            );

            if transaction.is_user() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_pos(SheetPos {
                    x: column,
                    y: 0,
                    sheet_id,
                });
            }

            if cfg!(target_family = "wasm") {
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    crate::wasm_bindings::js::jsOffsetsModified(
                        sheet.id.to_string(),
                        Some(column),
                        None,
                        new_size,
                    );
                }
            }
        }
    }

    pub fn execute_resize_row(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::ResizeRow {
            sheet_id,
            row,
            new_size,
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
            });
            let old_size = sheet.offsets.set_row_height(row, new_size);

            transaction.reverse_operations.insert(
                0,
                Operation::ResizeRow {
                    sheet_id,
                    row,
                    new_size: old_size,
                },
            );

            if transaction.is_user_undo_redo() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_pos(SheetPos {
                    x: 0,
                    y: row,
                    sheet_id,
                });
            }

            if cfg!(target_family = "wasm") {
                if let Some(sheet) = self.try_sheet(sheet_id) {
                    crate::wasm_bindings::js::jsOffsetsModified(
                        sheet.id.to_string(),
                        None,
                        Some(row),
                        new_size,
                    );
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::controller::GridController;

    // also see tests in sheet_offsets.rs

    #[test]
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

        // todo: find some way to check if the js function was called
        // assert_eq!(summary.offsets_modified.len(), 1);
        // let mut offsets = HashSet::new();
        // offsets.insert(sheet_id);
        // assert_eq!(summary.offsets_modified, offsets);
    }

    #[test]
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

        // todo: find some way to test if the js function was called
        // assert_eq!(summary.offsets_modified.len(), 1);
        // let mut offsets = HashSet::new();
        // offsets.insert(sheet_id);
        // assert_eq!(summary.offsets_modified, offsets);
    }
}
