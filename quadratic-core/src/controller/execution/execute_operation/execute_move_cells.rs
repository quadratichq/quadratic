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
            let selection = A1Selection::from_rect(source);
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
