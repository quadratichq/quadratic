//! Insert columns in data tables that overlap the inserted column.
//!
//! Note: the column that insert column receives relates to where the column is
//! being inserted. So if insert to the left of the column, then the column is
//! the selected column, and CopyFormats::After. If inserting to the right of
//! the column, then the column is the selected column + 1, and
//! CopyFormats::Before. This is important to keep in mind for table operations.

use crate::{
    CopyFormats, Pos,
    controller::active_transactions::pending_transaction::PendingTransaction,
    grid::{DataTable, Sheet},
};

impl Sheet {
    /*
        /// For example:
        /// - if you're in C and insert to the left, then column = C and CopyFormats::After
        /// - if you're in C and insert to the right, then column = D and CopyFormats::Before
        /// - if you're in C and insert to the right with 3 columns selected, then column = F and CopyFormats::Before

    */

    /// Returns true if the column is inside the table.
    fn is_column_inside_table(
        column: i64,
        pos: Pos,
        dt: &DataTable,
        copy_formats: CopyFormats,
    ) -> bool {
        if copy_formats == CopyFormats::After {
            column >= pos.x && column < pos.x + dt.output_rect(pos, false).width() as i64
        } else {
            // CopyFormats::Before
            column - 1 >= pos.x && column - 1 < pos.x + dt.output_rect(pos, false).width() as i64
        }
    }

    /// Returns true if the column is left of the table.
    fn is_column_before_table(column: i64, pos: Pos, copy_formats: CopyFormats) -> bool {
        if copy_formats == CopyFormats::After {
            column < pos.x
        } else {
            column - 1 < pos.x
        }
    }

    /// Returns true if the column is in the anchor cell.
    fn is_column_in_anchor_cell(column: i64, pos: Pos, copy_formats: CopyFormats) -> bool {
        if copy_formats == CopyFormats::After {
            column == pos.x
        } else {
            // CopyFormats::Before
            column - 1 == pos.x
        }
    }

