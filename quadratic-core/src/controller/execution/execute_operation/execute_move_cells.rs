use std::collections::VecDeque;

use crate::controller::{
    active_transactions::pending_transaction::PendingTransaction, operations::operation::Operation,
    user_actions::clipboard::PasteSpecial, GridController,
};

impl GridController {
    pub fn execute_move_cells(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::MoveCells { source, dest } = op {
            // we replace the MoveCells operation with a series of cut/paste
            // operations so we don't have to reimplement it. There's definitely
            // a more efficient way to do this. todo: when rewriting the data
            // store, we should implement higher-level functions that would more
            // easily implement cut/paste/move without resorting to this
            // approach.
            let mut operations = VecDeque::new();
            let (cut_ops, _, html) = self.cut_to_clipboard_operations(source);
            operations.extend(cut_ops);
            if let Ok(paste_ops) = self.paste_html_operations(dest, html, PasteSpecial::None) {
                operations.extend(paste_ops);
            }
            operations.extend(transaction.operations.drain(..));
            transaction.operations = operations;

            // if !transaction.is_user() || transaction.is_undo_redo() {
            //     transaction
            //         .forward_operations
            //         .push(Operation::MoveCells { source, dest });
            //     let dest_sheet_rect: SheetRect = (
            //         dest.x,
            //         dest.y,
            //         source.width() as i64,
            //         source.height() as i64,
            //         dest.sheet_id,
            //     )
            //         .into();

            //     // copy (pos, code_run) within source rect
            //     let Some(source_sheet) = self.try_sheet(source.sheet_id) else {
            //         return;
            //     };
            //     let code_runs = source_sheet.remove_code_runs_in_rect(source.into());

            //     // get source and dest sheets
            //     let (Some(source_sheet), Some(dest_sheet)) = (
            //         self.grid.try_sheet_mut(source.sheet_id),
            //         self.grid.try_sheet_mut(dest.sheet_id),
            //     ) else {
            //         return;
            //     };

            //     // delete source cell values and set them in the dest sheet
            //     // (this also deletes any related code_runs)
            //     let cell_values = source_sheet.delete_cell_values(source.into());
            //     let old_dest_values =
            //         dest_sheet.merge_cell_values(dest_sheet_rect.into(), &cell_values);

            //     transaction
            //         .reverse_operations
            //         .push(Operation::SetCellValues {
            //             sheet_pos: source.into(),
            //             values: cell_values,
            //         });
            //     transaction
            //         .reverse_operations
            //         .push(Operation::SetCellValues {
            //             sheet_pos: dest_sheet_rect.into(),
            //             values: old_dest_values,
            //         });

            //     // add code_runs to dest sheet
            //     code_runs
            //         .iter()
            //         .enumerate()
            //         .for_each(|(index, (pos, code_run))| {
            //             let old_code_run = dest_sheet.set_code_run(
            //                 (pos.x - source.min.x + dest.x, pos.y - source.min.y + dest.y).into(),
            //                 Some(*code_run.to_owned()),
            //             );
            //             transaction.reverse_operations.push(Operation::SetCodeRun {
            //                 sheet_pos: (
            //                     pos.x - source.min.x + dest.x,
            //                     pos.y - source.min.y + dest.y,
            //                     dest.sheet_id,
            //                 )
            //                     .into(),
            //                 code_run: old_code_run,
            //                 index,
            //             });
            //             transaction.reverse_operation.push(Operation::SetCodeRun {
            //                 sheet_pos: pos.to_sheet_pos(source.sheet_id),
            //                 code_run,
            //                 index,
            //             })
            //         });

            //     // todo: formats & borders

            //     if transaction.is_user() {
            //         self.check_deleted_code_runs(transaction, &source);
            //         self.check_deleted_code_runs(transaction, &dest_sheet_rect);
            //         self.add_compute_operations(transaction, &source, None);
            //         self.add_compute_operations(transaction, &dest_sheet_rect, None);
            //         self.check_all_spills(transaction, source.sheet_id);
            //         if source.sheet_id != dest.sheet_id {
            //             self.check_all_spills(transaction, dest.sheet_id);
            //         }
            //     }
            // }
        }
    }
}
