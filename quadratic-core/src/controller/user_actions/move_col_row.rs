use crate::{
    a1::A1Selection,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::clipboard::{ClipboardOperation, PasteSpecial},
        GridController,
    },
    grid::SheetId,
    CopyFormats,
};

impl GridController {
    pub fn move_cols(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        col_start: i64,
        col_end: i64,
        to: i64,
    ) {
        dbgjs!(format!(
            "move_cols: {:?}",
            (sheet_id, col_start, col_end, to)
        ));
        let context = self.a1_context().clone();
        let mut html: Option<String> = None;
        if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            let selection = A1Selection::cols(sheet_id, col_start, col_end);
            if let Ok(clipboard) =
                sheet.copy_to_clipboard(&selection, &context, ClipboardOperation::Cut, false)
            {
                for col in col_end..=col_start {
                    sheet.delete_column(transaction, col);
                }
                let adjusted_to = if to > col_start {
                    to - (col_end - col_start + 1)
                } else {
                    to
                };
                for col in adjusted_to..=adjusted_to + (col_end - col_start) {
                    sheet.insert_column(transaction, col, CopyFormats::None, false);
                }
                html = Some(clipboard.html);
            }
        }

        if let Some(html) = html {
            let selection = A1Selection::from_single_cell((to, 1, sheet_id).into());
            if let Ok(ops) = self.paste_html_operations(&selection, html, PasteSpecial::None) {
                transaction.operations.extend(ops);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::{assert_display_cell_value_first_sheet, print_first_sheet};

    use super::*;

    #[test]
    fn test_move_cols_values() {
        let mut gc = GridController::test();

        (&mut gc, 3, 4, 1, 3, vec!["1", "2", "3"]);

        print_first_sheet(&gc);

        gc.move_columns(SheetId::TEST, 3, 3, 5, None);

        assert_display_cell_value_first_sheet(&gc, 4, 3, "1");
        assert_display_cell_value_first_sheet(&gc, 5, 3, "2");
        assert_display_cell_value_first_sheet(&gc, 6, 3, "3");

        print_first_sheet(&gc);

        assert_display_cell_value_first_sheet(&gc, 5, 3, "1");
        assert_display_cell_value_first_sheet(&gc, 6, 3, "2");
        assert_display_cell_value_first_sheet(&gc, 7, 3, "3");
    }
}
