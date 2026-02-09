use crate::{
    CopyFormats,
    a1::A1Context,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

impl Sheet {
    pub(crate) fn insert_row(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
        ignore_tables: bool,
        copy_formats: CopyFormats,
        a1_context: &A1Context,
    ) {
        // mark hashes of old rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);

        self.columns.insert_row(row);

        if !ignore_tables {
            self.check_insert_tables_rows(transaction, row, copy_formats);
            self.adjust_insert_tables_rows(transaction, row);
        }

        // update formatting
        self.formats.insert_row(row, copy_formats);
        transaction.add_fill_cells_from_rows(self, row);

        // update meta fills if there are any infinite fills (column/row/sheet fills)
        if self.formats.has_meta_fills() {
            transaction.add_sheet_meta_fills(self.id);
        }

        // signal client to update the borders for changed columns
        self.borders.insert_row(row, copy_formats);
        transaction.sheet_borders.insert(self.id);

        // update merge cells and track affected hashes for re-rendering
        let affected_rects = self.merge_cells.insert_row(row);
        transaction.add_merge_cells_dirty_hashes(self.id, &affected_rects);

        // update validations
        let changed_selections = self
            .validations
            .insert_row(transaction, self.id, row, a1_context);
        transaction.add_dirty_hashes_from_selections(self, a1_context, changed_selections);

        let changes = self.offsets.insert_row(row, copy_formats);
        changes.iter().for_each(|(index, size)| {
            transaction.offsets_modified(self.id, None, Some(*index), Some(*size));
        });

        // create undo operations for the inserted row
        if transaction.is_user_ai_undo_redo() {
            // reverse operation to delete the row (this will also shift all impacted rows)
            transaction.reverse_operations.push(Operation::DeleteRow {
                sheet_id: self.id,
                row,
                ignore_tables: true,
                copy_formats,
            });
        }

        self.recalculate_bounds(a1_context);

        // mark hashes of new rows dirty
        transaction.add_dirty_hashes_from_sheet_rows(self, row, None);
    }
}

#[cfg(test)]
mod test {
    use crate::{
        CellValue, Pos,
        a1::A1Context,
        grid::sheet::borders::{BorderSide, BorderStyleCell, BorderStyleTimestamp, CellBorderLine},
    };

    use super::*;

    #[test]
    fn insert_row_start() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);
        sheet.borders.set_style_cell(
            pos![A1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.borders.set_style_cell(
            pos![A2],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.borders.set_style_cell(
            pos![A3],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.test_set_code_run_array(4, 1, vec!["A", "B"], false);

        sheet.recalculate_bounds(&A1Context::default());

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(
            &mut transaction,
            1,
            false,
            CopyFormats::None,
            &A1Context::default(),
        );

        assert_eq!(sheet.display_value(pos![A1]), None);
        assert_eq!(
            sheet.display_value(pos![A2]),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![A3]),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![A4]),
            Some(CellValue::Text("C".to_string()))
        );

        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![A1]), None);
        assert_eq!(
            sheet
                .borders
                .get_side(BorderSide::Top, pos![A2])
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![A3]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![A4]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![E1]), None);

        assert!(sheet.data_tables.get_at(&pos![D1]).is_none());
        assert!(sheet.data_tables.get_at(&pos![D2]).is_some());

        assert_eq!(
            sheet.display_value(pos![D2]),
            Some(CellValue::Text("A".to_string()))
        );
    }

    #[test]
    fn insert_row_middle() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_row(
            &mut transaction,
            2,
            false,
            CopyFormats::None,
            &A1Context::default(),
        );

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 2 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 3 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 4 }),
            Some(CellValue::Text("C".to_string()))
        );
    }

    #[test]
    fn insert_row_end() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 2, vec!["A", "B"]);

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        sheet.insert_row(&mut transaction, 3, false, CopyFormats::None, &context);

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 2 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 1, y: 3 }), None);
    }

    #[test]
    fn insert_row_offset() {
        let mut sheet = Sheet::test();
        sheet.offsets.set_row_height(1, 100.0);
        sheet.offsets.set_row_height(2, 200.0);
        sheet.offsets.set_row_height(4, 400.0);

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        sheet.insert_row(&mut transaction, 2, false, CopyFormats::None, &context);
        assert_eq!(sheet.offsets.row_height(1), 100.0);
        assert_eq!(sheet.offsets.row_height(2), 200.0);
        assert_eq!(sheet.offsets.row_height(3), 200.0);
        assert_eq!(sheet.offsets.row_height(5), 400.0);
    }

    /// Tests that sheet_meta_fills is marked when inserting a row with row fills (infinite x).
    #[test]
    fn insert_row_meta_fills_row_fill() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);

        // Set a row fill (infinite in x direction) on row 2
        sheet
            .formats
            .fill_color
            .set_rect(1, 2, None, Some(2), Some("red".to_string()));

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        sheet.insert_row(&mut transaction, 1, false, CopyFormats::None, &context);

        // Verify that sheet_meta_fills is marked dirty
        assert!(
            transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should be marked when there are row fills"
        );
    }

    /// Tests that sheet_meta_fills is marked when inserting a row with column fills (infinite y).
    #[test]
    fn insert_row_meta_fills_column_fill() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);

        // Set a column fill (infinite in y direction) on column A
        sheet
            .formats
            .fill_color
            .set_rect(1, 1, Some(1), None, Some("blue".to_string()));

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        sheet.insert_row(&mut transaction, 1, false, CopyFormats::None, &context);

        // Verify that sheet_meta_fills is marked dirty
        assert!(
            transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should be marked when there are column fills"
        );
    }

    /// Tests that sheet_meta_fills is NOT marked when inserting a row with only finite fills.
    #[test]
    fn insert_row_no_meta_fills_for_finite_fills() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 1, 3, vec!["A", "B", "C"]);

        // Set a finite fill (not infinite in any direction)
        sheet
            .formats
            .fill_color
            .set(pos![A2], Some("green".to_string()));

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        sheet.insert_row(&mut transaction, 1, false, CopyFormats::None, &context);

        // Verify that sheet_meta_fills is NOT marked dirty for finite fills
        assert!(
            !transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should NOT be marked for finite fills only"
        );
    }

    #[test]
    fn insert_row_adjusts_merge_cells() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a merge at B3:D5
        sheet.merge_cells.merge_cells(Rect::test_a1("B3:D5"));

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        // Insert row at 4 - inside the merge
        sheet.insert_row(&mut transaction, 4, false, CopyFormats::None, &context);

        // Merge should expand: B3:D5 -> B3:D6
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B3:D6"));

        // Verify transaction has merge_cells_updates marked
        assert!(transaction.merge_cells_updates.contains_key(&sheet.id));
    }

    #[test]
    fn insert_row_shifts_merge_cells() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a merge at B3:D5
        sheet.merge_cells.merge_cells(Rect::test_a1("B3:D5"));

        let mut transaction = PendingTransaction::default();
        let context = A1Context::default();

        // Insert row at 2 - before the merge
        sheet.insert_row(&mut transaction, 2, false, CopyFormats::None, &context);

        // Merge should shift down: B3:D5 -> B4:D6
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B4:D6"));
    }
}
