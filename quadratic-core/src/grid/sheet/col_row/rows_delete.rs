use crate::{
    CopyFormats, Pos, SheetPos,
    a1::A1Context,
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

use anyhow::{Result, bail};

use super::MAX_OPERATION_SIZE_COL_ROW;

impl Sheet {
    // create reverse operations for values in the row broken up by MAX_OPERATION_SIZE
    fn reverse_values_ops_for_row(&self, row: i64) -> Vec<Operation> {
        let mut reverse_operations = Vec::new();

        if let Some((min, max)) = self.row_bounds(row, true) {
            let mut current_min = min;
            while current_min <= max {
                let current_max = (current_min + MAX_OPERATION_SIZE_COL_ROW).min(max);
                let mut values = CellValues::new((current_max - current_min) as u32 + 1, 1);
                for x in current_min..=current_max {
                    if let Some(cell) = self.cell_value(Pos { x, y: row }) {
                        values.set((x - current_min) as u32, 0, cell);
                    }
                }
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: SheetPos::new(self.id, min, row),
                    values,
                });
                current_min = current_max + 1;
            }
        }

        reverse_operations
    }

    /// Creates reverse operations for cell formatting within the row.
    fn reverse_formats_ops_for_row(&self, row: i64) -> Vec<Operation> {
        if let Some(formats) = self.formats.copy_row(row) {
            vec![Operation::SetCellFormatsA1 {
                sheet_id: self.id,
                formats,
            }]
        } else {
            vec![]
        }
    }

    /// Creates reverse operations for borders within the row.
    fn reverse_borders_ops_for_row(&self, row: i64) -> Vec<Operation> {
        if let Some(borders) = self.borders.copy_row(row) {
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

    fn delete_row_offset(&mut self, transaction: &mut PendingTransaction, row: i64) {
        let (changed, new_size) = self.offsets.delete_row(row);

        if let Some(new_size) = new_size {
            transaction.reverse_operations.push(Operation::ResizeRow {
                sheet_id: self.id,
                row,
                new_size,
                client_resized: false,
            });
        }
        if !changed.is_empty() && !transaction.is_server() {
            changed.iter().for_each(|(index, size)| {
                transaction
                    .offsets_modified
                    .entry(self.id)
                    .or_default()
                    .insert((None, Some(*index)), *size);
            });
        }
    }

    fn delete_row(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
        a1_context: &A1Context,
    ) {
        // create undo operations for the deleted row (only when needed since
        // it's a bit expensive)
        if transaction.is_user_ai_undo_redo() {
            transaction
                .reverse_operations
                .extend(self.reverse_borders_ops_for_row(row));
            transaction
                .reverse_operations
                .extend(self.reverse_formats_ops_for_row(row));
            transaction
                .reverse_operations
                .extend(self.reverse_values_ops_for_row(row));
        }

        // mark hashes of existing rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);

        self.delete_row_offset(transaction, row);

        // remove the row's formats from the sheet
        self.formats.remove_row(row);

        // mark fills dirty AFTER removing the row so the shifted rows are correctly marked
        // todo: this can be optimized by adding a fn that checks if there are
        // any fills beyond the deleted row
        if self.formats.has_fills() {
            transaction.add_fill_cells_from_rows(self, row);
        }

        // update meta fills if there are any infinite fills (column/row/sheet fills)
        if self.formats.has_meta_fills() {
            transaction.add_sheet_meta_fills(self.id);
        }

        // remove the row's borders from the sheet
        self.borders.remove_row(row);
        transaction.sheet_borders.insert(self.id);

        // update merge cells and track affected hashes for re-rendering
        let affected_rects = self.merge_cells.remove_row(row);
        transaction.add_merge_cells_dirty_hashes(self.id, &affected_rects);

        // update all cells that were impacted by the deletion
        self.columns.remove_row(row);

        let changed_selections = self
            .validations
            .remove_row(transaction, self.id, row, a1_context);

        transaction.add_dirty_hashes_from_selections(self, a1_context, changed_selections);

        if transaction.is_user_ai_undo_redo() {
            // reverse operation to create the row (this will also shift all impacted rows)
            transaction.reverse_operations.push(Operation::InsertRow {
                sheet_id: self.id,
                row,
                copy_formats: CopyFormats::None,
                ignore_tables: true,
            });
        }

        self.recalculate_bounds(a1_context);

        // mark hashes of new rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);
    }

    /// Deletes rows. Returns false if the rows contain table UI and the
    /// operation was aborted.
    #[allow(clippy::result_unit_err)]
    pub fn delete_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        rows: Vec<i64>,
        ignore_tables: bool,
        _copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let mut rows = rows.clone();
        rows.sort_unstable();
        rows.dedup();
        rows.reverse();

        if self.ensure_no_table_ui(&rows) {
            let e = "delete_rows_error".to_string();
            if transaction.is_user_ai_undo_redo() && cfg!(target_family = "wasm") {
                let severity = crate::grid::js_types::JsSnackbarSeverity::Warning;
                crate::wasm_bindings::js::jsClientMessage(e.to_owned(), severity.to_string());
            }
            bail!(e);
        }

        for row in rows.iter() {
            self.delete_row(transaction, *row, a1_context);
        }

        if !ignore_tables {
            self.delete_tables_with_all_rows(transaction, &rows);
            self.delete_table_rows(transaction, &rows);
            self.delete_chart_rows(transaction, &rows);
            self.move_tables_upwards(transaction, &rows);
        }

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, DEFAULT_ROW_HEIGHT, grid::CellWrap, renderer_constants::CELL_SHEET_HEIGHT,
    };

    use super::*;

    #[test]
    fn test_delete_row_values() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            1,
            1,
            4,
            4,
            vec![
                "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
            ],
        );
        sheet.recalculate_bounds(&sheet.expensive_make_a1_context());
        sheet.columns.remove_row(1);
        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("E".to_string()))
        );
    }

    #[test]
    fn test_delete_row_with_formatting() {
        // will delete row 1
        let mut sheet = Sheet::test();
        sheet.test_set_values(
            1,
            1,
            4,
            4,
            vec![
                "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
            ],
        );
        sheet
            .formats
            .fill_color
            .set(pos![A2], Some("red".to_string()));
        sheet.formats.wrap.set(pos![B2], Some(CellWrap::Clip));
        sheet
            .formats
            .fill_color
            .set(pos![C2], Some("blue".to_string()));
        sheet.test_set_code_run_array(1, 3, vec!["=A1", "=A2"], false);
        sheet.test_set_code_run_array(1, 4, vec!["=A1", "=A2"], false);

        sheet.formats.bold.set_rect(1, 1, Some(1), None, Some(true));
        sheet
            .formats
            .italic
            .set_rect(1, 1, Some(1), None, Some(true));

        sheet
            .formats
            .bold
            .set_rect(2, 1, Some(2), None, Some(false));
        sheet
            .formats
            .italic
            .set_rect(2, 1, Some(2), None, Some(false));

        let a1_context = sheet.expensive_make_a1_context();

        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();

        let _ = sheet.delete_rows(
            &mut transaction,
            Vec::from(&[1]),
            false,
            CopyFormats::None,
            &a1_context,
        );
        assert_eq!(transaction.reverse_operations.len(), 5);

        assert_eq!(
            sheet.cell_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("E".to_string()))
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![C1]),
            Some("blue".to_string())
        );
        assert!(sheet.data_tables.get_at(&Pos { x: 1, y: 2 }).is_some());
        assert!(sheet.data_tables.get_at(&Pos { x: 1, y: 3 }).is_some());
    }

    #[test]
    fn test_values_ops_for_column() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 2, vec!["a", "b", "c", "d"]);
        let ops = sheet.reverse_values_ops_for_row(2);
        assert_eq!(ops.len(), 1);
    }

    #[test]
    fn delete_row_offset() {
        let mut sheet = Sheet::test();
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        let a1_context = sheet.expensive_make_a1_context();

        let mut transaction = PendingTransaction::default();
        sheet.delete_row(&mut transaction, 2, &a1_context);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), DEFAULT_ROW_HEIGHT);
        assert_eq!(sheet.offsets.row_height(3), 400.0);
    }

    /// Tests that fill_cells are marked dirty AFTER the row is deleted.
    /// This ensures that the correct hashes (for the shifted rows) are marked dirty.
    #[test]
    fn test_delete_row_fills_marked_dirty() {
        let mut sheet = Sheet::test();

        // Set up values in rows 1-4 to create bounds
        sheet.test_set_values(1, 1, 1, 4, vec!["A", "B", "C", "D"]);

        // Set fills on rows 2 and 4
        sheet
            .formats
            .fill_color
            .set(pos![A2], Some("red".to_string()));
        sheet
            .formats
            .fill_color
            .set(pos![A4], Some("blue".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        // Delete row 1 - this should shift rows 2-4 up to become 1-3
        sheet.delete_row(&mut transaction, 1, &a1_context);

        // Verify that fill_cells contains the correct hashes AFTER deletion
        // The fills that were at rows 2 and 4 (now at 1 and 3) should have their
        // hashes marked dirty based on the new row positions
        let fill_cells = transaction.fill_cells.get(&sheet.id);
        assert!(fill_cells.is_some(), "fill_cells should be marked dirty");

        let fill_cells = fill_cells.unwrap();
        // Hash (0, 0) should be marked dirty since row 1 (hash 0) has fills
        assert!(
            fill_cells.contains(&Pos { x: 0, y: 0 }),
            "hash (0, 0) should be marked dirty for shifted fills"
        );

        // Verify the fills themselves shifted correctly
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string()),
            "fill should have shifted from A2 to A1"
        );
        assert_eq!(
            sheet.formats.fill_color.get(pos![A3]),
            Some("blue".to_string()),
            "fill should have shifted from A4 to A3"
        );
    }

    /// Tests that deleting a row with fills spanning multiple hashes marks all relevant hashes dirty.
    #[test]
    fn test_delete_row_fills_multiple_hashes() {
        let mut sheet = Sheet::test();

        // Set values to create bounds spanning multiple hashes
        // CELL_SHEET_HEIGHT = 30, so row 31+ is in hash y=1
        sheet.set_value(pos![A1], "A".to_string());
        sheet.set_value(Pos { x: 1, y: 40 }, "B".to_string()); // In hash y=1

        // Set a fill in a row that will be in the second hash after deletion
        sheet
            .formats
            .fill_color
            .set(Pos { x: 1, y: 40 }, Some("green".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        // Delete row 1
        sheet.delete_row(&mut transaction, 1, &a1_context);

        // The fill at row 40 shifted to row 39, which is in hash y=1 (39/30 = 1)
        let fill_cells = transaction.fill_cells.get(&sheet.id);
        assert!(fill_cells.is_some(), "fill_cells should be marked dirty");

        let fill_cells = fill_cells.unwrap();
        // Hash containing row 39 (hash y=1) should be marked dirty
        let expected_hash_y = (CELL_SHEET_HEIGHT as i64 - 1) / CELL_SHEET_HEIGHT as i64; // Row 39 maps to hash 1
        assert!(
            fill_cells.contains(&Pos {
                x: 0,
                y: expected_hash_y
            }),
            "hash for shifted fill should be marked dirty"
        );
    }

    /// Tests that sheet_meta_fills is marked when deleting a row with row fills (infinite x).
    #[test]
    fn test_delete_row_meta_fills_row_fill() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 4, vec!["A", "B", "C", "D"]);

        // Set a row fill (infinite in x direction) on row 3
        sheet
            .formats
            .fill_color
            .set_rect(1, 3, None, Some(3), Some("red".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        sheet.delete_row(&mut transaction, 1, &a1_context);

        // Verify that sheet_meta_fills is marked dirty
        assert!(
            transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should be marked when there are row fills"
        );
    }

    /// Tests that sheet_meta_fills is marked when deleting a row with column fills (infinite y).
    #[test]
    fn test_delete_row_meta_fills_column_fill() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 4, vec!["A", "B", "C", "D"]);

        // Set a column fill (infinite in y direction) on column A
        sheet
            .formats
            .fill_color
            .set_rect(1, 1, Some(1), None, Some("blue".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        sheet.delete_row(&mut transaction, 1, &a1_context);

        // Verify that sheet_meta_fills is marked dirty
        assert!(
            transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should be marked when there are column fills"
        );
    }

    /// Tests that sheet_meta_fills is NOT marked when deleting a row with only finite fills.
    #[test]
    fn test_delete_row_no_meta_fills_for_finite_fills() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 4, vec!["A", "B", "C", "D"]);

        // Set a finite fill (not infinite in any direction)
        sheet
            .formats
            .fill_color
            .set(pos![A3], Some("green".to_string()));

        let a1_context = sheet.expensive_make_a1_context();
        sheet.recalculate_bounds(&a1_context);

        let mut transaction = PendingTransaction::default();
        sheet.delete_row(&mut transaction, 1, &a1_context);

        // Verify that sheet_meta_fills is NOT marked dirty for finite fills
        assert!(
            !transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should NOT be marked for finite fills only"
        );
    }

    #[test]
    fn test_delete_row_shrinks_merge_cells() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a merge at B3:D5
        sheet.merge_cells.merge_cells(Rect::test_a1("B3:D5"));

        let a1_context = sheet.expensive_make_a1_context();

        let mut transaction = PendingTransaction::default();

        // Delete row 4 - inside the merge
        sheet.delete_row(&mut transaction, 4, &a1_context);

        // Merge should shrink: B3:D5 -> B3:D4
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B3:D4"));

        // Verify transaction has merge_cells_updates marked
        assert!(transaction.merge_cells_updates.contains_key(&sheet.id));
    }

    #[test]
    fn test_delete_row_shifts_merge_cells() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a merge at B3:D5
        sheet.merge_cells.merge_cells(Rect::test_a1("B3:D5"));

        let a1_context = sheet.expensive_make_a1_context();

        let mut transaction = PendingTransaction::default();

        // Delete row 1 - before the merge
        sheet.delete_row(&mut transaction, 1, &a1_context);

        // Merge should shift up: B3:D5 -> B2:D4
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B2:D4"));
    }

    #[test]
    fn test_delete_row_removes_single_row_merge() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a single row merge at B3:D3
        sheet.merge_cells.merge_cells(Rect::test_a1("B3:D3"));

        let a1_context = sheet.expensive_make_a1_context();

        let mut transaction = PendingTransaction::default();

        // Delete row 3 - the entire merge
        sheet.delete_row(&mut transaction, 3, &a1_context);

        // Merge should be deleted
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 0);
    }
}
