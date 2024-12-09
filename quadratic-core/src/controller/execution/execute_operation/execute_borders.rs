use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};

impl GridController {
    /// **Deprecated** Nov 2024 in favor of [`Self::execute_set_borders_a1()`].
    pub fn execute_set_borders_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetBordersSelection { selection, borders } = op);

        if self.thumbnail_dirty_selection(&selection) {
            transaction.generate_thumbnail = true;
        }

        let Some(sheet) = self.try_sheet_mut(selection.sheet_id) else {
            return; // sheet may have been deleted
        };

        transaction
            .reverse_operations
            .extend(sheet.borders.set_borders_selection(&selection, &borders));

        transaction
            .forward_operations
            .push(Operation::SetBordersSelection {
                selection: selection.clone(),
                borders,
            });

        transaction.sheet_borders.insert(selection.sheet_id);
    }

    pub fn execute_set_borders_a1(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetBordersA1 { sheet_id, borders } = op);

        // todo: self.thumbnail_dirty_borders (similar to thumbnail_dirty_formats)
        // transaction.generate_thumbnail |= self.thumbnail_dirty_ranges(&ranges);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        transaction
            .reverse_operations
            .extend(sheet.borders_a1.set_borders_a1(sheet_id, &borders));

        transaction
            .forward_operations
            .push(Operation::SetBordersA1 { sheet_id, borders });

        transaction.sheet_borders.insert(sheet_id);
    }
}
