use crate::{
    Pos,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

impl Sheet {
    pub(crate) fn check_insert_tables_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
    ) {
        self.data_tables.iter_mut().for_each(|(pos, dt)| {
            if (!dt.readonly || dt.is_html_or_image())
                && row >= pos.y
                && row <= pos.y + dt.height(false) as i64
            {
                if dt.is_html_or_image() {
                    // if html or image, then we need to change the height

                    if let Some((width, height)) = dt.chart_output {
                        dt.chart_output = Some((width, height + 1));
                        transaction
                            .reverse_operations
                            .push(Operation::SetChartCellSize {
                                sheet_pos: pos.to_sheet_pos(self.id),
                                w: width,
                                h: height,
                            });
                        transaction.add_from_code_run(self.id, *pos, dt.is_image(), dt.is_html());
                    }
                } else {
                    // the table overlaps the inserted row

                    let table_row = (row - pos.y) as u32;
                    let display_index = dt.get_row_index_from_display_index(table_row as u64);
                    if dt.insert_row(display_index as usize, None).is_err() {
                        return;
                    }

                    transaction.add_code_cell(self.id, *pos);

                    if dt.formats.has_fills() {
                        transaction.add_fill_cells(self.id);
                    }
                    if !dt.borders.is_default() {
                        transaction.add_borders(self.id);
                    }
                }
            }
        });
    }

    pub(crate) fn adjust_insert_tables_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        row: i64,
    ) {
        // update the indices of all code_runs impacted by the insertion
        let mut data_tables_to_move = Vec::new();
        for (pos, dt) in self.data_tables.iter() {
            if pos.y >= row {
                data_tables_to_move.push((*pos, dt.is_image(), dt.is_html()));
            }
        }
        data_tables_to_move.sort_by(|(a, _, _), (b, _, _)| b.y.cmp(&a.y));
        for (old_pos, is_image, is_html) in data_tables_to_move {
            dbgjs!(format!(
                "old_pos: {:?}, is_image: {:?}, is_html: {:?}",
                old_pos, is_image, is_html
            ));
            let new_pos = Pos {
                x: old_pos.x,
                y: old_pos.y + 1,
            };
            if let Some(code_run) = self.data_tables.shift_remove(&old_pos) {
                // signal html and image cells to update
                self.data_tables.insert_sorted(new_pos, code_run);

                // signal the client to updates to the code cells (to draw the code arrays)
                transaction.add_from_code_run(self.id, old_pos, is_image, is_html);
                transaction.add_from_code_run(self.id, new_pos, is_image, is_html);
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
