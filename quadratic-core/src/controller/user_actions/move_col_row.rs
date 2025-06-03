use crate::{
    CopyFormats,
    a1::A1Selection,
    controller::{
        GridController,
        active_transactions::pending_transaction::PendingTransaction,
        operations::clipboard::{ClipboardOperation, PasteSpecial},
    },
    grid::{GridBounds, SheetId},
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
        let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
            return;
        };

        // copy all data in the columns range
        let html = {
            let selection = A1Selection::cols(sheet_id, col_start, col_end);
            let Ok(clipboard) = sheet.copy_to_clipboard(
                &selection,
                &self.a1_context,
                ClipboardOperation::Cut,
                false,
            ) else {
                return;
            };
            clipboard.html
        };

        // delete existing columns
        let min_column = col_start.min(col_end);
        sheet.delete_columns(
            transaction,
            (col_start..=col_end).collect(),
            Default::default(),
            &self.a1_context,
        );

        // update information for all cells to the right of the deleted column
        if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
            let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
            sheet_rect.min.x = min_column;
            self.check_deleted_data_tables(transaction, &sheet_rect);
            self.update_spills_in_sheet_rect(transaction, &sheet_rect);
            self.add_compute_operations(transaction, &sheet_rect, None);
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
        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            for col in adjusted_to..=adjusted_to + col_end - col_start {
                sheet.insert_column(transaction, col, CopyFormats::None, &self.a1_context);
            }
        }

        // paste the copied data into the new columns
        let selection = A1Selection::from_single_cell((to, 1, sheet_id).into());
        let insert_at = selection.cursor;

        if let Ok((ops, data_table_ops)) =
            self.paste_html_operations(insert_at, insert_at, &selection, html, PasteSpecial::None)
        {
            transaction.operations.extend(ops);

            if !data_table_ops.is_empty() {
                transaction.operations.extend(data_table_ops);
            }
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
        let Some(sheet) = self.grid.try_sheet_mut(sheet_id) else {
            return;
        };

        // copy all data in the rows range
        let html = {
            let selection = A1Selection::rows(sheet_id, row_start, row_end);
            let Ok(clipboard) = sheet.copy_to_clipboard(
                &selection,
                &self.a1_context,
                ClipboardOperation::Cut,
                false,
            ) else {
                return;
            };
            clipboard.html
        };

        // delete existing rows
        let min_row = row_start.min(row_end);
        if sheet
            .delete_rows(
                transaction,
                (row_start..=row_end).collect(),
                Default::default(),
                &self.a1_context,
            )
            .is_err()
        {
            // todo: handle move failing b/c of table ui
            return;
        }

        // update information for all cells below the deleted rows
        if let GridBounds::NonEmpty(bounds) = sheet.bounds(true) {
            let mut sheet_rect = bounds.to_sheet_rect(sheet_id);
            sheet_rect.min.y = min_row;
            self.check_deleted_data_tables(transaction, &sheet_rect);
            self.update_spills_in_sheet_rect(transaction, &sheet_rect);
            self.add_compute_operations(transaction, &sheet_rect, None);
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
        if let Some(sheet) = self.grid.try_sheet_mut(sheet_id) {
            for row in adjusted_to..=adjusted_to + row_end - row_start {
                sheet.insert_row(transaction, row, CopyFormats::None, &self.a1_context);
            }
        }

        // paste the copied data into the new rows
        let selection = A1Selection::from_single_cell((1, to, sheet_id).into());
        let insert_at = selection.cursor;

        if let Ok((ops, data_table_ops)) =
            self.paste_html_operations(insert_at, insert_at, &selection, html, PasteSpecial::None)
        {
            transaction.operations.extend(ops);

            if !data_table_ops.is_empty() {
                transaction.operations.extend(data_table_ops);
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

    #[test]
    fn test_move_cols_multiple_columns() {
        let mut gc = GridController::test();

        // Set up test data in columns 3-5
        (&mut gc, 3, 4, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 4, 4, 1, 3, vec!["D", "E", "F"]);
        (&mut gc, 5, 4, 1, 3, vec!["G", "H", "I"]);

        // Move columns 3-5 to position 7
        gc.move_columns(SheetId::TEST, 3, 5, 7, None);

        // Verify data moved correctly
        assert_display_cell_value_first_sheet(&gc, 7, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 8, 3, "D");
        assert_display_cell_value_first_sheet(&gc, 9, 3, "G");
    }

    #[test]
    fn test_move_cols_to_earlier_position() {
        let mut gc = GridController::test();

        // Set up test data in columns 5-6
        (&mut gc, 5, 4, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 6, 4, 1, 3, vec!["D", "E", "F"]);

        // Move columns 5-6 to position 2
        gc.move_columns(SheetId::TEST, 5, 6, 2, None);

        // Verify data moved correctly
        assert_display_cell_value_first_sheet(&gc, 2, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 3, 3, "D");
    }

    #[test]
    fn test_move_rows_multiple_rows() {
        let mut gc = GridController::test();

        // Set up test data in rows 3-5
        (&mut gc, 1, 3, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 1, 4, 1, 3, vec!["D", "E", "F"]);
        (&mut gc, 1, 5, 1, 3, vec!["G", "H", "I"]);

        // Move rows 3-5 to position 7
        gc.move_rows(SheetId::TEST, 3, 5, 7, None);

        // Verify data moved correctly
        assert_display_cell_value_first_sheet(&gc, 1, 7, "A");
        assert_display_cell_value_first_sheet(&gc, 1, 8, "D");
        assert_display_cell_value_first_sheet(&gc, 1, 9, "G");
    }

    #[test]
    fn test_move_rows_to_earlier_position() {
        let mut gc = GridController::test();

        // Set up test data in rows 5-6
        (&mut gc, 1, 5, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 1, 6, 1, 3, vec!["D", "E", "F"]);

        // Move rows 5-6 to position 2
        gc.move_rows(SheetId::TEST, 5, 6, 2, None);

        // Verify data moved correctly
        assert_display_cell_value_first_sheet(&gc, 1, 2, "A");
        assert_display_cell_value_first_sheet(&gc, 1, 3, "D");
    }

    #[test]
    fn test_move_cols_between_source_columns() {
        let mut gc = GridController::test();

        // Set up test data in columns 3-5
        (&mut gc, 3, 4, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 4, 4, 1, 3, vec!["D", "E", "F"]);
        (&mut gc, 5, 4, 1, 3, vec!["G", "H", "I"]);

        // Move columns 3-5 to position 4 (between source columns)
        gc.move_columns(SheetId::TEST, 3, 5, 4, None);

        // Should maintain original order starting at first column
        assert_display_cell_value_first_sheet(&gc, 3, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 4, 3, "D");
        assert_display_cell_value_first_sheet(&gc, 5, 3, "G");
    }

    #[test]
    fn test_move_cols_with_undo() {
        let mut gc = GridController::test();

        // Set up initial data
        (&mut gc, 3, 4, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 4, 4, 1, 3, vec!["D", "E", "F"]);

        // Verify initial state
        assert_display_cell_value_first_sheet(&gc, 3, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 4, 3, "D");

        // Move columns
        gc.move_columns(SheetId::TEST, 3, 4, 6, None);

        // Verify moved state
        assert_display_cell_value_first_sheet(&gc, 6, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 7, 3, "D");

        // Undo the move
        gc.undo(None);

        // Verify state is back to original
        assert_display_cell_value_first_sheet(&gc, 3, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 4, 3, "D");
    }

    #[test]
    fn test_move_rows_with_undo() {
        let mut gc = GridController::test();

        // Set up initial data
        (&mut gc, 1, 3, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 1, 4, 1, 3, vec!["D", "E", "F"]);

        // Verify initial state
        assert_display_cell_value_first_sheet(&gc, 1, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 1, 4, "D");

        // Move rows
        gc.move_rows(SheetId::TEST, 3, 4, 6, None);

        // Verify moved state
        assert_display_cell_value_first_sheet(&gc, 1, 6, "A");
        assert_display_cell_value_first_sheet(&gc, 1, 7, "D");

        // Undo the move
        gc.undo(None);

        // Verify state is back to original
        assert_display_cell_value_first_sheet(&gc, 1, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 1, 4, "D");
    }

    #[test]
    fn test_move_cols_undo_redo() {
        let mut gc = GridController::test();

        // Set up initial data
        (&mut gc, 3, 4, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 4, 4, 1, 3, vec!["D", "E", "F"]);

        // Move columns
        gc.move_columns(SheetId::TEST, 3, 4, 6, None);

        // Verify moved state
        assert_display_cell_value_first_sheet(&gc, 6, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 7, 3, "D");

        // Undo
        gc.undo(None);

        // Verify undone state
        assert_display_cell_value_first_sheet(&gc, 3, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 4, 3, "D");

        // Redo
        gc.redo(None);

        // Verify redone state
        assert_display_cell_value_first_sheet(&gc, 6, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 7, 3, "D");
    }

    #[test]
    fn test_move_rows_undo_redo() {
        let mut gc = GridController::test();

        // Set up initial data
        (&mut gc, 1, 3, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 1, 4, 1, 3, vec!["D", "E", "F"]);

        // Move rows
        gc.move_rows(SheetId::TEST, 3, 4, 6, None);

        // Verify moved state
        assert_display_cell_value_first_sheet(&gc, 1, 6, "A");
        assert_display_cell_value_first_sheet(&gc, 1, 7, "D");

        // Undo
        gc.undo(None);

        // Verify undone state
        assert_display_cell_value_first_sheet(&gc, 1, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 1, 4, "D");

        // Redo
        gc.redo(None);

        // Verify redone state
        assert_display_cell_value_first_sheet(&gc, 1, 6, "A");
        assert_display_cell_value_first_sheet(&gc, 1, 7, "D");
    }

    #[test]
    fn test_multiple_moves_with_undo() {
        let mut gc = GridController::test();

        // Set up initial data
        (&mut gc, 3, 4, 1, 3, vec!["A", "B", "C"]);
        (&mut gc, 4, 4, 1, 3, vec!["D", "E", "F"]);

        // First move
        gc.move_columns(SheetId::TEST, 3, 4, 6, None);

        // Second move
        gc.move_columns(SheetId::TEST, 6, 7, 2, None);

        // Verify final state
        assert_display_cell_value_first_sheet(&gc, 2, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 3, 3, "D");

        // Undo second move
        gc.undo(None);

        // Verify first move state
        assert_display_cell_value_first_sheet(&gc, 6, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 7, 3, "D");

        // Undo first move
        gc.undo(None);

        // Verify original state
        assert_display_cell_value_first_sheet(&gc, 3, 3, "A");
        assert_display_cell_value_first_sheet(&gc, 4, 3, "D");
    }

    #[test]
    fn test_move_with_empty_cells() {
        let mut gc = GridController::test();

        // Set up sparse data
        (&mut gc, 3, 4, 1, 1, vec!["A"]);
        (&mut gc, 3, 4, 3, 3, vec!["B"]);

        // Move columns
        gc.move_columns(SheetId::TEST, 3, 4, 6, None);

        // Verify moved state
        assert_display_cell_value_first_sheet(&gc, 6, 1, "A");
        assert_display_cell_value_first_sheet(&gc, 6, 3, "B");

        // Undo
        gc.undo(None);

        // Verify original state
        assert_display_cell_value_first_sheet(&gc, 3, 1, "A");
        assert_display_cell_value_first_sheet(&gc, 3, 3, "B");
    }
}
