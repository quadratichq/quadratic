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
                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(&sheet_rect);

                let Some(sheet) = self.try_sheet_mut(sheet_rect.sheet_id) else {
                    // sheet may have been deleted
                    return;
                };
                let old_borders = sheet.set_region_borders(&sheet_rect.into(), borders.clone());

                transaction.forward_operations.push(Operation::SetBorders {
                    sheet_rect,
                    borders,
                });
                transaction.reverse_operations.insert(
                    0,
                    Operation::SetBorders {
                        sheet_rect,
                        borders: old_borders,
                    },
                );

                if cfg!(test) || (cfg!(target_family = "wasm") && !transaction.is_server()) {
                    self.send_updated_bounds(sheet_rect.sheet_id);
                    if let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) {
                        if let Ok(borders) = serde_json::to_string(&sheet.render_borders()) {
                            crate::wasm_bindings::js::jsSheetBorders(
                                sheet_rect.sheet_id.to_string(),
                                borders,
                            );
                        }
                    }
                }
            }
            _ => unreachable!("Expected Operation::SetBorders"),
        }
    }
}
