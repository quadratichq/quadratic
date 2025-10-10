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
    pub(crate) fn ensure_no_table_ui(&self, rows: &[i64]) -> bool {
        for &row in rows {
            let row_rect = Rect::new(1, row, i64::MAX, row);
            for (_, pos, dt) in self.data_tables.get_in_rect(row_rect, false) {
                let rect = dt.output_rect(pos, false);
                let ui_rows = dt.ui_rows(pos);
                if rows.iter().any(|row| ui_rows.contains(row)) {
                    // ensure that the entire table is not deleted (we can delete ui
                    // if the entire table is deleted)
                    if !rect.y_range().all(|row| rows.contains(&row)) {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Deletes tables that have all rows in the deletion range.
    pub(crate) fn delete_tables_with_all_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        rows: &[i64],
    ) {
        let mut dt_to_delete = HashSet::new();

        for &row in rows {
            let row_rect = Rect::new(1, row, i64::MAX, row);
            for (_, pos, dt) in self.data_tables.get_in_rect(row_rect, false) {
                if dt_to_delete.contains(&pos) {
                    continue;
                }

                let output_rect = dt.output_rect(pos, false);
                if output_rect.y_range().all(|row| rows.contains(&row)) {
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
                        ignore_old_data_table: true,
                    });
            }
        }
    }

    pub(crate) fn delete_table_rows(&mut self, transaction: &mut PendingTransaction, rows: &[i64]) {
        let mut dt_to_update = vec![];

        let min_row = rows.iter().min().unwrap_or(&1);
        for (index, pos) in self.data_tables.get_pos_after_row_sorted(*min_row, false) {
            if let Some(dt) = self.data_table_at(&pos) {
                if (dt.is_code() && !dt.is_html_or_image()) || dt.has_spill() {
                    continue;
                }

                let output_rect = dt.output_rect(pos, false);
                let count = rows
                    .iter()
                    .filter(|row| **row >= output_rect.min.y && **row <= output_rect.max.y)
                    .count();
                if count > 0 {
                    dt_to_update.push((index, pos));
                }
            }
        }

        for (index, pos) in dt_to_update.into_iter() {
            let mut old_dt: Option<DataTable> = None;

            if let Ok((_, dirty_rects)) = self.modify_data_table_at(&pos, |dt| {
                let output_rect = dt.output_rect(pos, false);
                for row in rows {
                    if *row >= output_rect.min.y && *row <= output_rect.max.y {
                        // delete the row
                        if old_dt.is_none() {
                            old_dt = Some(dt.clone());
                        }

                        if let Ok(display_row_index) = usize::try_from(*row - output_rect.min.y) {
                            let _ = dt.delete_row_sorted(display_row_index);
                        }
                    }
                }

                Ok(())
            }) && let Some(old_dt) = old_dt
            {
                transaction.add_from_code_run(self.id, pos, old_dt.is_image(), old_dt.is_html());
                transaction.add_dirty_hashes_from_sheet_rect(
                    old_dt.output_rect(pos, false).to_sheet_rect(self.id),
                );
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
                transaction
                    .reverse_operations
                    .push(Operation::SetDataTable {
                        sheet_pos: pos.to_sheet_pos(self.id),
                        data_table: Some(old_dt),
                        index,
                        ignore_old_data_table: true,
                    });
                // the y + 1 is needed since the row will be inserted before the
                // old table, so its position will be shifted down before it gets here
                transaction
                    .reverse_operations
                    .push(Operation::DeleteDataTable {
                        sheet_pos: pos.to_sheet_pos(self.id),
                    });
            }
        }
    }

    /// Resize charts if rows in the chart range are deleted
    pub(crate) fn delete_chart_rows(&mut self, transaction: &mut PendingTransaction, rows: &[i64]) {
        let mut dt_to_update = vec![];

        let min_row = rows.iter().min().unwrap_or(&1);
        for (_, pos) in self.data_tables.get_pos_after_row_sorted(*min_row, false) {
            if let Some(dt) = self.data_table_at(&pos)
                && !dt.has_spill()
                && dt.is_html_or_image()
            {
                let output_rect = dt.output_rect(pos, false);
                let count = rows
                    .iter()
                    .filter(|row| **row >= output_rect.min.y && **row <= output_rect.max.y)
                    .count();
                if count > 0
                    && let Some((width, height)) = dt.chart_output
                {
                    let min = (height - count as u32).max(1);
                    if min != height {
                        dt_to_update.push((pos, Some((width, min))));
                    }
                }
            }
        }

        for (pos, chart_output) in dt_to_update.into_iter() {
            if let Ok((_, dirty_rects)) = self.modify_data_table_at(&pos, |dt| {
                dt.chart_output = chart_output;

                Ok(())
            }) {
                transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);
            }
        }
    }

    /// Moves data tables upwards if they are before the deleted columns.
    pub(crate) fn move_tables_upwards(
        &mut self,
        transaction: &mut PendingTransaction,
        rows: &[i64],
    ) {
        let mut dt_to_shift_up = Vec::new();

        let min_row = rows.iter().min().unwrap_or(&1);
        for (_, pos) in self.data_tables.get_pos_after_row_sorted(*min_row, false) {
            if let Some(dt) = self.data_table_at(&pos) {
                let mut output_rect = dt.output_rect(pos, false);

                // check how many deleted columns are before the table
                let mut shift_table = 0;
                for row in rows.iter() {
                    if *row < output_rect.min.y {
                        shift_table += 1;
                    }
                }

                if shift_table > 0 {
                    transaction
                        .add_dirty_hashes_from_sheet_rect(output_rect.to_sheet_rect(self.id));
                    transaction.add_from_code_run(self.id, pos, dt.is_image(), dt.is_html());

                    output_rect.translate_in_place(0, -shift_table);
                    transaction
                        .add_dirty_hashes_from_sheet_rect(output_rect.to_sheet_rect(self.id));
                    transaction.add_from_code_run(
                        self.id,
                        pos.translate(0, -shift_table, 1, 1),
                        dt.is_image(),
                        dt.is_html(),
                    );

                    dt_to_shift_up.push((pos, shift_table));
                }
            }
        }

        dt_to_shift_up.sort_by(|(a, _), (b, _)| a.y.cmp(&b.y));
        for (pos, shift_table) in dt_to_shift_up {
            let Some((index, _, old_dt, dirty_rects)) = self.data_table_shift_remove_full(&pos)
            else {
                dbgjs!(format!(
                    "Error in check_delete_tables_columns: cannot shift up data table\n{:?}",
                    pos
                ));
                continue;
            };
            transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);

            let new_pos = pos.translate(0, -shift_table, 1, 1);
            let dirty_rects = self.data_table_insert_before(index, new_pos, old_dt).3;
            transaction.add_dirty_hashes_from_dirty_code_rects(self, dirty_rects);

            transaction
                .reverse_operations
                .push(Operation::MoveDataTable {
                    old_sheet_pos: new_pos.to_sheet_pos(self.id),
                    new_sheet_pos: pos.to_sheet_pos(self.id),
                });
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue,
        a1::A1Context,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
        },
        test_create_code_table_with_values,
        test_util::{
            assert_data_table_size, first_sheet_id, test_create_data_table_with_values,
            test_create_js_chart,
        },
    };

    #[test]
    fn test_delete_multiple_rows() {
        let mut gc = GridController::test();
        let context = A1Context::default();

        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        // Set up test data
        sheet.test_set_values(
            1,
            1,
            4,
            4,
            vec![
                "A1", "B1", "C1", "D1", "A2", "B2", "C2", "D2", "A3", "B3", "C3", "D3", "A4", "B4",
                "C4", "D4",
            ],
        );

        let mut transaction = PendingTransaction::default();
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![2, 3],
                    false,
                    Default::default(),
                    &context
                )
                .is_ok()
        );

        // Verify rows 2 and 3 were deleted
        assert_eq!(
            sheet.cell_value(pos![A1]),
            Some(CellValue::Text("A1".to_string()))
        );
        assert_eq!(
            sheet.cell_value(pos![A2]),
            Some(CellValue::Text("A4".to_string()))
        );
    }

    #[test]
    fn test_delete_rows_with_table_ui() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table that will have UI elements
        test_create_data_table_with_values(
            &mut gc,
            sheet_id,
            pos![A1],
            3,
            3,
            &["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        );

        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Attempt to delete rows that contain table UI
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![1],
                    false,
                    Default::default(),
                    &context
                )
                .is_err()
        );
    }

    #[test]
    fn test_delete_rows_empty_vec() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Empty vector should return Ok
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![],
                    false,
                    Default::default(),
                    &context
                )
                .is_ok()
        );
    }

    #[test]
    fn test_delete_rows_dedup_and_sort() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);

        // Set up test data
        sheet.test_set_values(
            1,
            1,
            2,
            4,
            vec!["A1", "B1", "A2", "B2", "A3", "B3", "A4", "B4"],
        );

        let mut transaction = PendingTransaction::default();
        // Test with unsorted and duplicate rows
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![2, 1, 2, 3],
                    false,
                    Default::default(),
                    &context
                )
                .is_ok()
        );

        // Verify the correct rows were deleted (should handle duplicates and sorting internally)
        assert_eq!(
            sheet.cell_value(pos![A1]),
            Some(CellValue::Text("A4".to_string()))
        );
    }

    #[test]
    fn test_delete_entire_table() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table
        test_create_data_table_with_values(
            &mut gc,
            sheet_id,
            pos![A1],
            3,
            3,
            &["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        );

        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Delete all rows that contain the table
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![1, 2, 3, 4, 5],
                    false,
                    Default::default(),
                    &context
                )
                .is_ok()
        );

        // Verify the table was removed
        assert!(sheet.data_tables.is_empty());
    }

    #[test]
    fn test_delete_partial_table_rows() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table
        test_create_data_table_with_values(
            &mut gc,
            sheet_id,
            pos![A1],
            3,
            4,
            &["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
        );

        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Delete some rows from the middle of the table
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![3, 4],
                    false,
                    Default::default(),
                    &context
                )
                .is_ok()
        );

        // Verify the table still exists but has fewer rows
        assert_eq!(sheet.data_tables.len(), 1);
        let (_, dt) = sheet.data_tables.expensive_iter().next().unwrap();
        assert_eq!(dt.height(true), 2); // Should have 2 rows left
    }

    #[test]
    fn test_delete_rows_with_readonly_table() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table and make it readonly
        test_create_code_table_with_values(
            &mut gc,
            sheet_id,
            pos![A1],
            2,
            2,
            &["A", "B", "C", "D"],
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet
            .modify_data_table_at(&pos![A1], |dt| {
                dt.show_name = Some(true);
                dt.show_columns = Some(true);

                Ok(())
            })
            .unwrap();

        let mut transaction = PendingTransaction::default();

        // Try to delete rows containing the readonly table
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![1, 2],
                    false,
                    Default::default(),
                    &context
                )
                .is_err()
        );

        // Verify the readonly table wasn't modified
        assert_eq!(sheet.data_tables.len(), 1);
        let (_, dt) = sheet.data_tables.expensive_iter().next().unwrap();
        assert_eq!(dt.height(true), 2); // Should still have original height
    }

    #[test]
    fn test_delete_rows_intersecting_multiple_tables() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = gc.sheet_ids()[0];

        // Create two data tables that will be affected by the row deletion
        test_create_data_table_with_values(
            &mut gc,
            sheet_id,
            pos![A1],
            2,
            3,
            &["A", "B", "C", "D", "E", "F"],
        );

        test_create_data_table_with_values(
            &mut gc,
            sheet_id,
            pos![D2],
            2,
            3,
            &["G", "H", "I", "J", "K", "L"],
        );
        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Delete row that intersects both tables
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![4],
                    false,
                    Default::default(),
                    &context
                )
                .is_ok()
        );

        // Verify both tables still exist but have fewer rows
        assert_eq!(sheet.data_tables.len(), 2);

        for (_, dt) in sheet.data_tables.expensive_iter() {
            assert_eq!(dt.height(true), 2); // Both tables should have 2 rows left
        }
    }

    #[test]
    fn test_delete_rows_with_chart() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = first_sheet_id(&gc);

        test_create_js_chart(&mut gc, sheet_id, pos![B2], 4, 4);

        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Delete rows that contain the chart
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![3, 4],
                    false,
                    Default::default(),
                    &context
                )
                .is_ok()
        );

        // Verify the chart was resized
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 2, false);
    }

    #[test]
    fn test_delete_rows_with_chart_too_small() {
        let mut gc = GridController::test();
        let context = A1Context::default();
        let sheet_id = first_sheet_id(&gc);

        test_create_js_chart(&mut gc, sheet_id, pos![B2], 4, 4);

        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Delete all rows (except UI) that contain the chart
        assert!(
            sheet
                .delete_rows(
                    &mut transaction,
                    vec![3, 4, 5, 6],
                    false,
                    Default::default(),
                    &context
                )
                .is_ok()
        );

        // expect one row to survive since you need a minimum of 2 rows for a chart
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 1, false);
    }
}
