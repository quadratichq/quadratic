use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};

impl GridController {
    pub fn execute_set_borders_a1(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        unwrap_op!(let SetBordersA1 { sheet_id, borders } = op);

        transaction.generate_thumbnail |= self.thumbnail_dirty_borders(sheet_id, &borders);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        transaction
            .reverse_operations
            .extend(sheet.borders.set_borders_a1(sheet_id, &borders));

        transaction
            .forward_operations
            .push(Operation::SetBordersA1 { sheet_id, borders });

        transaction.sheet_borders.insert(sheet_id);
    }
}
