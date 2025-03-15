use crate::{
    a1::A1Selection,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::{
            clipboard::{ClipboardOperation, PasteSpecial},
            operation::Operation,
        },
        GridController,
    },
    grid::{GridBounds, SheetId},
    CopyFormats,
};

impl GridController {
    pub fn move_columns_action(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        col_start: i64,
        col_end: i64,
        to: i64,
    ) {
        let context = self.a1_context().clone();
        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return;
        };

        // copy all data in the columns range
        let html = {
            let selection = A1Selection::cols(sheet_id, col_start, col_end);
            let Ok(clipboard) =
                sheet.copy_to_clipboard(&selection, &context, ClipboardOperation::Cut, false)
            else {
                return;
            };
            clipboard.html
        };

        // delete existing columns

        let min_column = col_start.min(col_end);
        sheet.delete_columns(transaction, (col_start..=col_end).collect());

        // update information for all cells to the right of the deleted column
        if let Some(sheet) = self.try_sheet(sheet_id) {
            if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                sheet_rect.min.x = min_column;
                self.check_deleted_data_tables(transaction, &sheet_rect);
                self.add_compute_operations(transaction, &sheet_rect, None);
                self.check_all_spills(transaction, sheet_rect.sheet_id);
            }
        }

        // calculate the adjusted to value based on whether we're moving columns
        // before, between, or after the source columns
        let adjusted_to = if to > col_end {
            to - (col_end - col_start + 1)
        } else if to > col_start && to <= col_end {
            col_start
        } else {
            to
        };

        // insert new columns at the adjusted location
        if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            for col in adjusted_to..=adjusted_to + col_end - col_start {
                sheet.insert_column(transaction, col, CopyFormats::None, false);
            }
        }

        // paste the copied data into the new columns
        let selection = A1Selection::from_single_cell((to, 1, sheet_id).into());
        if let Ok(ops) = self.paste_html_operations(&selection, html, PasteSpecial::None) {
            transaction.operations.extend(ops);
        }
    }

    pub fn move_rows_action(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        row_start: i64,
        row_end: i64,
        to: i64,
    ) {
        let context = self.a1_context().clone();
        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return;
        };

        // copy all data in the rows range
        let html = {
            let selection = A1Selection::rows(sheet_id, row_start, row_end);
            let Ok(clipboard) =
                sheet.copy_to_clipboard(&selection, &context, ClipboardOperation::Cut, false)
            else {
                return;
            };
            clipboard.html
        };

        // delete existing rows
        let min_row = row_start.min(row_end);
        sheet.delete_rows(transaction, (row_start..=row_end).collect());

        // update information for all cells below the deleted rows
        if let Some(sheet) = self.try_sheet(sheet_id) {
            if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
                let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
                sheet_rect.min.y = min_row;
                self.check_deleted_data_tables(transaction, &sheet_rect);
                self.add_compute_operations(transaction, &sheet_rect, None);
                self.check_all_spills(transaction, sheet_rect.sheet_id);
            }
        }

        // calculate the adjusted to value based on whether we're moving rows
        // before, between, or after the source rows
        let adjusted_to = if to > row_end {
            to - (row_end - row_start + 1)
        } else if to > row_start && to <= row_end {
            row_start
        } else {
            to
        };

        // insert new rows at the adjusted location
        if let Some(sheet) = self.try_sheet_mut(sheet_id) {
            for row in adjusted_to..=adjusted_to + row_end - row_start {
                sheet.insert_row(transaction, row, CopyFormats::None, false);
            }
        }

        // paste the copied data into the new rows
        let selection = A1Selection::from_single_cell((1, to, sheet_id).into());
        if let Ok(ops) = self.paste_html_operations(&selection, html, PasteSpecial::None) {
            transaction.operations.extend(ops);
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

    #[test]
    fn test_move_rows_values() {
        let mut gc = GridController::test();

        (&mut gc, 1, 3, 3, 4, vec!["1", "2", "3"]);

        print_first_sheet(&gc);

        gc.move_rows(SheetId::TEST, 3, 3, 5, None);

        assert_display_cell_value_first_sheet(&gc, 3, 4, "1");
        assert_display_cell_value_first_sheet(&gc, 3, 5, "2");
        assert_display_cell_value_first_sheet(&gc, 3, 6, "3");

        print_first_sheet(&gc);

        assert_display_cell_value_first_sheet(&gc, 3, 5, "1");
        assert_display_cell_value_first_sheet(&gc, 3, 6, "2");
        assert_display_cell_value_first_sheet(&gc, 3, 7, "3");
    }
}
