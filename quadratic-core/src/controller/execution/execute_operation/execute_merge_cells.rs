use crate::{
    Rect,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
};

impl GridController {
    pub fn execute_set_merge_cells(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetMergeCells { sheet_id, merge_cells_updates } = op);

        let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
            return;
        };

        // find updates for client to re-render
        if cfg!(target_family = "wasm") || cfg!(test) {
            let rects = merge_cells_updates.to_rects().collect::<Vec<_>>();
            for (x1, y1, x2, y2, _) in rects {
                if let (Some(x2), Some(y2)) = (x2, y2) {
                    let rect = Rect::new(x1, y1, x2, y2);
                    transaction.add_dirty_hashes_from_sheet_rect(rect.to_sheet_rect(sheet_id));
                }
            }
        }

        transaction
            .forward_operations
            .push(Operation::SetMergeCells {
                sheet_id,
                merge_cells_updates: merge_cells_updates.clone(),
            });

        let merge_cells_updates = sheet.merge_cells.merge_cells_update(merge_cells_updates);
        transaction
            .reverse_operations
            .push(Operation::SetMergeCells {
                sheet_id,
                merge_cells_updates,
            });

        transaction.merge_cells_updates.insert(sheet_id);
    }
}
