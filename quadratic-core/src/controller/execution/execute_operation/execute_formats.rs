use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;

impl GridController {
    pub(crate) fn execute_set_cell_formats_a1(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetCellFormatsA1 { sheet_id, formats } = op);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        let (reverse_operations, hashes, rows, fills_changed) = sheet.set_formats_a1(&formats);

        if reverse_operations.is_empty() {
            return;
        }

        self.send_updated_bounds(transaction, sheet_id);

        if !transaction.is_server() {
            if !hashes.is_empty() {
                let dirty_hashes = transaction.dirty_hashes.entry(sheet_id).or_default();
                dirty_hashes.extend(hashes);
            }

            if !rows.is_empty() && transaction.is_user_ai() {
                transaction
                    .resize_rows
                    .entry(sheet_id)
                    .or_default()
                    .extend(rows);
            }

            if fills_changed {
                transaction.add_fill_cells(sheet_id);
            }
        }

        if transaction.is_user_ai_undo_redo() {
            transaction.generate_thumbnail |= self.thumbnail_dirty_formats(sheet_id, &formats);

            transaction
                .forward_operations
                .push(Operation::SetCellFormatsA1 { sheet_id, formats });

            transaction
                .reverse_operations
                .extend(reverse_operations.iter().cloned());
        }
    }
}

#[cfg(test)]
mod test {}
