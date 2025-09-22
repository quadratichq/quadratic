use std::collections::HashSet;

use crate::{
    Rect,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{DataTable, Sheet},
};

impl Sheet {
    /// Deletes all data table where either all columns are part of the deleted
    /// columns, or its a code cell where the first column is in the deleted
    /// columns.
    pub(crate) fn delete_tables_with_all_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        columns: &[i64],
    ) {
        let mut dt_to_delete = HashSet::new();

        for &column in columns {
            let column_rect = Rect::new(column, 1, column, i64::MAX);
            for (_, pos, dt) in self.data_tables.get_in_rect(column_rect, false) {
                if dt_to_delete.contains(&pos) {
                    continue;
                }

                // delete code tables where the code cell is in the deleted columns
                let code_cell_anchor_deleted =
                    ((dt.is_code() && !dt.is_html_or_image()) || dt.has_spill()) && column == pos.x;

                // delete any table where all columns in the table are included in the deletion range
                let all_table_columns_deleted = dt
                    .output_rect(pos, false)
                    .x_range()
                    .all(|col| columns.contains(&col));

                if code_cell_anchor_deleted || all_table_columns_deleted {
                    dt_to_delete.insert(pos);
                }
            }
        }

        for pos in dt_to_delete.into_iter() {
            if let Some((index, pos, old_dt, dirty_rects)) = self.data_table_shift_remove_full(&pos)
            {
                transaction.add_from_code_run(self.id, pos, old_dt.is_image(), old_dt.is_html());
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
                transaction
                    .reverse_operations
                    .push(Operation::SetDataTable {
                        sheet_pos: pos.to_sheet_pos(self.id),
                        data_table: Some(old_dt),
                        index,
                    });
            }
        }
    }

    /// Delete columns from data tables that are in the deleted columns range.
    pub(crate) fn delete_tables_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        columns: &[i64],
    ) {
        let mut dt_to_update = Vec::new();

        let all_pos_intersecting_columns =
            self.data_tables.get_pos_in_columns_sorted(columns, false);
        for (index, pos) in all_pos_intersecting_columns.into_iter().rev() {
            if let Ok((_, dirty_rects)) = self.modify_data_table_at(&pos, |dt| {
                if (dt.is_code() && !dt.is_html_or_image()) || dt.has_spill() {
                    return Ok(());
                }
                let output_rect = dt.output_rect(pos, false);
                let mut old_dt: Option<DataTable> = None;
                for col in columns {
                    // delete the column
                    if old_dt.is_none() {
                        old_dt = Some(dt.clone());
                    }

                    if let Ok(col_to_delete) = u32::try_from(*col - output_rect.min.x) {
                        let column_index =
                            dt.get_column_index_from_display_index(col_to_delete, true);

                        // mark sort dirty if the column is sorted
                        if dt.is_column_sorted(column_index as usize) {
                            dt.sort_dirty = true;
                        }

                        let _ = dt.delete_column_sorted(column_index as usize);
                    }
                }

                if let Some(old_dt) = old_dt {
                    dt_to_update.push((index, pos, old_dt));
                }
                Ok(())
            }) {
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
            }
        }

        // create undo and signal client of changes
        for (index, pos, old_dt) in dt_to_update {
            transaction.add_from_code_run(self.id, pos, old_dt.is_image(), old_dt.is_html());
            transaction.add_dirty_hashes_from_sheet_rect(
                old_dt.output_rect(pos, false).to_sheet_rect(self.id),
            );
            transaction
                .reverse_operations
                .push(Operation::SetDataTable {
                    sheet_pos: pos.to_sheet_pos(self.id),
                    data_table: Some(old_dt),
                    index,
                });
            transaction
                .reverse_operations
                .push(Operation::DeleteDataTable {
                    sheet_pos: pos.to_sheet_pos(self.id),
                });
        }
    }

    /// Resize charts if columns in the chart range are deleted
    pub(crate) fn delete_chart_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        columns: &[i64],
    ) {
        let sheet_id = self.id;

        let all_pos_intersecting_columns =
            self.data_tables.get_pos_in_columns_sorted(columns, false);
        for (_, pos) in all_pos_intersecting_columns.into_iter().rev() {
            if let Ok((_, dirty_rects)) = self.modify_data_table_at(&pos, |dt| {
                if !dt.has_spill() && dt.is_html_or_image() {
                    let output_rect = dt.output_rect(pos, false);
                    let count = columns
                        .iter()
                        .filter(|col| **col >= output_rect.min.x && **col <= output_rect.max.x)
                        .count();
                    if count > 0
                        && let Some((width, height)) = dt.chart_output
                    {
                        let min = (width - count as u32).max(1);
                        if min != width {
                            dt.chart_output = Some((min, height));
                            transaction.add_from_code_run(
                                sheet_id,
                                pos,
                                dt.is_image(),
                                dt.is_html(),
                            );
                        }
                    }
                }

                Ok(())
            }) {
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
            }
        }
    }

    /// Moves data tables to the left if they are before the deleted columns.
    pub(crate) fn move_tables_leftwards(
        &mut self,
        transaction: &mut PendingTransaction,
        columns: &[i64],
    ) {
        let mut dt_to_shift_left = Vec::new();

        let min_column = columns.iter().min().unwrap_or(&1);
        for (_, pos) in self
            .data_tables
            .get_pos_after_column_sorted(*min_column, false)
        {
            if let Some(dt) = self.data_table_at(&pos) {
                let mut output_rect = dt.output_rect(pos, false);

                // check how many deleted columns are before the table
                let mut shift_table = 0;
                for col in columns.iter() {
                    if *col < output_rect.min.x {
                        shift_table += 1;
                    }
                }

                if shift_table > 0 {
                    transaction
                        .add_dirty_hashes_from_sheet_rect(output_rect.to_sheet_rect(self.id));
                    transaction.add_from_code_run(self.id, pos, dt.is_image(), dt.is_html());

                    output_rect.translate_in_place(-shift_table, 0);
                    transaction
                        .add_dirty_hashes_from_sheet_rect(output_rect.to_sheet_rect(self.id));
                    transaction.add_from_code_run(
                        self.id,
                        pos.translate(-shift_table, 0, 1, 1),
                        dt.is_image(),
                        dt.is_html(),
                    );

                    dt_to_shift_left.push((pos, shift_table));
                }
            }
        }

        dt_to_shift_left.sort_by(|(a, _), (b, _)| a.x.cmp(&b.x));
        for (pos, shift_table) in dt_to_shift_left {
            let Some((index, _, old_dt, dirty_rects)) = self.data_table_shift_remove_full(&pos)
            else {
                dbgjs!(format!(
                    "Error in check_delete_tables_columns: cannot shift left data table\n{:?}",
                    pos
                ));
                continue;
            };
            transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);

            let new_pos = pos.translate(-shift_table, 0, 1, 1);

            let dirty_rects = self.data_table_insert_before(index, &new_pos, old_dt).2;
            transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        assert_cell_value_row, assert_data_table_sort_dirty, assert_display_cell_value,
        assert_table_count,
        controller::GridController,
        first_sheet_id,
        grid::{
            SheetId,
            sort::{DataTableSort, SortDirection},
        },
        test_create_code_table,
        test_util::{
            assert_data_table_size, test_create_data_table, test_create_data_table_with_values,
            test_create_js_chart,
        },
        wasm_bindings::js::{clear_js_calls, expect_js_call_count},
    };

    #[test]
    fn test_delete_table_columns_outside_table_range() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 3);

        gc.delete_columns(sheet_id, vec![4, 5], None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 3, false);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 3, false);
    }

    #[test]
    fn test_delete_tables_columns_outside_table_range() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 2);
        test_create_data_table(&mut gc, sheet_id, pos![B10], 3, 2);

        // Delete columns outside data table range
        gc.delete_columns(sheet_id, vec![5, 6], None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 2, false);
        assert_data_table_size(&gc, sheet_id, pos![B10], 3, 2, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 2, false);
        assert_data_table_size(&gc, sheet_id, pos![B10], 3, 2, false);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 2, false);
        assert_data_table_size(&gc, sheet_id, pos![B10], 3, 2, false);
    }

    #[test]
    fn test_delete_tables_columns_middle_column() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 3, 2);

        // Delete column B
        gc.delete_columns(sheet_id, vec![2], None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 2, false);
        assert_table_count(&gc, sheet_id, 1);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 2, false);
        assert_table_count(&gc, sheet_id, 1);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 2, false);
        assert_table_count(&gc, sheet_id, 1);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 2, false);
        assert_table_count(&gc, sheet_id, 1);
    }

    #[test]
    fn test_delete_columns_anchor_code() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table(&mut gc, sheet_id, pos![A1], 3, 1);
        assert_table_count(&gc, sheet_id, 1);

        // Delete anchor column (first column)
        gc.delete_columns(sheet_id, vec![1], None);
        assert_table_count(&gc, sheet_id, 0);
        assert_display_cell_value(&gc, sheet_id, 1, 1, "");

        clear_js_calls();
        gc.undo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 1, false);
        expect_js_call_count("jsUpdateCodeCells", 1, true);

        gc.redo(None);
        assert_table_count(&gc, sheet_id, 0);
        assert_display_cell_value(&gc, sheet_id, 1, 1, "");

        gc.undo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 1, false);
    }

    #[test]
    fn test_delete_columns_code() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_code_table(&mut gc, sheet_id, pos![B1], 3, 1);

        // Readonly table should not be modified
        gc.delete_columns(sheet_id, vec![3], None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![B1], 3, 1, false);

        // everything should be the same after the undo
        gc.undo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![B1], 3, 1, false);

        // delete the column before the code table
        gc.delete_columns(sheet_id, vec![1], None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 1, false);

        gc.undo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![B1], 3, 1, false);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 1, vec!["0", "1", "2"]);

        gc.redo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 1, false);

        gc.undo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![B1], 3, 1, false);
        assert_cell_value_row(&gc, sheet_id, 2, 4, 1, vec!["0", "1", "2"]);
    }

    #[test]
    fn test_delete_first_column_with_entire_data_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![A1], 1, 3);

        // Delete first column
        gc.delete_columns(sheet_id, vec![1], None);

        assert_table_count(&gc, sheet_id, 0);

        gc.undo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 1, 3, false);

        gc.redo(None);
        assert_table_count(&gc, sheet_id, 0);

        gc.undo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 1, 3, false);
    }

    #[test]
    fn test_delete_first_column_and_shift_data_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);

        // Delete first column (which contains the data table anchor cell)
        gc.delete_columns(sheet_id, vec![1], None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 1, 2, false);

        gc.undo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 2, false);

        gc.redo(None);
        assert_table_count(&gc, sheet_id, 1);
        assert_data_table_size(&gc, sheet_id, pos![A1], 1, 2, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 2, false);
        assert_table_count(&gc, sheet_id, 1);
    }

    #[test]
    fn test_delete_multiple_columns_including_anchor_column() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![A1], 5, 1);

        // Delete columns including anchor column
        gc.delete_columns(SheetId::TEST, vec![1, 3], None);

        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 1, false);
        assert_table_count(&gc, sheet_id, 1);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 5, 1, false);
        assert_table_count(&gc, sheet_id, 1);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 1, false);
        assert_table_count(&gc, sheet_id, 1);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 5, 1, false);
        assert_table_count(&gc, sheet_id, 1);
    }

    #[test]
    fn test_delete_multiple_tables_with_overlapping_columns() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 1);
        test_create_data_table(&mut gc, sheet_id, pos![B10], 3, 1);

        // Delete columns that overlap with both tables
        gc.delete_columns(sheet_id, vec![2, 3], None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 1, 1, false);
        assert_data_table_size(&gc, sheet_id, pos![B10], 1, 1, false);
        assert_table_count(&gc, sheet_id, 2);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 1, false);
        assert_data_table_size(&gc, sheet_id, pos![B10], 3, 1, false);
        assert_table_count(&gc, sheet_id, 2);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 1, 1, false);
        assert_data_table_size(&gc, sheet_id, pos![B10], 1, 1, false);
        assert_table_count(&gc, sheet_id, 2);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 3, 1, false);
        assert_data_table_size(&gc, sheet_id, pos![B10], 3, 1, false);
        assert_table_count(&gc, sheet_id, 2);
    }

    #[test]
    fn test_delete_entire_table() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 3, 2);

        // Delete all columns that contain the table
        gc.delete_columns(SheetId::TEST, vec![1, 2, 3], None);
        assert_table_count(&gc, sheet_id, 0);

        gc.undo(None);
        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 3, 2, false);
        assert_table_count(&gc, sheet_id, 1);

        gc.redo(None);
        assert_table_count(&gc, sheet_id, 0);

        gc.undo(None);
        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 3, 2, false);
        assert_table_count(&gc, sheet_id, 1);
    }

    #[test]
    fn test_delete_multiple_entire_tables() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        // Create two tables
        test_create_data_table_with_values(&mut gc, sheet_id, pos![A1], 2, 1, &["A", "B"]);
        test_create_data_table_with_values(&mut gc, sheet_id, pos![D1], 2, 1, &["C", "D"]);

        // Delete all columns containing both tables
        gc.delete_columns(sheet_id, vec![1, 2, 4, 5], None);
        assert_table_count(&gc, sheet_id, 0);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 1, false);
        assert_data_table_size(&gc, sheet_id, pos![D1], 2, 1, false);
        assert_table_count(&gc, sheet_id, 2);

        gc.redo(None);
        assert_table_count(&gc, sheet_id, 0);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![A1], 2, 1, false);
        assert_data_table_size(&gc, sheet_id, pos![D1], 2, 1, false);
        assert_table_count(&gc, sheet_id, 2);
    }

    #[test]
    fn test_delete_entire_table_with_extra_columns() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table_with_values(&mut gc, sheet_id, pos![B1], 2, 1, &["A", "B"]);

        // Delete more columns than the table occupies
        gc.delete_columns(sheet_id, vec![1, 2, 3, 4], None);
        assert_table_count(&gc, sheet_id, 0);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B1], 2, 1, false);
        assert_table_count(&gc, sheet_id, 1);

        gc.redo(None);
        assert_table_count(&gc, sheet_id, 0);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B1], 2, 1, false);
        assert_table_count(&gc, sheet_id, 1);
    }

    #[test]
    fn test_delete_tables_columns_sorted() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![A1], 3, 2);

        // sort the first column
        gc.sort_data_table(
            pos![sheet_id!A1],
            Some(vec![DataTableSort {
                column_index: 0,
                direction: SortDirection::Ascending,
            }]),
            None,
        );
        assert_data_table_sort_dirty(&gc, sheet_id, pos![A1], false);

        // Delete an unsorted column (column 2)
        gc.delete_columns(sheet_id, vec![2], None);
        assert_data_table_sort_dirty(&gc, sheet_id, pos![A1], false);

        // Delete the sorted column (column 1)
        gc.delete_columns(sheet_id, vec![1], None);
        assert_data_table_sort_dirty(&gc, sheet_id, pos![A1], true);

        gc.undo(None);
        assert_data_table_sort_dirty(&gc, sheet_id, pos![A1], false);

        gc.redo(None);
        assert_data_table_sort_dirty(&gc, sheet_id, pos![A1], true);

        gc.undo(None);
        assert_data_table_sort_dirty(&gc, sheet_id, pos![A1], false);
    }

    #[test]
    fn test_delete_columns_with_chart() {
        let mut gc = GridController::test();
        let sheet_id = SheetId::TEST;

        // Create a chart that's 4x4 cells
        test_create_js_chart(&mut gc, sheet_id, pos![B2], 4, 4);

        // Delete a column that intersects with the chart
        gc.delete_columns(sheet_id, vec![3], None);

        // Verify the chart was resized
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 4, false);

        // Test undo
        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 4, false);
    }

    #[test]
    fn test_delete_data_table_first_column_and_left_of_anchor() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![B2], 3, 3);

        gc.delete_columns(sheet_id, vec![1, 2], None);
        assert_data_table_size(&gc, sheet_id, pos![A2], 2, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![A2], 2, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 3, 3, false);
    }

    #[test]
    fn test_delete_data_table_first_few_columns() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);
        test_create_data_table(&mut gc, sheet_id, pos![B2], 5, 3);

        gc.delete_columns(sheet_id, vec![2, 3, 4], None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 5, 3, false);

        gc.redo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 2, 3, false);

        gc.undo(None);
        assert_data_table_size(&gc, sheet_id, pos![B2], 5, 3, false);
    }
}
