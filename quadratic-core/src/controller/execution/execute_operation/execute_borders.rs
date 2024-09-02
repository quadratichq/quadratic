use crate::{
    border_style::BorderStyleCellUpdate,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    selection::Selection,
    Pos, RunLengthEncoding,
};

impl GridController {
    /// This is deprecated and only included for offline transactions during the
    /// transition to the new borders operation.
    pub fn execute_set_borders(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        match op {
            Operation::SetBorders {
                sheet_rect,
                borders,
            } => {
                let selection = Selection::sheet_rect(sheet_rect);
                let mut borders_new = RunLengthEncoding::new();

                for y in sheet_rect.y_range() {
                    for x in sheet_rect.x_range() {
                        if let Some(original) = borders.per_cell.try_get_cell_border(Pos { x, y }) {
                            borders_new.push(BorderStyleCellUpdate {
                                top: original.borders[1].map(|b| Some(b.into())),
                                bottom: original.borders[3].map(|b| Some(b.into())),
                                left: original.borders[0].map(|b| Some(b.into())),
                                right: original.borders[2].map(|b| Some(b.into())),
                            });
                        } else {
                            borders_new.push(BorderStyleCellUpdate::default());
                        }
                    }
                }

                // We add the new borders operation to the front of the list so it's next.
                transaction
                    .operations
                    .push_front(Operation::SetBordersSelection {
                        selection,
                        borders: borders_new,
                    });
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
                transaction
                    .reverse_operations
                    .extend(sheet.borders.set_borders(&selection, &borders));

                transaction
                    .forward_operations
                    .push(Operation::SetBordersSelection {
                        selection: selection.clone(),
                        borders,
                    });

                if (cfg!(test) || cfg!(target_family = "wasm")) && !transaction.is_server() {
                    if let Some(sheet) = self.try_sheet(selection.sheet_id) {
                        sheet.borders.send_updated_borders(selection);
                    }
                }
            }
            _ => unreachable!("Expected Operation::SetBordersSelection"),
        }
    }
}
