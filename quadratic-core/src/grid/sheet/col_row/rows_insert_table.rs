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
        let source_row = match copy_formats {
            CopyFormats::After => row - 1,
            _ => row,
        };
        for (pos, dt) in self.data_tables.iter_mut() {
            let output_rect = dt.output_rect(*pos, false);
            // if html or image, then we need to change the height
            if dt.is_html_or_image() {
                if let Some((width, height)) = dt.chart_output {
                    if source_row >= pos.y && source_row < pos.y + output_rect.height() as i64 {
                        dt.chart_output = Some((width, height + 1));
                        transaction.add_from_code_run(self.id, *pos, dt.is_image(), dt.is_html());
                    }
                }
            } else {
                // Adds rows to data tables if the row is inserted inside the
                // table. Code is not impacted by this change.
                if !dt.is_code()
                    && source_row >= pos.y
                    && (row < pos.y + output_rect.height() as i64
                        || (CopyFormats::Before == copy_formats
                            && row < pos.y + output_rect.height() as i64 + 1))
                {
                    if let Ok(display_row_index) = usize::try_from(row - pos.y) {
                        if dt.insert_row(display_row_index, None).is_err() {
                            continue;
                        }
                        if dt.sort.is_some() {
                            dt.sort_dirty = true;
                        }
                        transaction.add_from_code_run(self.id, *pos, dt.is_image(), dt.is_html());
                        if dt.formats.has_fills() {
                            transaction.add_fill_cells(self.id);
                        }
                        if !dt.borders.is_default() {
                            transaction.add_borders(self.id);
                        }
                    }
                }
            }
        }
    }

    pub(crate) fn adjust_insert_tables_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
    ) {
        // update the indices of all code_runs impacted by the insertion
        let mut data_tables_to_move = Vec::new();
        for (pos, _) in self.data_tables.iter() {
            if pos.y >= row {
                data_tables_to_move.push(*pos);
            }
        }
        data_tables_to_move.sort_by(|a, b| b.y.cmp(&a.y));
        for old_pos in data_tables_to_move {
            if let Some((index, old_pos, data_table)) = self.data_tables.shift_remove_full(&old_pos)
            {
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
                self.data_tables.shift_insert(index, new_pos, data_table);
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

        gc.insert_row(sheet_id, 4, false, None);
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

        gc.insert_row(sheet_id, 4, true, None);
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

        gc.insert_row(sheet_id, 5, false, None);
        assert_display_cell_value(&gc, sheet_id, 2, 5, "");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);

        gc.undo(None);
        assert_display_cell_value(&gc, sheet_id, 2, 5, "2");
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 2, false);

        gc.insert_row(sheet_id, 5, true, None);
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

        gc.insert_row(sheet_id, 4, false, None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);
    }
}
