use crate::{
    CopyFormats,
    a1::A1Context,
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

use super::MAX_OPERATION_SIZE_COL_ROW;

impl Sheet {
    // create reverse operations for values in the column broken up by MAX_OPERATION_SIZE
    fn reverse_values_ops_for_column(&self, column: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        if let Some((min, max)) = self.column_bounds(column, true) {
            let mut current_min = min;
            while current_min <= max {
                let current_max = (current_min + MAX_OPERATION_SIZE_COL_ROW).min(max);
                let mut values = CellValues::new(1, (current_max - current_min) as u32 + 1);

                if let Some(col) = self.get_column(column) {
                    for y in current_min..=current_max {
                        if let Some(cell_value) = col.values.get(&y) {
                            values.set(0, (y - current_min) as u32, cell_value.clone());
                        }
                    }
                }
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: crate::SheetPos::new(self.id, column, min),
                    values,
                });
                current_min = current_max + 1;
            }
        }

        reverse_operations
    }

    /// Creates reverse operations for cell formatting within the column.
    fn reverse_formats_ops_for_column(&self, column: i64) -> Vec<Operation> {
        if let Some(formats) = self.formats.copy_column(column) {
            vec![Operation::SetCellFormatsA1 {
                sheet_id: self.id,
                formats,
            }]
        } else {
            vec![]
        }
    }

    /// Creates reverse operations for borders within the column.
    fn reverse_borders_ops_for_column(&self, column: i64) -> Vec<Operation> {
        if let Some(borders) = self.borders.copy_column(column) {
            if borders.is_empty() {
                return vec![];
            }
            vec![Operation::SetBordersA1 {
                sheet_id: self.id,
                borders,
            }]
        } else {
            vec![]
        }
    }

    fn delete_column_offset(&mut self, transaction: &mut PendingTransaction, column: i64) {
        let (changed, new_size) = self.offsets.delete_column(column);
        if let Some(new_size) = new_size {
            transaction
                .reverse_operations
                .push(Operation::ResizeColumn {
                    sheet_id: self.id,
                    column,
                    new_size,
                    client_resized: false,
                });
        }
        if !changed.is_empty() && !transaction.is_server() {
            changed.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, Some(*index), None, Some(*size));
            });
        }
    }

    /// Deletes columns and returns the operations to undo the deletion.
    fn delete_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) {
        // create undo operations for the deleted column (only when needed since
        // it's a bit expensive)
        if transaction.is_user_ai_undo_redo() {
            transaction
                .reverse_operations
                .extend(self.reverse_borders_ops_for_column(column));
            transaction
                .reverse_operations
                .extend(self.reverse_formats_ops_for_column(column));
            transaction
                .reverse_operations
                .extend(self.reverse_values_ops_for_column(column));
        }

        // mark hashes of existing columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);

        self.delete_column_offset(transaction, column);

        // remove the column's formats from the sheet
        self.formats.remove_column(column);

        // mark fills dirty AFTER removing the column so the shifted columns are correctly marked
        // todo: this can be optimized by adding a fn that checks if there are
        // any fills beyond the deleted column
        if self.formats.has_fills() {
            transaction.add_fill_cells_from_columns(self, column);
        }

        // update meta fills if there are any infinite fills (column/row/sheet fills)
        if self.formats.has_meta_fills() {
            transaction.add_sheet_meta_fills(self.id);
        }

        // remove the column's borders from the sheet
        self.borders.remove_column(column);
        transaction.sheet_borders.insert(self.id);

        // update merge cells and track affected hashes for re-rendering
        let affected_rects = self.merge_cells.remove_column(column);
        transaction.add_merge_cells_dirty_hashes(self.id, &affected_rects);

        self.columns.remove_column(column);

        let changed_selections =
            self.validations
                .remove_column(transaction, self.id, column, a1_context);

        transaction.add_dirty_hashes_from_selections(self, a1_context, changed_selections);

        if transaction.is_user_ai_undo_redo() {
            // reverse operation to create the column (this will also shift all impacted columns)
            transaction
                .reverse_operations
                .push(Operation::InsertColumn {
                    sheet_id: self.id,
                    column,
                    copy_formats,
                    ignore_tables: true,
                });
        }

        self.recalculate_bounds(a1_context);

        // mark hashes of new columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);
    }

    /// Deletes columns. Columns is a vec of all columns to be deleted. This fn
    /// will dedup and sort the columns.
    pub(crate) fn delete_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        columns: Vec<i64>,
        ignore_tables: bool,
        copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) {
        if columns.is_empty() {
            return;
        }

        let mut columns = columns.clone();
        columns.sort_unstable();
        columns.dedup();
        columns.reverse();

        for column in &columns {
            self.delete_column(transaction, *column, copy_formats, a1_context);
        }

        if !ignore_tables {
            self.delete_tables_with_all_columns(transaction, &columns);
            self.delete_tables_columns(transaction, &columns);
            self.delete_chart_columns(transaction, &columns);
            self.move_tables_leftwards(transaction, &columns);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        DEFAULT_COLUMN_WIDTH, Pos,
        a1::A1Selection,
        assert_cell_format_fill_color, assert_display_cell_value,
        controller::GridController,
        grid::{CellWrap, CodeCellLanguage},
        renderer_constants::CELL_SHEET_WIDTH,
        test_util::{first_sheet_id, test_set_values},
    };

    use super::*;

    #[test]
    fn test_delete_column() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_set_values(&mut gc, sheet_id, pos![A1], 4, 4);

        gc.set_fill_color(
            &A1Selection::test_a1("A1"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();
        gc.set_cell_wrap(&A1Selection::test_a1("A1"), CellWrap::Clip, None, false)
            .unwrap();
        gc.set_fill_color(
            &A1Selection::test_a1("D4"),
            Some("blue".to_string()),
            None,
            false,
        )
        .unwrap();

        gc.set_code_cell(
            pos![sheet_id!B5],
            CodeCellLanguage::Formula,
            "{A1, B1}".to_string(),
            None,
            None,
            false,
        );
        gc.set_code_cell(
            pos![sheet_id!D5],
            CodeCellLanguage::Formula,
            "{A1, B1}".to_string(),
            None,
            None,
            false,
        );

        gc.set_bold(&A1Selection::test_a1("A1:A"), Some(true), None, false)
            .unwrap();
        gc.set_italic(&A1Selection::test_a1("D1:D"), Some(true), None, false)
            .unwrap();

        gc.delete_columns(sheet_id, vec![1], None, false);

        assert_display_cell_value(&gc, sheet_id, 1, 1, "1");
        assert_cell_format_fill_color(&gc, sheet_id, 3, 4, "blue");
        assert_display_cell_value(&gc, sheet_id, 3, 4, "15");
        assert_display_cell_value(&gc, sheet_id, 2, 5, "1");
    }

    #[test]
    fn values_ops_for_column() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 2, vec!["a", "b", "c", "d"]);
        let ops = sheet.reverse_values_ops_for_column(2);
        assert_eq!(ops.len(), 1);
    }

    #[test]
    fn delete_column_offset() {
        let mut sheet = Sheet::test();

        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        let mut transaction = PendingTransaction::default();
        let a1_context = sheet.expensive_make_a1_context();
        sheet.delete_column(&mut transaction, 2, CopyFormats::None, &a1_context);
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), DEFAULT_COLUMN_WIDTH);
        assert_eq!(sheet.offsets.column_width(3), 400.0);
    }

    /// Tests that fill_cells are marked dirty AFTER the column is deleted.
    /// This ensures that the correct hashes (for the shifted columns) are marked dirty.
    #[test]
    fn test_delete_column_fills_marked_dirty() {
        let mut sheet = Sheet::test();

        // Set up values in columns 1-4 to create bounds
        sheet.test_set_values(1, 1, 4, 1, vec!["A", "B", "C", "D"]);

        // Set fills on columns 2 and 4
        sheet
            .formats
            .fill_color
            .set(pos![B1], Some("red".to_string()));
        sheet
            .formats
            .fill_color
            .set(pos![D1], Some("blue".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        // Delete column 1 - this should shift columns 2-4 left to become 1-3
        sheet.delete_column(&mut transaction, 1, CopyFormats::None, &a1_context);

        // Verify that fill_cells contains the correct hashes AFTER deletion
        // The fills that were at columns 2 and 4 (now at 1 and 3) should have their
        // hashes marked dirty based on the new column positions
        let fill_cells = transaction.fill_cells.get(&sheet.id);
        assert!(fill_cells.is_some(), "fill_cells should be marked dirty");

        let fill_cells = fill_cells.unwrap();
        // Hash (0, 0) should be marked dirty since column 1 (hash 0) has fills
        assert!(
            fill_cells.contains(&Pos { x: 0, y: 0 }),
            "hash (0, 0) should be marked dirty for shifted fills"
        );

        // Verify the fills themselves shifted correctly
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string()),
            "fill should have shifted from B1 to A1"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![C1]),
            Some("blue".to_string()),
            "fill should have shifted from D1 to C1"
        );
    }

    /// Tests that deleting a column with fills spanning multiple hashes marks all relevant hashes dirty.
    #[test]
    fn test_delete_column_fills_multiple_hashes() {
        let mut sheet = Sheet::test();

        // Set values to create bounds spanning multiple hashes
        // CELL_SHEET_WIDTH = 15, so column 16+ is in hash x=1
        sheet.set_value(pos![A1], "A".to_string());
        sheet.set_value(Pos { x: 20, y: 1 }, "B".to_string()); // In hash x=1

        // Set a fill in a column that will be in the second hash after deletion
        sheet
            .formats
            .fill_color
            .set(Pos { x: 20, y: 1 }, Some("green".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        // Delete column 1
        sheet.delete_column(&mut transaction, 1, CopyFormats::None, &a1_context);

        // The fill at column 20 shifted to column 19, which is in hash x=1 (19/15 = 1)
        let fill_cells = transaction.fill_cells.get(&sheet.id);
        assert!(fill_cells.is_some(), "fill_cells should be marked dirty");

        let fill_cells = fill_cells.unwrap();
        // Hash containing column 19 (hash x=1) should be marked dirty
        let expected_hash_x = (CELL_SHEET_WIDTH as i64 - 1) / CELL_SHEET_WIDTH as i64; // Column 19 maps to hash 1
        assert!(
            fill_cells.contains(&Pos {
                x: expected_hash_x,
                y: 0
            }),
            "hash for shifted fill should be marked dirty"
        );
    }

    /// Tests that sheet_meta_fills is marked when deleting a column with column fills (infinite y).
    #[test]
    fn test_delete_column_meta_fills_column_fill() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 4, 1, vec!["A", "B", "C", "D"]);

        // Set a column fill (infinite in y direction) on column C
        sheet
            .formats
            .fill_color
            .set_rect(3, 1, Some(3), None, Some("red".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        sheet.delete_column(&mut transaction, 1, CopyFormats::None, &a1_context);

        // Verify that sheet_meta_fills is marked dirty
        assert!(
            transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should be marked when there are column fills"
        );
    }

    /// Tests that sheet_meta_fills is marked when deleting a column with row fills (infinite x).
    #[test]
    fn test_delete_column_meta_fills_row_fill() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 4, 1, vec!["A", "B", "C", "D"]);

        // Set a row fill (infinite in x direction) on row 1
        sheet
            .formats
            .fill_color
            .set_rect(1, 1, None, Some(1), Some("blue".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        sheet.delete_column(&mut transaction, 1, CopyFormats::None, &a1_context);

        // Verify that sheet_meta_fills is marked dirty
        assert!(
            transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should be marked when there are row fills"
        );
    }

    /// Tests that sheet_meta_fills is NOT marked when deleting a column with only finite fills.
    #[test]
    fn test_delete_column_no_meta_fills_for_finite_fills() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 4, 1, vec!["A", "B", "C", "D"]);

        // Set a finite fill (not infinite in any direction)
        sheet
            .formats
            .fill_color
            .set(pos![C1], Some("green".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        sheet.delete_column(&mut transaction, 1, CopyFormats::None, &a1_context);

        // Verify that sheet_meta_fills is NOT marked dirty for finite fills
        assert!(
            !transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should NOT be marked for finite fills only"
        );
    }

    #[test]
    fn test_delete_column_shrinks_merge_cells() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a merge at C2:E4
        sheet.merge_cells.merge_cells(Rect::test_a1("C2:E4"));

        let a1_context = sheet.expensive_make_a1_context();

        let mut transaction = PendingTransaction::default();

        // Delete column D (column 4) - inside the merge
        sheet.delete_column(&mut transaction, 4, CopyFormats::None, &a1_context);

        // Merge should shrink: C2:E4 -> C2:D4
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("C2:D4"));

        // Verify transaction has merge_cells_updates marked
        assert!(transaction.merge_cells_updates.contains_key(&sheet.id));
    }

    #[test]
    fn test_delete_column_shifts_merge_cells() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a merge at C2:E4
        sheet.merge_cells.merge_cells(Rect::test_a1("C2:E4"));

        let a1_context = sheet.expensive_make_a1_context();

        let mut transaction = PendingTransaction::default();

        // Delete column A (column 1) - before the merge
        sheet.delete_column(&mut transaction, 1, CopyFormats::None, &a1_context);

        // Merge should shift left: C2:E4 -> B2:D4
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B2:D4"));
    }

    #[test]
    fn test_delete_column_removes_single_column_merge() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a single column merge at C2:C4
        sheet.merge_cells.merge_cells(Rect::test_a1("C2:C4"));

        let a1_context = sheet.expensive_make_a1_context();

        let mut transaction = PendingTransaction::default();

        // Delete column C (column 3) - the entire merge
        sheet.delete_column(&mut transaction, 3, CopyFormats::None, &a1_context);

        // Merge should be deleted
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 0);
    }
}
