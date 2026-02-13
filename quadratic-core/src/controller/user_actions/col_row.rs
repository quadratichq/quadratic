use crate::{
    CopyFormats,
    a1::A1Selection,
    controller::{
        GridController, active_transactions::transaction_name::TransactionName,
        operations::operation::Operation,
    },
    grid::SheetId,
};

impl GridController {
    pub fn delete_columns(
        &mut self,
        sheet_id: SheetId,
        columns: Vec<i64>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = vec![Operation::DeleteColumns {
            sheet_id,
            columns,
            ignore_tables: false,
            copy_formats: CopyFormats::After,
        }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ManipulateColumnRow, is_ai);
    }

    /// Inserts `count` columns at the given column index.
    ///
    /// The `after` parameter is confusingly named — it controls where formats
    /// are copied FROM, not the direction of insertion:
    ///
    /// - `after=true` → "insert column LEFT": `column` is the selected
    ///   column (or merge min.x). The selected column shifts right and the
    ///   new column copies its formatting (CopyFormats::After).
    /// - `after=false` → "insert column RIGHT": `column` is the selected
    ///   column + 1 (or merge max.x + 1). The new column copies formatting
    ///   from the column before it (CopyFormats::Before).
    ///
    /// The caller (TS client) is responsible for adjusting the column to
    /// the merge boundary when the cursor is on a merged cell. If the
    /// column falls inside a merge cell that is NOT the selection, the
    /// merge will expand to accommodate the new column.
    pub fn insert_columns(
        &mut self,
        sheet_id: SheetId,
        column: i64,
        count: u32,
        after: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let mut ops = vec![];
        for i in 0..count as i64 {
            ops.push(Operation::InsertColumn {
                sheet_id,
                column: column + i,
                copy_formats: if after {
                    CopyFormats::After
                } else {
                    CopyFormats::Before
                },
                ignore_tables: false,
            });
        }
        if !after && count > 1 {
            ops.push(Operation::SetCursorA1 {
                selection: A1Selection::cols(sheet_id, column, column - 1 + count as i64),
            });
        }

        self.start_user_ai_transaction(ops, cursor, TransactionName::ManipulateColumnRow, is_ai);
    }

    pub fn delete_rows(
        &mut self,
        sheet_id: SheetId,
        rows: Vec<i64>,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = vec![Operation::DeleteRows {
            sheet_id,
            rows,
            copy_formats: CopyFormats::None,
            ignore_tables: false,
        }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ManipulateColumnRow, is_ai);
    }

    /// Inserts `count` rows at the given row index.
    ///
    /// The `after` parameter is confusingly named — it controls where formats
    /// are copied FROM, not the direction of insertion:
    ///
    /// - `after=true` → "insert row ABOVE": `row` is the selected row (or
    ///   merge min.y). The selected row shifts down and the new row copies
    ///   its formatting (CopyFormats::After).
    /// - `after=false` → "insert row BELOW": `row` is the selected row + 1
    ///   (or merge max.y + 1). The new row copies formatting from the row
    ///   before it (CopyFormats::Before).
    ///
    /// The caller (TS client) is responsible for adjusting the row to the
    /// merge boundary when the cursor is on a merged cell. If the row
    /// falls inside a merge cell that is NOT the selection, the merge will
    /// expand to accommodate the new row.
    pub fn insert_rows(
        &mut self,
        sheet_id: SheetId,
        row: i64,
        count: u32,
        after: bool,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let mut ops = vec![];
        for i in 0..count as i64 {
            ops.push(Operation::InsertRow {
                sheet_id,
                row: row + i,
                copy_formats: if after {
                    CopyFormats::After
                } else {
                    CopyFormats::Before
                },
                ignore_tables: false,
            });
        }
        if !after && count > 1 {
            ops.push(Operation::SetCursorA1 {
                selection: A1Selection::rows(sheet_id, row, row - 1 + count as i64),
            });
        }
        self.start_user_ai_transaction(ops, cursor, TransactionName::ManipulateColumnRow, is_ai);
    }

    pub fn move_columns(
        &mut self,
        sheet_id: SheetId,
        col_start: i64,
        col_end: i64,
        to: i64,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = vec![Operation::MoveColumns {
            sheet_id,
            col_start,
            col_end,
            to,
        }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ManipulateColumnRow, is_ai);
    }

