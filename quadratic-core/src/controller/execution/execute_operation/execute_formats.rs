use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;
use crate::controller::GridController;

impl GridController {
    pub fn execute_set_cell_formats_a1(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetCellFormatsA1 { sheet_id, formats } = op);

        transaction.generate_thumbnail |= self.thumbnail_dirty_formats(sheet_id, &formats);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        let (reverse_operations, hashes, rows, html, fills_changed) =
            sheet.set_formats_a1(&formats);

        if reverse_operations.is_empty() {
            return;
        }

        if !transaction.is_server() {
            self.send_updated_bounds(sheet_id);

            if !hashes.is_empty() {
                let dirty_hashes = transaction.dirty_hashes.entry(sheet_id).or_default();
                dirty_hashes.extend(hashes);
            }

            if !rows.is_empty() && transaction.is_user() {
                let resize_rows = transaction.resize_rows.entry(sheet_id).or_default();
                resize_rows.extend(rows);
            }

            if !html.is_empty() {
                // not the best way, but render_size is moving to data_tables in
                // the near future, so don't worry about this
                let html_cells = transaction.html_cells.entry(sheet_id).or_default();
                html_cells.extend(html.clone());
                let image_cells = transaction.image_cells.entry(sheet_id).or_default();
                image_cells.extend(html);
            }

            if fills_changed {
                transaction.fill_cells.insert(sheet_id);
            }
        }

        transaction
            .forward_operations
            .push(Operation::SetCellFormatsA1 { sheet_id, formats });

        transaction
            .reverse_operations
            .extend(reverse_operations.iter().cloned());
    }
}

#[cfg(test)]
mod test {}
