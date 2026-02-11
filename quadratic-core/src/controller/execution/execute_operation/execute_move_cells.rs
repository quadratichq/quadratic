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
    use crate::test_util::*;
    use crate::{
        Rect, SheetPos,
        controller::{
            active_transactions::transaction_name::TransactionName,
            user_actions::import::tests::{simple_csv, simple_csv_at},
        },
    };

    use super::*;

    #[test]
    fn test_move_cells() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        let dest_pos = pos![F1];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));
        let ops = vec![Operation::MoveCells {
            source: data_table.output_sheet_rect(sheet_pos, true),
            dest: sheet_dest_pos,
            columns: false,
            rows: false,
        }];
        gc.start_user_ai_transaction(ops, None, TransactionName::MoveCells, false);
        print_table_in_rect(&gc, sheet_id, Rect::new(6, 1, 10, 12));
    }

    #[test]
    fn test_move_data_table_within_its_current_output_rect() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv_at(pos![E2]);
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();

        assert_import(&gc, sheet_pos, file_name, 4, 12);

        let dest_pos = pos![F4];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));

        gc.move_cols_rows(
            data_table.output_sheet_rect(sheet_pos, true),
            sheet_dest_pos,
            false,
            false,
            None,
            false,
        );

        assert_eq!(gc.sheet(sheet_id).cell_value(pos), None);
        assert!(gc.sheet(sheet_id).data_table_at(&pos).is_none());

        assert_import(&gc, sheet_dest_pos, file_name, 4, 12);
    }

    #[test]
    fn test_move_rich_text_cell() {
        use crate::CellValue;
        use crate::cellvalue::TextSpan;

        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a RichText cell with bold and italic spans at A1
        let spans = vec![
            TextSpan {
                text: "Bold ".to_string(),
                bold: Some(true),
                ..Default::default()
            },
            TextSpan {
                text: "Italic ".to_string(),
                italic: Some(true),
                ..Default::default()
            },
            TextSpan::plain("Normal"),
        ];
        let source_pos = pos![A1];
        let sheet_source_pos = SheetPos::from((source_pos, sheet_id));
        gc.set_cell_rich_text(sheet_source_pos, spans.clone(), None);

        // Verify the RichText cell is at A1
        let cell_value = gc.sheet(sheet_id).cell_value(source_pos);
        assert!(
            matches!(cell_value, Some(CellValue::RichText(_))),
            "Expected RichText at source position before move, got {:?}",
            cell_value
        );

        // Move the cell from A1 to C3
        let dest_pos = pos![C3];
        let sheet_dest_pos = SheetPos::from((dest_pos, sheet_id));
        gc.move_cols_rows(
            crate::SheetRect::single_sheet_pos(sheet_source_pos),
            sheet_dest_pos,
            false,
            false,
            None,
            false,
        );

        // Verify the source cell (A1) is now empty
        let source_value = gc.sheet(sheet_id).cell_value(source_pos);
        assert!(
            source_value.is_none(),
            "Source cell should be empty after move, got {:?}",
            source_value
        );

        // Verify the destination cell (C3) has the RichText
        let dest_value = gc.sheet(sheet_id).cell_value(dest_pos);
        let Some(CellValue::RichText(moved_spans)) = dest_value else {
            panic!(
                "Destination cell should have RichText after move, got {:?}",
                dest_value
            );
        };

        // Verify the spans are preserved
        assert_eq!(moved_spans.len(), 3);
        assert_eq!(moved_spans[0].text, "Bold ");
        assert_eq!(moved_spans[0].bold, Some(true));
        assert_eq!(moved_spans[1].text, "Italic ");
        assert_eq!(moved_spans[1].italic, Some(true));
        assert_eq!(moved_spans[2].text, "Normal");
    }
}