    pub fn move_rows(
        &mut self,
        sheet_id: SheetId,
        row_start: i64,
        row_end: i64,
        to: i64,
        cursor: Option<String>,
        is_ai: bool,
    ) {
        let ops = vec![Operation::MoveRows {
            sheet_id,
            row_start,
            row_end,
            to,
        }];
        self.start_user_ai_transaction(ops, cursor, TransactionName::ManipulateColumnRow, is_ai);
    }
}

#[cfg(test)]
mod tests {

    use crate::{
        CellValue, Pos, SheetPos,
        a1::A1Selection,
        grid::{CodeCellLanguage, formats::Format},
        test_util::*,
    };

    use super::*;

    #[test]
    fn delete_row_undo_code() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_code_cell(
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Formula,
            "1".to_string(),
            None,
            None,
            false,
        );

        assert_code_language(
            &gc,
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Formula,
            "1".to_string(),
        );

        gc.delete_rows(sheet_id, vec![1], None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.cell_value(Pos::new(1, 1)), None);

        gc.undo(1, None, false);

        assert_code_language(
            &gc,
            SheetPos::new(sheet_id, 1, 1),
            CodeCellLanguage::Formula,
            "1".to_string(),
        );
    }

    #[test]
    fn delete_row_undo_values_code() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_cell_values(
            SheetPos::new(sheet_id, 1, 1),
            vec![vec!["1".into()], vec!["2".into()], vec!["3".into()]],
            None,
            false,
        );

        gc.set_code_cell(
            SheetPos::new(sheet_id, 2, 2),
            CodeCellLanguage::Formula,
            "5".to_string(),
            None,
            None,
            false,
        );

        assert_code_language(
            &gc,
            SheetPos::new(sheet_id, 2, 2),
            CodeCellLanguage::Formula,
            "5".to_string(),
        );

        gc.delete_rows(sheet_id, vec![2], None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos::new(1, 2)),
            Some(CellValue::Number(3.into()))
        );

        gc.undo(1, None, false);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(Pos::new(1, 2)),
            Some(CellValue::Number(2.into()))
        );

        assert_code_language(
            &gc,
            SheetPos::new(sheet_id, 2, 2),
            CodeCellLanguage::Formula,
            "5".to_string(),
        );
    }

    #[test]
    fn column_insert_formatting_after() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .text_color
            .set_rect(1, 1, Some(1), None, Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(Pos::new(1, 1), Some("red".to_string()));

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string())
        );

        gc.insert_columns(sheet_id, 1, 1, true, None, false);

        let sheet = gc.sheet(sheet_id);

        // this is the new column that was inserted (with the copied formatting)
        assert_eq!(
            sheet.formats.fill_color.get(pos![A1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![A1]),
            Some("blue".to_string())
        );

        // this is the original column that was shifted right (with the original formatting)
        assert_eq!(
            sheet.formats.fill_color.get(pos![B1]),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.text_color.get(pos![B1]),
            Some("blue".to_string())
        );

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.formats.format(pos![B1]).is_default());
    }

    #[test]
    fn column_insert_formatting_before() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .text_color
            .set_rect(1, 1, Some(1), None, Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(pos![A1], Some("red".to_string()));

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.insert_columns(sheet_id, 2, 1, false, None, false);

        let sheet = gc.sheet(sheet_id);

        // this is the new column that was inserted (with the copied formatting)
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.formats.format(pos![B1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.formats.format(pos![D1]).is_default());
        assert!(sheet.formats.format(pos![B1]).is_default());
    }

    #[test]
    fn row_insert_formatting_after() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .text_color
            .set_rect(1, 1, None, Some(1), Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(pos![A1], Some("red".to_string()));

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.insert_rows(sheet_id, 1, 1, true, None, false);

        let sheet = gc.sheet(sheet_id);

        // this is the new row that was inserted (with the copied formatting)
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.formats.format(pos![A2]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.formats.format(pos![D2]).is_default());
        assert!(sheet.formats.format(pos![B2]).is_default());
    }

    #[test]
    fn row_insert_formatting_before() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .formats
            .text_color
            .set_rect(1, 1, None, Some(1), Some("blue".to_string()));
        sheet
            .formats
            .fill_color
            .set(Pos::new(1, 1), Some("red".to_string()));

        let a1_context = gc.a1_context().to_owned();
        gc.sheet_mut(sheet_id).recalculate_bounds(&a1_context);

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.insert_rows(sheet_id, 2, 1, false, None, false);

        let sheet = gc.sheet(sheet_id);

        // this is the new row that was inserted (with the copied formatting)
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        // this is the original row that was shifted down (with the original formatting)
        assert_eq!(
            sheet.formats.format(pos![A2]),
            Format {
                fill_color: Some("red".to_string()),
                text_color: Some("blue".to_string()),
                ..Default::default()
            }
        );

        gc.undo(1, None, false);
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.format(pos![A1]),
            Format {
                text_color: Some("blue".to_string()),
                fill_color: Some("red".to_string()),
                ..Default::default()
            }
        );
        assert!(sheet.formats.format(pos![A2]).is_default());
        assert!(sheet.formats.format(pos![B2]).is_default());
    }

    #[test]
    fn test_insert_multiple_columns_formatting() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        // Set up formatting in column A5 and A10
        gc.set_cell_value(pos![sheet_id!C1], "hello".to_string(), None, false);
        gc.set_bold(&A1Selection::test_a1("C5"), Some(true), None, false)
            .unwrap();

        // Insert 3 columns after C
        gc.insert_columns(sheet_id, 4, 3, false, None, false);
        assert_display_cell_value_first_sheet(&gc, 3, 1, "hello");
        assert_cell_format_bold(&gc, sheet_id, 3, 5, true);
        assert_cell_format_bold(&gc, sheet_id, 4, 5, true);
        assert_cell_format_bold(&gc, sheet_id, 5, 5, true);
        assert_cell_format_bold(&gc, sheet_id, 6, 5, true);
        assert_cell_format_bold(&gc, sheet_id, 7, 5, false);

        gc.undo(1, None, false);

        // insert 3 columns before C
        gc.insert_columns(sheet_id, 3, 3, true, None, false);
        assert_display_cell_value_first_sheet(&gc, 6, 1, "hello");
        assert_cell_format_bold(&gc, sheet_id, 3, 5, true);
        assert_cell_format_bold(&gc, sheet_id, 4, 5, true);
        assert_cell_format_bold(&gc, sheet_id, 5, 5, true);
        assert_cell_format_bold(&gc, sheet_id, 6, 5, true);
        assert_cell_format_bold(&gc, sheet_id, 7, 5, false);
    }

    /// Helper: creates a GridController with a merge at B2:D4, a value at
    /// the anchor (B2), and fill color "red" on the entire merge region.
    fn setup_merge_gc() -> (GridController, SheetId) {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set a value at the merge anchor
        gc.set_cell_value(pos![sheet_id!B2], "merged".to_string(), None, false);

        // Merge B2:D4 (columns 2-4, rows 2-4)
        gc.merge_cells(A1Selection::test_a1("B2:D4"), None, false);

        // Apply fill color to the merge region
        gc.set_fill_color(
            &A1Selection::test_a1("B2:D4"),
            Some("red".to_string()),
            None,
            false,
        )
        .unwrap();

        (gc, sheet_id)
    }

    // ---------------------------------------------------------------
    // Merge-cell insertion tests.
    //
    // The TS client adjusts the column/row to the merge boundary when
    // the cursor is on a merged cell. These tests simulate that by
    // passing the pre-adjusted values (merge min/max).
    //
    // When the insertion column/row falls strictly inside a merge that
    // is NOT the selection (e.g., cursor on a non-merge cell in the
    // same column), the merge should EXPAND to accommodate the insert.
    // ---------------------------------------------------------------

    /// Insert column LEFT with cursor on a merge cell.
    /// TS adjusts column to merge.min.x = 2, after=true.
    /// The merge B2:D4 should shift right to C2:E4.
    #[test]
    fn insert_column_left_cursor_on_merge() {
        let (mut gc, sheet_id) = setup_merge_gc();

        // TS: cursor on merge B2:D4, "insert LEFT" → column = merge.min.x = 2
        gc.insert_columns(sheet_id, 2, 1, true, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should shift right: B2:D4 → C2:E4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1, "should still have exactly one merge");
        assert_eq!(rects[0], crate::Rect::test_a1("C2:E4"));

        // Value should follow the merge anchor to C2
        assert_display_cell_value(&gc, sheet_id, 3, 2, "merged");

        // Fill should cover the shifted merge region C2:E4
        assert_cell_format_fill_color(&gc, sheet_id, 3, 2, "red"); // C2
        assert_cell_format_fill_color(&gc, sheet_id, 5, 4, "red"); // E4
    }

    /// Insert column RIGHT with cursor on a merge cell.
    /// TS adjusts column to merge.max.x + 1 = 5, after=false.
    /// The merge B2:D4 should stay unchanged.
    #[test]
    fn insert_column_right_cursor_on_merge() {
        let (mut gc, sheet_id) = setup_merge_gc();

        // TS: cursor on merge B2:D4, "insert RIGHT" → column = merge.max.x + 1 = 5
        gc.insert_columns(sheet_id, 5, 1, false, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should be unchanged: B2:D4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1, "should still have exactly one merge");
        assert_eq!(rects[0], crate::Rect::test_a1("B2:D4"));

        // Value should remain at B2
        assert_display_cell_value(&gc, sheet_id, 2, 2, "merged");

        // Fill should still cover B2:D4
        assert_cell_format_fill_color(&gc, sheet_id, 2, 2, "red"); // B2
        assert_cell_format_fill_color(&gc, sheet_id, 4, 4, "red"); // D4
    }

    /// Insert row ABOVE with cursor on a merge cell.
    /// TS adjusts row to merge.min.y = 2, after=true.
    /// The merge B2:D4 should shift down to B3:D5.
    #[test]
    fn insert_row_above_cursor_on_merge() {
        let (mut gc, sheet_id) = setup_merge_gc();

        // TS: cursor on merge B2:D4, "insert ABOVE" → row = merge.min.y = 2
        gc.insert_rows(sheet_id, 2, 1, true, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should shift down: B2:D4 → B3:D5
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1, "should still have exactly one merge");
        assert_eq!(rects[0], crate::Rect::test_a1("B3:D5"));

        // Value should follow the merge anchor to B3
        assert_display_cell_value(&gc, sheet_id, 2, 3, "merged");

        // Fill should cover the shifted merge region B3:D5
        assert_cell_format_fill_color(&gc, sheet_id, 2, 3, "red"); // B3
        assert_cell_format_fill_color(&gc, sheet_id, 4, 5, "red"); // D5
    }

    /// Insert row BELOW with cursor on a merge cell.
    /// TS adjusts row to merge.max.y + 1 = 5, after=false.
    /// The merge B2:D4 should stay unchanged.
    #[test]
    fn insert_row_below_cursor_on_merge() {
        let (mut gc, sheet_id) = setup_merge_gc();

        // TS: cursor on merge B2:D4, "insert BELOW" → row = merge.max.y + 1 = 5
        gc.insert_rows(sheet_id, 5, 1, false, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should be unchanged: B2:D4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1, "should still have exactly one merge");
        assert_eq!(rects[0], crate::Rect::test_a1("B2:D4"));

        // Value should remain at B2
        assert_display_cell_value(&gc, sheet_id, 2, 2, "merged");

        // Fill should still cover B2:D4
        assert_cell_format_fill_color(&gc, sheet_id, 2, 2, "red"); // B2
        assert_cell_format_fill_color(&gc, sheet_id, 4, 4, "red"); // D4
    }

    /// Insert column LEFT with cursor on a merge cell, then undo.
    #[test]
    fn insert_column_left_cursor_on_merge_undo() {
        let (mut gc, sheet_id) = setup_merge_gc();

        gc.insert_columns(sheet_id, 2, 1, true, None, false);
        gc.undo(1, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should be restored to B2:D4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], crate::Rect::test_a1("B2:D4"));

        assert_display_cell_value(&gc, sheet_id, 2, 2, "merged");
        assert_cell_format_fill_color(&gc, sheet_id, 2, 2, "red");
        assert_cell_format_fill_color(&gc, sheet_id, 4, 4, "red");
    }

    /// Insert row ABOVE with cursor on a merge cell, then undo.
    #[test]
    fn insert_row_above_cursor_on_merge_undo() {
        let (mut gc, sheet_id) = setup_merge_gc();

        gc.insert_rows(sheet_id, 2, 1, true, None, false);
        gc.undo(1, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should be restored to B2:D4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], crate::Rect::test_a1("B2:D4"));

        assert_display_cell_value(&gc, sheet_id, 2, 2, "merged");
        assert_cell_format_fill_color(&gc, sheet_id, 2, 2, "red");
        assert_cell_format_fill_color(&gc, sheet_id, 4, 4, "red");
    }

    /// Insert 2 columns LEFT with cursor on a merge cell.
    /// TS adjusts column to merge.min.x = 2, both columns go outside
    /// the merge. The merge shifts right by 2.
    #[test]
    fn insert_multiple_columns_left_cursor_on_merge() {
        let (mut gc, sheet_id) = setup_merge_gc();

        // TS: cursor on merge B2:D4, "insert 2 LEFT" → column = merge.min.x = 2
        gc.insert_columns(sheet_id, 2, 2, true, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should shift right by 2: B2:D4 → D2:F4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], crate::Rect::test_a1("D2:F4"));

        assert_display_cell_value(&gc, sheet_id, 4, 2, "merged"); // D2
        assert_cell_format_fill_color(&gc, sheet_id, 4, 2, "red"); // D2
        assert_cell_format_fill_color(&gc, sheet_id, 6, 4, "red"); // F4
    }

    /// Insert 2 rows ABOVE with cursor on a merge cell.
    /// TS adjusts row to merge.min.y = 2, both rows go outside the
    /// merge. The merge shifts down by 2.
    #[test]
    fn insert_multiple_rows_above_cursor_on_merge() {
        let (mut gc, sheet_id) = setup_merge_gc();

        // TS: cursor on merge B2:D4, "insert 2 ABOVE" → row = merge.min.y = 2
        gc.insert_rows(sheet_id, 2, 2, true, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should shift down by 2: B2:D4 → B4:D6
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], crate::Rect::test_a1("B4:D6"));

        assert_display_cell_value(&gc, sheet_id, 2, 4, "merged"); // B4
        assert_cell_format_fill_color(&gc, sheet_id, 2, 4, "red"); // B4
        assert_cell_format_fill_color(&gc, sheet_id, 4, 6, "red"); // D6
    }

    // ---------------------------------------------------------------
    // Intersection tests: cursor is NOT on the merge, but the
    // inserted col/row intersects it. The merge should EXPAND.
    // ---------------------------------------------------------------

    /// Insert a column that intersects a merge (cursor not on merge).
    /// Merge B2:D4, cursor at C5 → column=3, after=true.
    /// The merge should expand: B2:D4 → B2:E4.
    #[test]
    fn insert_column_intersects_merge_expands() {
        let (mut gc, sheet_id) = setup_merge_gc();

        // Cursor at C5 (not on merge B2:D4). TS does NOT adjust.
        // "Insert column LEFT": column = cursor.x = 3
        gc.insert_columns(sheet_id, 3, 1, true, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should expand: B2:D4 → B2:E4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1, "should still have exactly one merge");
        assert_eq!(rects[0], crate::Rect::test_a1("B2:E4"));

        // Value should remain at anchor B2
        assert_display_cell_value(&gc, sheet_id, 2, 2, "merged");
    }

    /// Insert a row that intersects a merge (cursor not on merge).
    /// Merge B2:D4, cursor at A3 → row=3, after=true.
    /// The merge should expand: B2:D4 → B2:D5.
    #[test]
    fn insert_row_intersects_merge_expands() {
        let (mut gc, sheet_id) = setup_merge_gc();

        // Cursor at A3 (not on merge B2:D4). TS does NOT adjust.
        // "Insert row ABOVE": row = cursor.y = 3
        gc.insert_rows(sheet_id, 3, 1, true, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should expand: B2:D4 → B2:D5
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1, "should still have exactly one merge");
        assert_eq!(rects[0], crate::Rect::test_a1("B2:D5"));

        // Value should remain at anchor B2
        assert_display_cell_value(&gc, sheet_id, 2, 2, "merged");
    }

    /// Insert column intersects merge, then undo. Merge should restore.
    #[test]
    fn insert_column_intersects_merge_undo() {
        let (mut gc, sheet_id) = setup_merge_gc();

        gc.insert_columns(sheet_id, 3, 1, true, None, false);
        gc.undo(1, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should be restored to B2:D4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], crate::Rect::test_a1("B2:D4"));

        assert_display_cell_value(&gc, sheet_id, 2, 2, "merged");
    }

    /// Insert row intersects merge, then undo. Merge should restore.
    #[test]
    fn insert_row_intersects_merge_undo() {
        let (mut gc, sheet_id) = setup_merge_gc();

        gc.insert_rows(sheet_id, 3, 1, true, None, false);
        gc.undo(1, None, false);

        let sheet = gc.sheet(sheet_id);

        // Merge should be restored to B2:D4
        let rects: Vec<crate::Rect> = sheet.merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], crate::Rect::test_a1("B2:D4"));

        assert_display_cell_value(&gc, sheet_id, 2, 2, "merged");
    }
}
