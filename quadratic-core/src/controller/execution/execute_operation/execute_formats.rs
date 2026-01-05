use crate::controller::GridController;
use crate::controller::active_transactions::pending_transaction::PendingTransaction;
use crate::controller::operations::operation::Operation;

impl GridController {
    pub fn execute_set_cell_formats_a1(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        unwrap_op!(let SetCellFormatsA1 { sheet_id, formats } = op);

        let Some(sheet) = self.try_sheet_mut(sheet_id) else {
            return; // sheet may have been deleted
        };

        let (reverse_operations, hashes, rows, fill_bounds, has_meta_fills) =
            sheet.set_formats_a1(&formats);

        if reverse_operations.is_empty() {
            return;
        }

        self.send_updated_bounds(transaction, sheet_id);

        if !transaction.is_server() {
            if !hashes.is_empty() {
                let dirty_hashes = transaction.dirty_hashes.entry(sheet_id).or_default();
                dirty_hashes.extend(hashes);
            }

            if !rows.is_empty() && transaction.is_user_ai() {
                transaction
                    .resize_rows
                    .entry(sheet_id)
                    .or_default()
                    .extend(rows);
            }

            if let Some(fill_bounds) = fill_bounds {
                transaction.add_fill_cells(sheet_id, fill_bounds);
            }

            if has_meta_fills {
                transaction.add_sheet_meta_fills(sheet_id);

                // For infinite fills, also mark the affected finite fill hashes as dirty
                // since the Contiguous2D structure may have been modified
                if let Some(fill_color) = &formats.fill_color {
                    let sheet = self.try_sheet(sheet_id).expect("sheet should exist");
                    for (x1, y1, x2, y2, _) in fill_color.to_rects() {
                        match (x2, y2) {
                            // Sheet fill - mark all hashes
                            (None, None) => {
                                transaction.add_fill_cells_from_rows(sheet, 1);
                            }
                            // Row fill - mark hashes from this row
                            (None, Some(y2)) => {
                                transaction.add_fill_cells_from_rows(sheet, y1);
                                // Also need to mark rows up to y2 if it's a range
                                if y2 > y1 {
                                    transaction.add_fill_cells_from_rows(sheet, y2);
                                }
                            }
                            // Column fill - mark hashes from this column
                            (Some(x2), None) => {
                                transaction.add_fill_cells_from_columns(sheet, x1);
                                // Also need to mark columns up to x2 if it's a range
                                if x2 > x1 {
                                    transaction.add_fill_cells_from_columns(sheet, x2);
                                }
                            }
                            // Finite fill - already handled by fill_bounds
                            (Some(_), Some(_)) => {}
                        }
                    }
                }
            }
        }

        if transaction.is_user_ai_undo_redo() {
            transaction.generate_thumbnail |= self.thumbnail_dirty_formats(sheet_id, &formats);

            transaction
                .forward_operations
                .push(Operation::SetCellFormatsA1 { sheet_id, formats });

            transaction
                .reverse_operations
                .extend(reverse_operations.iter().cloned());
        }
    }
}

#[cfg(test)]
mod test {
    use crate::a1::A1Selection;
    use crate::controller::GridController;
    use crate::grid::formats::FormatUpdate;

    #[test]
    fn test_set_formats_with_meta_fills_column() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set fill color on column A (infinite column fill - triggers has_meta_fills)
        let selection = A1Selection::test_a1("A");
        gc.set_fill_color(&selection, Some("red".to_string()), None, false)
            .unwrap();

        // Verify the fill was applied to cells in column A
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 1, y: 1 }),
            Some("red".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 1, y: 100 }),
            Some("red".to_string())
        );
        // Verify other columns are not affected
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 2, y: 1 }),
            None
        );
    }

    #[test]
    fn test_set_formats_with_meta_fills_row() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set fill color on row 1 (infinite row fill - triggers has_meta_fills)
        let selection = A1Selection::test_a1("1");
        gc.set_fill_color(&selection, Some("blue".to_string()), None, false)
            .unwrap();

        // Verify the fill was applied to cells in row 1
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 1, y: 1 }),
            Some("blue".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 100, y: 1 }),
            Some("blue".to_string())
        );
        // Verify other rows are not affected
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 1, y: 2 }),
            None
        );
    }

    #[test]
    fn test_set_formats_with_meta_fills_sheet() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set fill color on entire sheet (infinite sheet fill - triggers has_meta_fills)
        let selection = A1Selection::test_a1("*");
        gc.set_fill_color(&selection, Some("green".to_string()), None, false)
            .unwrap();

        // Verify the fill was applied everywhere
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 1, y: 1 }),
            Some("green".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 100, y: 100 }),
            Some("green".to_string())
        );
    }

    #[test]
    fn test_set_formats_with_meta_fills_multiple_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set fill color on columns A:C (infinite column range fill - triggers has_meta_fills)
        let selection = A1Selection::test_a1("A:C");
        gc.set_fill_color(&selection, Some("yellow".to_string()), None, false)
            .unwrap();

        // Verify the fill was applied to cells in columns A-C
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 1, y: 1 }),
            Some("yellow".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 3, y: 50 }),
            Some("yellow".to_string())
        );
        // Verify column D is not affected
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 4, y: 1 }),
            None
        );
    }

    #[test]
    fn test_set_formats_with_meta_fills_multiple_rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set fill color on rows 1:3 (infinite row range fill - triggers has_meta_fills)
        let selection = A1Selection::test_a1("1:3");
        gc.set_fill_color(&selection, Some("purple".to_string()), None, false)
            .unwrap();

        // Verify the fill was applied to cells in rows 1-3
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 1, y: 1 }),
            Some("purple".to_string())
        );
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 50, y: 3 }),
            Some("purple".to_string())
        );
        // Verify row 4 is not affected
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 1, y: 4 }),
            None
        );
    }

    #[test]
    fn test_set_formats_with_mixed_format_updates() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set multiple format properties on a column (triggers has_meta_fills for fill_color)
        let selection = A1Selection::test_a1("B");
        let format_update = FormatUpdate {
            fill_color: Some(Some("orange".to_string())),
            bold: Some(Some(true)),
            ..Default::default()
        };
        gc.set_formats(&selection, format_update, None, false);

        // Verify both formats were applied
        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 2, y: 1 }),
            Some("orange".to_string())
        );
        assert_eq!(
            sheet.formats.bold.get(crate::Pos { x: 2, y: 1 }),
            Some(true)
        );
        assert_eq!(
            sheet.formats.fill_color.get(crate::Pos { x: 2, y: 1000 }),
            Some("orange".to_string())
        );
    }
}
