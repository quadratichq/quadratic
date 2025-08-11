use crate::{
    CopyFormats, controller::active_transactions::pending_transaction::PendingTransaction,
    grid::Sheet,
};

impl Sheet {
    pub(crate) fn check_insert_tables_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
        copy_formats: CopyFormats,
    ) {
        let sheet_id = self.id;

        let source_row = match copy_formats {
            CopyFormats::After => row - 1,
            _ => row,
        };

        let all_pos_intersecting_columns =
            self.data_tables.get_pos_after_row_sorted(row - 1, false);

        for (_, pos) in all_pos_intersecting_columns.into_iter().rev() {
            if let Ok((_, dirty_rects)) = self.modify_data_table_at(&pos, |dt| {
                let output_rect = dt.output_rect(pos, false);
                // if html or image, then we need to change the height
                if dt.is_html_or_image() {
                    if let Some((width, height)) = dt.chart_output
                        && row >= pos.y && row < pos.y + output_rect.height() as i64 {
                            dt.chart_output = Some((width, height + 1));
                            transaction.add_from_code_run(
                                sheet_id,
                                pos,
                                dt.is_image(),
                                dt.is_html(),
                            );
                        }
                } else {
                    // Adds rows to data tables if the row is inserted inside the
                    // table. Code is not impacted by this change.
                    if !dt.is_code()
                        && source_row >= pos.y
                        && (row < pos.y + output_rect.height() as i64
                            || (CopyFormats::Before == copy_formats
                                && row < pos.y + output_rect.height() as i64 + 1))
                        && let Ok(display_row_index) = usize::try_from(row - pos.y) {
                            dt.insert_row(display_row_index, None)?;

                            if dt.sort.is_some() {
                                dt.sort_dirty = true;
                            }
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

                Ok(())
            }) {
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
            }
        }
    }

    pub(crate) fn adjust_insert_tables_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
    ) {
        // update the indices of all code_runs impacted by the insertion
        let mut data_tables_to_move = self
            .data_tables
            .get_pos_after_row_sorted(row, false)
            .into_iter()
            .filter(|(_, pos)| pos.y >= row)
            .collect::<Vec<_>>();

        data_tables_to_move.sort_by(|(_, a), (_, b)| b.y.cmp(&a.y));
        for (_, old_pos) in data_tables_to_move {
            if let Some((index, old_pos, data_table, dirty_rects)) =
                self.data_table_shift_remove_full(&old_pos)
            {
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
                let new_pos = old_pos.translate(0, 1, i64::MIN, i64::MIN);
                // signal the client to updates to the code cells (to draw the code arrays)
                transaction.add_from_code_run(
                    self.id,
                    old_pos,
                    data_table.is_image(),
                    data_table.is_html(),
                );
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
    }
}

#[cfg(test)]
mod tests {
    use crate::test_util::*;

    #[test]
    fn test_table_insert_row_top() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);

        gc.insert_rows(sheet_id, 4, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "");

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 2, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "0");
        assert_table_count(&gc, sheet_id, 1);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "");

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 2, false);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "0");
    }

    #[test]
    fn test_table_insert_row_middle() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);

        gc.insert_rows(sheet_id, 4, 1, true, None);
        // this is wrong?
        assert_display_cell_value(&gc, sheet_id, 2, 4, "");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);

        gc.undo(None);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "0");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 2, false);

        gc.redo(None);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);

        gc.undo(None);
        assert_display_cell_value(&gc, sheet_id, 2, 4, "0");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 2, false);
    }

    #[test]
    fn test_table_insert_row_bottom() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![B2], 2, 2);

        gc.insert_rows(sheet_id, 5, 1, false, None);
        assert_display_cell_value(&gc, sheet_id, 2, 5, "");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);

        gc.undo(None);
        assert_display_cell_value(&gc, sheet_id, 2, 5, "2");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 2, false);

        gc.insert_rows(sheet_id, 5, 1, true, None);
        assert_display_cell_value(&gc, sheet_id, 2, 5, "");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);

        gc.undo(None);
        assert_display_cell_value(&gc, sheet_id, 2, 5, "2");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 2, false);
    }

    #[test]
    fn test_chart_insert_row() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        test_create_js_chart(&mut gc, sheet_id, pos![B2], 2, 2);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 2, false);

        gc.insert_rows(sheet_id, 4, 1, false, None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);
    }
}
