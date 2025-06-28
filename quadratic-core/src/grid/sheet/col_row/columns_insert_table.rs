//! Insert columns in data tables that overlap the inserted column.
//!
//! Note: the column that insert column receives relates to where the column is
//! being inserted. So if insert to the left of the column, then the column is
//! the selected column, and CopyFormats::After. If inserting to the right of
//! the column, then the column is the selected column + 1, and
//! CopyFormats::Before. This is important to keep in mind for table operations.

use crate::{
    CopyFormats, MultiPos,
    controller::active_transactions::pending_transaction::PendingTransaction, grid::Sheet,
};

impl Sheet {
    /// Insert columns in data tables that overlap the inserted column.
    pub(crate) fn check_insert_tables_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        column: i64,
        copy_formats: CopyFormats,
    ) {
        let sheet_id = self.id;

        let source_column = match copy_formats {
            CopyFormats::After => column - 1,
            _ => column,
        };

        let all_pos_intersecting_columns = self
            .data_tables
            .get_pos_after_column_sorted(column - 1, false);

        for (_, pos) in all_pos_intersecting_columns.into_iter().rev() {
            if let Ok((_, dirty_rects)) = self.modify_data_table_at_pos(&pos, |dt| {
                let output_rect = dt.output_rect(pos, false);
                // if html or image, then we need to change the width
                if dt.is_html_or_image() {
                    if let Some((width, height)) = dt.chart_output {
                        if column >= pos.x && column < pos.x + output_rect.width() as i64 {
                            dt.chart_output = Some((width + 1, height));
                            transaction.add_from_code_run(
                                pos.to_multi_pos(sheet_id),
                                dt.is_image(),
                                dt.is_html(),
                            );
                        }
                    }
                } else {
                    // Adds columns to data tables if the column is inserted inside the
                    // table. Code is not impacted by this change.
                    if !dt.is_code()
                        && source_column >= pos.x
                        && (column < pos.x + output_rect.width() as i64
                            || (CopyFormats::Before == copy_formats
                                && column < pos.x + output_rect.width() as i64 + 1))
                    {
                        if let Ok(display_column_index) = u32::try_from(column - pos.x) {
                            let column_index =
                                dt.get_column_index_from_display_index(display_column_index, true);
                            let _ = dt.insert_column_sorted(column_index as usize, None, None);
                            transaction.add_from_code_run(
                                pos.to_multi_pos(sheet_id),
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
                self.data_table_at(pos).is_some_and(|dt| {
                    (copy_formats == CopyFormats::Before && pos.x > column)
                        || (copy_formats == CopyFormats::Before && pos.x == column && dt.is_code())
                        || (copy_formats != CopyFormats::Before && pos.x >= column)
                })
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
                    (!dt.is_code() || dt.is_html_or_image())
                        && copy_formats == CopyFormats::Before
                        && pos.x == column
                })
            })
            .collect::<Vec<_>>();

        // move the data tables to the right to match with their new anchor positions
        data_tables_to_move_right.sort_by(|(_, a), (_, b)| b.x.cmp(&a.x));
        for (_, old_pos) in data_tables_to_move_right {
            let old_pos = old_pos.to_multi_pos(self.id);
            if let Some((index, old_pos, data_table, dirty_rects)) =
                self.data_table_shift_remove(&old_pos)
            {
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
                transaction.add_from_code_run(old_pos, data_table.is_image(), data_table.is_html());

                let new_pos = old_pos.translate(1, 0, i64::MIN, i64::MIN);
                transaction.add_from_code_run(new_pos, data_table.is_image(), data_table.is_html());
                if let Ok((_, _, dirty_rects)) =
                    self.data_table_insert_before(index, new_pos, data_table)
                {
                    transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
                }
            }
        }
        // In the special case of CopyFormats::Before and column == pos.x, we
        // need to move it back.
        data_tables_to_move_back.sort_by(|(_, a), (_, b)| a.x.cmp(&b.x));
        for (_, to) in data_tables_to_move_back {
            let from = to.translate(1, 0, i64::MIN, i64::MIN);
            self.columns.move_cell_value(&from, &to);
            transaction.add_code_cell(to.to_multi_pos(self.id));
        }
    }
}

#[cfg(test)]
mod tests {
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
}
