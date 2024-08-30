use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    GridController,
};

impl GridController {
    pub fn execute_set_borders(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        match op {
            Operation::SetBorders {
                sheet_rect,
                borders,
            } => {
                let Some(sheet) = self.try_sheet_mut(sheet_rect.sheet_id) else {
                    // sheet may have been deleted
                    return;
                };

                let old_borders = sheet.set_region_borders(&sheet_rect.into(), borders.clone());
                if borders == old_borders {
                    return;
                }

                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(&sheet_rect);

                transaction.forward_operations.push(Operation::SetBorders {
                    sheet_rect,
                    borders,
                });
                transaction.reverse_operations.push(Operation::SetBorders {
                    sheet_rect,
                    borders: old_borders,
                });

                if (cfg!(test) || cfg!(target_family = "wasm")) && !transaction.is_server() {
                    self.send_updated_bounds(sheet_rect.sheet_id);
                    self.send_render_borders(sheet_rect.sheet_id);
                }
            }
            _ => unreachable!("Expected Operation::SetBorders"),
        }
    }

    pub fn execute_set_borders_selection(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        match op {
            Operation::SetBordersSelection { selection, borders } => {
                let Some(sheet) = self.try_sheet_mut(selection.sheet_id) else {
                    // sheet may have been deleted
                    return;
                };
                sheet.borders(selection, borders);
            }
            _ => unreachable!("Expected Operation::SetBordersSelection"),
        }
    }
}
