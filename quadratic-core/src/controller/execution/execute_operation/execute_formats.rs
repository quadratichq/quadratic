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

                // For infinite fills, also mark the affected finite fill hashes as dirty
                // since the Contiguous2D structure may have been modified
                if let Some(fill_color) = &formats.fill_color {
                    let sheet = self.try_sheet(sheet_id).expect("sheet should exist");
                    for (x1, y1, x2, y2, _) in fill_color.to_rects() {
                        match (x2, y2) {
                            // Sheet fill - mark all hashes
                            (None, None) => {
                                transaction.add_fill_cells_from_rows(sheet, 1);
                            }
                            // Row fill - mark hashes from this row
                            (None, Some(y2)) => {
                                transaction.add_fill_cells_from_rows(sheet, y1);
                                // Also need to mark rows up to y2 if it's a range
                                if y2 > y1 {
                                    transaction.add_fill_cells_from_rows(sheet, y2);
                                }
                            }
                            // Column fill - mark hashes from this column
                            (Some(x2), None) => {
                                transaction.add_fill_cells_from_columns(sheet, x1);
                                // Also need to mark columns up to x2 if it's a range
                                if x2 > x1 {
                                    transaction.add_fill_cells_from_columns(sheet, x2);
                                }
                            }
                            // Finite fill - already handled by fill_bounds
                            (Some(_), Some(_)) => {}
                        }
                    }
                }
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
