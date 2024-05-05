use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    SheetRect,
};

impl GridController {
    pub fn execute_move_cells(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::MoveCells { source, dest } = op {
            if !transaction.is_user() || transaction.is_undo_redo() {
                transaction
                    .forward_operations
                    .push(Operation::MoveCells { source, dest });
                let dest_sheet_rect: SheetRect = (
                    dest.x,
                    dest.y,
                    source.width() as i64,
                    source.height() as i64,
                    dest.sheet_id,
                )
                    .into();
                transaction.reverse_operations.push(Operation::MoveCells {
                    source: dest_sheet_rect.clone(),
                    dest: (source.min.x, source.min.y, source.sheet_id).into(),
                });

                // copy (pos, code_run) within source rect
                let Some(source_sheet) = self.try_sheet(source.sheet_id) else {
                    return;
                };
                let code_runs = source_sheet.remove_code_runs_in_rect(source.into());

                // get source and dest sheets
                let (Some(source_sheet), Some(dest_sheet)) = (
                    self.grid.try_sheet_mut(source.sheet_id),
                    self.grid.try_sheet_mut(dest.sheet_id),
                ) else {
                    return;
                };

                // delete source cell values and set them in the dest sheet
                // (this also deletes any related code_runs)
                let cell_values = source_sheet.delete_cell_values(source.into());
                dest_sheet.set_cell_values(dest_sheet_rect.into(), &cell_values);

                // add code_runs to dest sheet
                code_runs.iter().for_each(|(pos, code_run)| {
                    dest_sheet.set_code_run(
                        (pos.x - source.min.x + dest.x, pos.y - source.min.y + dest.y).into(),
                        Some(*code_run.to_owned()),
                    );
                });

                if transaction.is_user() {
                    self.check_deleted_code_runs(transaction, &source);
                    self.check_deleted_code_runs(transaction, &dest_sheet_rect);
                    self.add_compute_operations(transaction, &source, None);
                    self.add_compute_operations(transaction, &dest_sheet_rect, None);
                    self.check_all_spills(transaction, source.sheet_id);
                    if source.sheet_id != dest.sheet_id {
                        self.check_all_spills(transaction, dest.sheet_id);
                    }
                }
            }
        }
    }
}
