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
    /// Inserts a column at the given column index.
    ///
    /// send_client indicates whether this should trigger client changes
    ///
    /// todo: this can probably be removed since transaction handles all client
    /// communications now.
    ///
    /// Note: the column that insert column receives relates to where the column
    /// is being inserted. So if insert to the left of the column, then the
    /// column is the selected column, and CopyFormats::After. If inserting to
    /// the right of the column, then the column is the selected column + 1, and
    /// CopyFormats::Before.
    pub(crate) fn insert_column(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
        ignore_tables: bool,
        a1_context: &A1Context,
    ) {
        // mark hashes of old columns dirty
        transaction.add_dirty_hashes_from_sheet_columns(self, column, None);

        self.columns.insert_column(column);

        if !ignore_tables {
            self.check_insert_tables_columns(transaction, column, copy_formats);
            self.adjust_insert_tables_columns(transaction, column, copy_formats);
        }

        // update formatting (fn has maths to find column_inserted)
        self.formats.insert_column(column, copy_formats);
        transaction.add_fill_cells_from_columns(self, column);

        // update meta fills if there are any infinite fills (column/row/sheet fills)
        if self.formats.has_meta_fills() {
            transaction.add_sheet_meta_fills(self.id);
        }

        // update borders(fn has maths to find column_inserted)
        self.borders.insert_column(column, copy_formats);
        transaction.sheet_borders.insert(self.id);

        // update merge cells and track affected hashes for re-rendering
        let affected_rects = self.merge_cells.insert_column(column);
        transaction.add_merge_cells_dirty_hashes(self.id, &affected_rects);

        // update validations
        let changed_selections =
            self.validations
                .insert_column(transaction, self.id, column, a1_context);
        transaction.add_dirty_hashes_from_selections(self, a1_context, changed_selections);

        let changes = self.offsets.insert_column(column, copy_formats);
        if !changes.is_empty() {
            changes.iter().for_each(|(index, size)| {
                transaction.offsets_modified(self.id, Some(*index), None, Some(*size));
            });
        }

        // create undo operations for the inserted column
        if transaction.is_user_ai_undo_redo() {
            // reverse operation to delete the column (this will also shift all impacted columns)
            transaction
                .reverse_operations
                .push(Operation::DeleteColumn {
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
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue, Pos,
        grid::sheet::borders::{BorderSide, BorderStyleCell, BorderStyleTimestamp, CellBorderLine},
    };

    use super::*;

    #[test]
    fn insert_column_start() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);
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
            pos![B1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );
        sheet.borders.set_style_cell(
            pos![C1],
            BorderStyleCell {
                top: Some(BorderStyleTimestamp::default()),
                bottom: Some(BorderStyleTimestamp::default()),
                left: Some(BorderStyleTimestamp::default()),
                right: Some(BorderStyleTimestamp::default()),
            },
        );

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(
            &mut transaction,
            1,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        assert_eq!(sheet.display_value(pos![A1]), None);
        assert_eq!(
            sheet.display_value(pos![B1]),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![C1]),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(pos![D1]),
            Some(CellValue::Text("C".to_string()))
        );

        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![A1]), None);
        assert_eq!(
            sheet.borders.get_style_cell(pos![B1]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![C1]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            sheet.borders.get_style_cell(pos![D1]).top.unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(sheet.borders.get_side(BorderSide::Top, pos![E1]), None);
    }

    #[test]
    fn insert_column_middle() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(
            &mut transaction,
            2,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 2, y: 1 }), None);
        assert_eq!(
            sheet.display_value(Pos { x: 3, y: 1 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 4, y: 1 }),
            Some(CellValue::Text("C".to_string()))
        );
    }

    #[test]
    fn insert_column_end() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 2, 1, vec!["A", "B"]);

        let mut transaction = PendingTransaction::default();

        sheet.insert_column(
            &mut transaction,
            3,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        assert_eq!(
            sheet.display_value(Pos { x: 1, y: 1 }),
            Some(CellValue::Text("A".to_string()))
        );
        assert_eq!(
            sheet.display_value(Pos { x: 2, y: 1 }),
            Some(CellValue::Text("B".to_string()))
        );
        assert_eq!(sheet.display_value(Pos { x: 3, y: 1 }), None);
    }

    #[test]
    fn insert_column_offset() {
        let mut sheet = Sheet::test();

        sheet.offsets.set_column_width(1, 100.0);
        sheet.offsets.set_column_width(2, 200.0);
        sheet.offsets.set_column_width(4, 400.0);

        let mut transaction = PendingTransaction::default();
        sheet.insert_column(
            &mut transaction,
            2,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );
        assert_eq!(sheet.offsets.column_width(1), 100.0);
        assert_eq!(sheet.offsets.column_width(2), 200.0);
        assert_eq!(sheet.offsets.column_width(3), 200.0);
        assert_eq!(sheet.offsets.column_width(5), 400.0);
    }

    /// Tests that sheet_meta_fills is marked when inserting a column with column fills (infinite y).
    #[test]
    fn insert_column_meta_fills_column_fill() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);

        // Set a column fill (infinite in y direction) on column B
        sheet
            .formats
            .fill_color
            .set_rect(2, 1, Some(2), None, Some("red".to_string()));

        let mut transaction = PendingTransaction::default();
        sheet.insert_column(
            &mut transaction,
            1,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        // Verify that sheet_meta_fills is marked dirty
        assert!(
            transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should be marked when there are column fills"
        );
    }

    /// Tests that sheet_meta_fills is marked when inserting a column with row fills (infinite x).
    #[test]
    fn insert_column_meta_fills_row_fill() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);

        // Set a row fill (infinite in x direction) on row 1
        sheet
            .formats
            .fill_color
            .set_rect(1, 1, None, Some(1), Some("blue".to_string()));

        let mut transaction = PendingTransaction::default();
        sheet.insert_column(
            &mut transaction,
            1,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        // Verify that sheet_meta_fills is marked dirty
        assert!(
            transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should be marked when there are row fills"
        );
    }

    /// Tests that sheet_meta_fills is NOT marked when inserting a column with only finite fills.
    #[test]
    fn insert_column_no_meta_fills_for_finite_fills() {
        let mut sheet = Sheet::test();
        sheet.test_set_values(1, 1, 3, 1, vec!["A", "B", "C"]);

        // Set a finite fill (not infinite in any direction)
        sheet
            .formats
            .fill_color
            .set(pos![B1], Some("green".to_string()));

        let mut transaction = PendingTransaction::default();
        sheet.insert_column(
            &mut transaction,
            1,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        // Verify that sheet_meta_fills is NOT marked dirty for finite fills
        assert!(
            !transaction.sheet_meta_fills.contains(&sheet.id),
            "sheet_meta_fills should NOT be marked for finite fills only"
        );
    }

    #[test]
    fn insert_column_adjusts_merge_cells() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a merge at C2:E4
        sheet.merge_cells.merge_cells(Rect::test_a1("C2:E4"));

        let mut transaction = PendingTransaction::default();

        // Insert column at D (column 4) - inside the merge
        sheet.insert_column(
            &mut transaction,
            4,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        // Merge should expand: C2:E4 -> C2:F4
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("C2:F4"));

        // Verify transaction has merge_cells_updates marked
        assert!(transaction.merge_cells_updates.contains_key(&sheet.id));
    }

    #[test]
    fn insert_column_shifts_merge_cells() {
        use crate::Rect;

        let mut sheet = Sheet::test();

        // Create a merge at C2:E4
        sheet.merge_cells.merge_cells(Rect::test_a1("C2:E4"));

        let mut transaction = PendingTransaction::default();

        // Insert column at B (column 2) - before the merge
        sheet.insert_column(
            &mut transaction,
            2,
            CopyFormats::None,
            false,
            &A1Context::default(),
        );

        // Merge should shift right: C2:E4 -> D2:F4
        let rects: Vec<Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("D2:F4"));
    }
}
