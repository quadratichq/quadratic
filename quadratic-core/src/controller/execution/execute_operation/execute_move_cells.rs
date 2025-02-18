use std::collections::VecDeque;

use crate::{
    a1::A1Selection,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::{clipboard::PasteSpecial, operation::Operation},
        GridController,
    },
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
            let context = self.a1_context();
            let mut selection = A1Selection::from_rect(source);
            selection.check_for_table_ref(context);

            if let Ok((cut_ops, js_clipboard)) = self.cut_to_clipboard_operations(&selection) {
                operations.extend(cut_ops);

                if let Ok(paste_ops) = self.paste_html_operations(
                    &A1Selection::from_single_cell(dest),
                    js_clipboard.html,
                    PasteSpecial::None,
                ) {
                    operations.extend(paste_ops);
                }

                operations.extend(transaction.operations.drain(..));
                transaction.operations = operations;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::user_actions::import::tests::simple_csv, test_util::print_table, Rect, SheetPos,
    };

    use super::*;

    #[test]
    fn test_move_cells() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap().to_owned();

        print_table(&gc, sheet_id, Rect::new(1, 1, 4, 12));

        let dest_pos = pos![F1];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));
        let mut transaction = PendingTransaction::default();
        let op = Operation::MoveCells {
            source: data_table.output_sheet_rect(sheet_pos, true),
            dest: sheet_dest_pos,
        };
        gc.execute_move_cells(&mut transaction, op);
        print_table(&gc, sheet_id, Rect::new(6, 1, 10, 12));
    }
}
