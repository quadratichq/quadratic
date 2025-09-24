use crate::{
    a1::A1Selection,
    controller::{
        GridController,
        active_transactions::pending_transaction::PendingTransaction,
        operations::{clipboard::PasteSpecial, operation::Operation},
    },
};

impl GridController {
    pub fn execute_move_cells(&mut self, transaction: &mut PendingTransaction, op: Operation) {
        if let Operation::MoveCells {
            source,
            dest,
            columns,
            rows,
        } = op
        {
            // we replace the MoveCells operation with a series of cut/paste
            // operations so we don't have to reimplement it. There's definitely
            // a more efficient way to do this. todo: when rewriting the data
            // store, we should implement higher-level functions that would more
            // easily implement cut/paste/move without resorting to this
            // approach.
            let selection = if columns {
                A1Selection::cols(source.sheet_id, source.min.x, source.max.x)
            } else if rows {
                A1Selection::rows(source.sheet_id, source.min.y, source.max.y)
            } else {
                A1Selection::from_rect(source)
            };

            if let Ok((clipboard, mut ops)) = self.cut_to_clipboard_operations(&selection, false) {
                match self.paste_html_operations(
                    dest.into(),
                    dest.into(),
                    &A1Selection::from_single_cell(dest),
                    clipboard,
                    PasteSpecial::None,
                ) {
                    Ok((paste_ops, data_table_ops)) => {
                        ops.extend(paste_ops);
                        ops.extend(data_table_ops);
                    }
                    Err(_) => return,
                }
                transaction.operations.extend(ops);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{SheetPos, controller::user_actions::import::tests::simple_csv_at, test_util::*};

    #[test]
    fn test_move_data_table_within_its_current_output_rect() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos![E2]);
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        assert_import(&gc, sheet_pos, &file_name, 4, 12);

        let dest_pos = pos![F4];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));

        gc.move_cells(
            data_table.output_sheet_rect(sheet_pos, true),
            sheet_dest_pos,
            false,
            false,
            None,
        );

        assert_eq!(gc.sheet(sheet_id).cell_value(pos), None);
        assert!(gc.sheet(sheet_id).data_table_at(&pos).is_none());

        assert_import(&gc, sheet_dest_pos, &file_name, 4, 12);
    }
}
