use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;

impl GridController {
    pub fn execute_set_cell_formats_a1(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetCellFormatsA1 { sheet_id, formats } = op);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        let (reverse_operations, hashes, rows, fill_bounds, has_meta_fills) =
            sheet.set_formats_a1(&formats);

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

            if let Some(fill_bounds) = fill_bounds {
                transaction.add_fill_cells(sheet_id, fill_bounds);
            }

            if has_meta_fills {
                transaction.add_sheet_meta_fills(sheet_id);
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
