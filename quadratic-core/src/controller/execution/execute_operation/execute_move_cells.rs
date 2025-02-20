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
            let context = self.a1_context();
            let mut selection = A1Selection::from_rect(source);
            selection.check_for_table_ref(context);

            let mut ops = vec![];

            if let Ok((cut_ops, js_clipboard)) = self.cut_to_clipboard_operations(&selection) {
                ops.extend(cut_ops);

                match self.paste_html_operations(
                    &A1Selection::from_single_cell(dest),
                    js_clipboard.html,
                    PasteSpecial::None,
                ) {
                    Ok(paste_ops) => ops.extend(paste_ops),
                    Err(_) => return,
                }
            }

            transaction.operations.extend(ops);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        cellvalue::Import,
        controller::{
            active_transactions::transaction_name::TransactionName,
            user_actions::import::tests::{simple_csv, simple_csv_at},
        },
        test_util::print_table,
        CellValue, Rect, SheetPos,
    };

    use super::*;

    #[test]
    fn test_move_cells() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();

        print_table(&gc, sheet_id, Rect::new(1, 1, 4, 12));

        let dest_pos = pos![F1];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));
        let ops = vec![Operation::MoveCells {
            source: data_table.output_sheet_rect(sheet_pos, true),
            dest: sheet_dest_pos,
        }];
        gc.start_user_transaction(ops, None, TransactionName::MoveCells);
        print_table(&gc, sheet_id, Rect::new(6, 1, 10, 12));
    }

    #[test]
    fn test_move_data_table_within_its_current_output_rect() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos![E2]);
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();

        assert_eq!(
            gc.sheet(sheet_id).cell_value(pos),
            Some(CellValue::Import(Import::new(file_name.to_string())))
        );

        print_table(&gc, sheet_id, Rect::new(5, 2, 9, 13));

        let dest_pos = pos![F4];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));

        let ops = vec![Operation::MoveCells {
            source: data_table.output_sheet_rect(sheet_pos, true),
            dest: sheet_dest_pos,
        }];
        gc.start_user_transaction(ops, None, TransactionName::MoveCells);
        print_table(&gc, sheet_id, Rect::new(5, 2, 9, 13));

        assert_eq!(gc.sheet(sheet_id).cell_value(pos), None);
        assert!(gc.sheet(sheet_id).data_table(pos).is_none());

        assert_eq!(
            gc.sheet(sheet_id).cell_value(dest_pos),
            Some(CellValue::Import(Import::new(file_name.to_string())))
        );
        assert!(gc.sheet(sheet_id).data_table(dest_pos).is_some());
    }
}