    /// Insert columns in data tables that overlap the inserted column.
    pub(crate) fn check_insert_tables_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
    ) {
        let sheet_id = self.id;

        let all_pos_intersecting_columns = self
            .data_tables
            .get_pos_after_column_sorted(column - 1, false);

        for (_, pos) in all_pos_intersecting_columns.into_iter().rev() {
            if let Ok((_, dirty_rects)) = self.modify_data_table_at(&pos, |dt| {
                let output_rect = dt.output_rect(pos, false);
                // if html or image, then we need to change the width
                if dt.is_html_or_image() {
                    if let Some((width, height)) = dt.chart_output
                        && column >= pos.x
                        && column < pos.x + output_rect.width() as i64
                    {
                        dt.chart_output = Some((width + 1, height));
                        transaction.add_from_code_run(sheet_id, pos, dt.is_image(), dt.is_html());
                    }
                } else {
                    // Adds columns to data tables if the column is inserted inside the
                    // table. Code is not impacted by this change.
                    if !dt.is_code() && Self::is_column_inside_table(column, pos, dt, copy_formats)
                    {
                        if let Ok(display_column_index) = u32::try_from(column - pos.x) {
                            let column_index =
                                dt.get_column_index_from_display_index(display_column_index, true);
                            let _ = dt.insert_column_sorted(column_index as usize, None, None);
                            transaction.add_from_code_run(
                                sheet_id,
                                pos,
                                dt.is_image(),
                                dt.is_html(),
                            );
                            if dt
                                .formats
                                .as_ref()
                                .is_some_and(|formats| formats.has_fills())
                            {
                                transaction.add_fill_cells(sheet_id);
                            }
                            if !dt
                                .borders
                                .as_ref()
                                .is_none_or(|borders| borders.is_default())
                            {
                                transaction.add_borders(sheet_id);
                            }
                        }
                    }
                }
                Ok(())
            }) {
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
            }
        }
    }

    /// Adjust data tables that overlap the inserted column.
    pub(crate) fn adjust_insert_tables_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
    ) {
        // these are tables that were moved to the right by the insertion
        // Catch all cases where the dt needs to be pushed to the right b/c of an insert.
        let mut data_tables_to_move_right = self
            .data_tables
            .get_pos_after_column_sorted(column, false)
            .into_iter()
            .filter(|(_, pos)| {
                self.data_table_at(pos)
                    .is_some_and(|_| Self::is_column_before_table(column, *pos, copy_formats))
            })
            .collect::<Vec<_>>();

        // these are tables that were moved but should have stayed in place (ie,
        // a column was inserted instead of moving the table over)
        let mut data_tables_to_move_back = self
            .data_tables
            .get_pos_in_columns_sorted(&[column], false)
            .into_iter()
            .filter(|(_, pos)| {
                self.data_table_at(pos).is_some_and(|dt| {
                    Self::is_column_inside_table(column, *pos, dt, copy_formats)
                        && Self::is_column_in_anchor_cell(column, *pos, copy_formats)
                })
            })
            .collect::<Vec<_>>();

        // move the data tables to the right to match with their new anchor positions
        data_tables_to_move_right.sort_by(|(_, a), (_, b)| b.x.cmp(&a.x));
        for (_, old_pos) in data_tables_to_move_right {
            if let Some((index, old_pos, data_table, dirty_rects)) =
                self.data_table_shift_remove_full(&old_pos)
            {
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
                transaction.add_from_code_run(
                    self.id,
                    old_pos,
                    data_table.is_image(),
                    data_table.is_html(),
                );

                let new_pos = old_pos.translate(1, 0, i64::MIN, i64::MIN);
                transaction.add_from_code_run(
                    self.id,
                    new_pos,
                    data_table.is_image(),
                    data_table.is_html(),
                );
                let dirty_rects = self.data_table_insert_before(index, &new_pos, data_table).2;
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
            }
        }
        // In the special case of CopyFormats::Before and column == pos.x, we
        // need to move it back.
        data_tables_to_move_back.sort_by(|(_, a), (_, b)| a.x.cmp(&b.x));
        for (_, to) in data_tables_to_move_back {
            let from = to.translate(1, 0, i64::MIN, i64::MIN);
            self.columns.move_cell_value(&from, &to);
            transaction.add_code_cell(self.id, to);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        controller::GridController, test_create_code_table, test_util::*, wasm_bindings::js::*,
    };

    #[test]
    fn test_insert_column_before_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![C1], 3, 3);

        gc.insert_columns(sheet_id, 1, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![D1], 3, 3, false);
        assert_display_cell_value(&gc, sheet_id, 4, 3, "0");

        clear_js_calls();
        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![C1], 3, 3, false);
        assert_display_cell_value(&gc, sheet_id, 3, 3, "0");
        expect_js_call_count("jsUpdateCodeCells", 1, true);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![D1], 3, 3, false);
        assert_display_cell_value(&gc, sheet_id, 4, 3, "0");
    }

    #[test]
    fn test_insert_column_before_two_tables() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![C1], 3, 3);
        test_create_code_table(&mut gc, sheet_id, pos![C7], 3, 3);

        gc.insert_columns(sheet_id, 1, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![D1], 3, 3, false);
        assert_data_table_size(&gc, sheet_id, pos![D7], 3, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![C1], 3, 3, false);
        assert_data_table_size(&gc, sheet_id, pos![C7], 3, 3, false);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![D1], 3, 3, false);
        assert_data_table_size(&gc, sheet_id, pos![D7], 3, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![C1], 3, 3, false);
        assert_data_table_size(&gc, sheet_id, pos![C7], 3, 3, false);
    }

    #[test]
    fn test_insert_column_after_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![C1], 3, 3);
        test_create_code_table(&mut gc, sheet_id, pos![C7], 3, 3);

        gc.insert_columns(sheet_id, 10, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![C1], 3, 3, false);
        assert_data_table_size(&gc, sheet_id, pos![C7], 3, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![C1], 3, 3, false);
        assert_data_table_size(&gc, sheet_id, pos![C7], 3, 3, false);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![C1], 3, 3, false);
        assert_data_table_size(&gc, sheet_id, pos![C7], 3, 3, false);
    }

    #[test]
    fn test_insert_column_front_data_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![B2], 3, 3);

        // insert column before the table (which should shift the table over by 1)
        gc.insert_columns(sheet_id, 2, 1, true, None);
        assert_data_table_size(&gc, sheet_id, pos![C2], 3, 3, false);
        assert_display_cell_value(&gc, sheet_id, 3, 4, "0");
        assert_display_cell_value(&gc, sheet_id, 2, 4, "");

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "0");

        // insert column as the second column (cannot insert the first column except via the table menu)
        gc.insert_columns(sheet_id, 2, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 3, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "");
        assert_display_cell_value(&gc, sheet_id, 3, 4, "0");

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "0");

        gc.redo(None);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "");
        assert_display_cell_value(&gc, sheet_id, 3, 4, "0");
    }

    #[test]
    fn test_insert_column_middle_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![B2], 3, 3);

        gc.insert_columns(sheet_id, 3, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 3, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "0");
        assert_display_cell_value(&gc, sheet_id, 3, 4, "");

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 3, false);
    }

    #[test]
    fn test_insert_column_end_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![B2], 3, 3);

        gc.insert_columns(sheet_id, 5, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 3, false);
        assert_display_cell_value(&gc, sheet_id, 4, 4, "2");
        assert_display_cell_value(&gc, sheet_id, 5, 4, "");

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);
        assert_display_cell_value(&gc, sheet_id, 4, 4, "2");

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 3, false);
        assert_display_cell_value(&gc, sheet_id, 4, 4, "2");
        assert_display_cell_value(&gc, sheet_id, 5, 4, "");
    }

    #[test]
    fn test_insert_chart_columns() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_js_chart(&mut gc, sheet_id, pos![A1], 3, 3);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 3, false);
        test_create_html_chart(&mut gc, sheet_id, pos![B5], 3, 3);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 3, false);

        gc.insert_columns(sheet_id, 3, 1, true, None);
        assert_chart_size(&gc, sheet_id, pos![A1], 4, 3, false);
        assert_chart_size(&gc, sheet_id, pos![B5], 4, 3, false);

        gc.undo(None);
        assert_chart_size(&gc, sheet_id, pos![A1], 3, 3, false);
        assert_chart_size(&gc, sheet_id, pos![B5], 3, 3, false);

        gc.redo(None);
        assert_chart_size(&gc, sheet_id, pos![A1], 4, 3, false);
        assert_chart_size(&gc, sheet_id, pos![B5], 4, 3, false);
    }

    #[test]
    fn test_insert_column_end_of_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);
        gc.insert_columns(sheet_id, 3, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 4, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 3, false);
    }

    #[test]
    fn test_insert_front_of_image() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_js_chart(&mut gc, sheet_id, pos![B2], 2, 2);

        clear_js_calls();
        gc.insert_columns(sheet_id, 1, 1, true, None);
        assert_data_table_size(&gc, sheet_id, pos![C2], 2, 2, false);
        expect_js_call_count("jsUpdateCodeCells", 1, false);
        expect_js_call_count("jsSendImage", 2, true);
    }

    #[test]
    fn test_column_is_inside_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        let dt = test_create_data_table(&mut gc, sheet_id, pos![C1], 3, 3);
        let code = test_create_code_table(&mut gc, sheet_id, pos![C7], 3, 3);
        // For example:
        // - if you're in C and insert to the left, then column = C and CopyFormats::After
        // - if you're in C and insert to the right, then column = D and CopyFormats::Before
        // - if you're in C and insert to the right with 3 columns selected, then column = F and CopyFormats::Before

        let check = |column: i64, copy_formats: CopyFormats, expected: bool| {
            assert!(Sheet::is_column_inside_table(column, pos![C1], &dt, copy_formats) == expected);
            assert!(
                Sheet::is_column_inside_table(column, pos![C7], &code, copy_formats) == expected
            );
        };

        // insert to the left
        check(3, CopyFormats::After, true);
        check(4, CopyFormats::After, true);
        check(5, CopyFormats::After, true);
        check(6, CopyFormats::After, false);
        check(2, CopyFormats::After, false);

        // insert to the right
        check(3 + 1, CopyFormats::Before, true);
        check(4 + 1, CopyFormats::Before, true);
        check(5 + 1, CopyFormats::Before, true);
        check(6 + 1, CopyFormats::Before, false);
        check(2 + 1, CopyFormats::Before, false);
    }

    #[test]
    fn test_column_is_in_anchor_cell() {
        let check = |column: i64, copy_formats: CopyFormats, expected: bool| {
            assert!(Sheet::is_column_in_anchor_cell(column, pos![C1], copy_formats) == expected);
            assert!(Sheet::is_column_in_anchor_cell(column, pos![C7], copy_formats) == expected);
        };

        // insert to the left
        check(3, CopyFormats::After, true);
        check(4, CopyFormats::After, false);
        check(5, CopyFormats::After, false);
        check(6, CopyFormats::After, false);
        check(2, CopyFormats::After, false);

        // insert to the right
        check(3 + 1, CopyFormats::Before, true);
        check(4 + 1, CopyFormats::Before, false);
        check(5 + 1, CopyFormats::Before, false);
        check(6 + 1, CopyFormats::Before, false);
        check(2 + 1, CopyFormats::Before, false);
    }
}
