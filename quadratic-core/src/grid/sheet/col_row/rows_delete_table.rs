use crate::{
    SheetRect,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
};

impl Sheet {
    /// Deletes tables that have all rows in the deletion range.
    fn delete_tables_with_all_rows(&mut self, transaction: &mut PendingTransaction, rows: &[i64]) {
        let tables_to_delete = self
            .data_tables
            .iter()
            .enumerate()
            .filter_map(|(index, (pos, dt))| {
                let rect = dt.output_rect(*pos, false);
                if rect.y_range().all(|row| rows.contains(&row)) {
                    Some((*pos, index))
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();

        for (pos, index) in tables_to_delete {
            let old_dt = self.data_tables.shift_remove(&pos);
            transaction.add_code_cell(self.id, pos);
            transaction
                .reverse_operations
                .push(Operation::SetDataTable {
                    sheet_pos: pos.to_sheet_pos(self.id),
                    data_table: old_dt,
                    index,
                });
        }
    }

    fn ensure_no_table_ui(&self, rows: &[i64]) -> bool {
        for (pos, dt) in self.data_tables.iter() {
            let rect = dt.output_rect(*pos, false);
            let ui_rows = dt.ui_rows(*pos);
            if rows.iter().any(|row| ui_rows.contains(row)) {
                // ensure that the entire table is not deleted (we can delete ui
                // if the entire table is deleted)
                if !rect.y_range().all(|row| rows.contains(&row)) {
                    return true;
                }
            }
        }
        false
    }

    fn delete_table_rows(&mut self, transaction: &mut PendingTransaction, rows: &[i64]) {
        let mut adjust_chart_size = vec![];
        let table_rows_to_delete = self
            .data_tables
            .iter()
            .filter_map(|(pos, dt)| {
                let rect = dt.output_rect(*pos, false);
                if dt.readonly && !dt.is_html_or_image() {
                    return None;
                }
                if dt.is_html_or_image() {
                    let count = rows
                        .iter()
                        .filter(|row| **row >= rect.min.y && **row <= rect.max.y)
                        .count();
                    if count > 0 {
                        if let Some((width, height)) = dt.chart_output {
                            // charts cannot be smaller than 2 height (UI + at least one cell for display)
                            let min = (width - count as u32).max(1);
                            if min != height {
                                adjust_chart_size.push((*pos, width, min));
                            }
                        }
                    }
                    None
                } else {
                    let rows_to_delete = rows
                        .iter()
                        .filter(|row| **row >= rect.min.y && **row <= rect.max.y)
                        .collect::<Vec<_>>();
                    if rows_to_delete.is_empty() {
                        None
                    } else {
                        Some((*pos, rows_to_delete))
                    }
                }
            })
            .collect::<Vec<_>>();

        for (pos, width, height) in adjust_chart_size {
            if let Some(dt) = self.data_tables.get_mut(&pos) {
                dt.chart_output = Some((width, height));
                transaction
                    .reverse_operations
                    .push(Operation::SetChartCellSize {
                        sheet_pos: pos.to_sheet_pos(self.id),
                        w: width,
                        h: height,
                    });
            }
        }

        for (pos, rows_to_delete) in table_rows_to_delete {
            transaction.add_code_cell(self.id, pos);
            if let Some(dt) = self.data_tables.get_mut(&pos) {
                let rows = rows_to_delete
                    .iter()
                    .map(|row| {
                        let row = (*row - pos.y) as u32;
                        let Ok((_actual_index, reverse_row)) = dt.delete_row_sorted(row as usize)
                        else {
                            // there was an error deleting the row, so we skip it
                            return (row, None);
                        };
                        let w = dt.width() as u32;
                        transaction.add_dirty_hashes_from_sheet_rect(SheetRect::new(
                            pos.x,
                            pos.y + row as i64,
                            pos.x + w as i64,
                            pos.y + row as i64,
                            self.id,
                        ));
                        (row, reverse_row)
                    })
                    .collect::<Vec<_>>();
                transaction
                    .reverse_operations
                    .push(Operation::InsertDataTableRows {
                        sheet_pos: pos.to_sheet_pos(self.id),
                        rows,
                        swallow: false,
                        select_table: false,
                    });
            }
        }
    }

    /// Deletes rows. Returns false if the rows contain table UI and the
    /// operation was aborted.
    #[allow(clippy::result_unit_err)]
    pub fn delete_rows(
        &mut self,
        transaction: &mut PendingTransaction,
        rows: Vec<i64>,
    ) -> Result<(), ()> {
        if rows.is_empty() {
            return Ok(());
        }

        let mut rows = rows.clone();
        rows.sort_unstable();
        rows.dedup();
        rows.reverse();

        if self.ensure_no_table_ui(&rows) {
            if transaction.is_user_undo_redo() && cfg!(target_family = "wasm") {
                crate::wasm_bindings::js::jsClientMessage(
                    "delete_rows_error".to_string(),
                    "warning".to_string(),
                );
            }
            return Err(());
        }

        self.delete_tables_with_all_rows(transaction, &rows);

        self.delete_table_rows(transaction, &rows);

        for row in rows {
            self.delete_row(transaction, row);
        }
        self.recalculate_bounds();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
        },
        test_util::{
            assert_data_table_size, first_sheet_id, test_create_data_table, test_create_js_chart,
        },
    };

    #[test]
    fn test_delete_multiple_rows() {
        let mut gc = GridController::test();
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
        assert!(sheet.delete_rows(&mut transaction, vec![2, 3]).is_ok());

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
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table that will have UI elements
        test_create_data_table(
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
        assert!(sheet.delete_rows(&mut transaction, vec![1]).is_err());
    }

    #[test]
    fn test_delete_rows_empty_vec() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Empty vector should return Ok
        assert!(sheet.delete_rows(&mut transaction, vec![]).is_ok());
    }

    #[test]
    fn test_delete_rows_dedup_and_sort() {
        let mut gc = GridController::test();
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
                .delete_rows(&mut transaction, vec![2, 1, 2, 3])
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
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table
        test_create_data_table(
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
                .delete_rows(&mut transaction, vec![1, 2, 3, 4, 5])
                .is_ok()
        );

        // Verify the table was removed
        assert!(sheet.data_tables.is_empty());
    }

    #[test]
    fn test_delete_partial_table_rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table
        test_create_data_table(
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
        assert!(sheet.delete_rows(&mut transaction, vec![3, 4]).is_ok());

        // Verify the table still exists but has fewer rows
        assert_eq!(sheet.data_tables.len(), 1);
        let (_, dt) = sheet.data_tables.iter().next().unwrap();
        assert_eq!(dt.height(true), 2); // Should have 2 rows left
    }

    #[test]
    fn test_delete_rows_with_readonly_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create a data table and make it readonly
        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2, &["A", "B", "C", "D"]);

        let sheet = gc.sheet_mut(sheet_id);
        if let Some((_, dt)) = sheet.data_tables.iter_mut().next() {
            dt.readonly = true;
        }

        let mut transaction = PendingTransaction::default();

        // Try to delete rows containing the readonly table
        assert!(sheet.delete_rows(&mut transaction, vec![1, 2]).is_err());

        // Verify the readonly table wasn't modified
        assert_eq!(sheet.data_tables.len(), 1);
        let (_, dt) = sheet.data_tables.iter().next().unwrap();
        assert_eq!(dt.height(true), 2); // Should still have original height
    }

    #[test]
    fn test_delete_rows_intersecting_multiple_tables() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Create two data tables that will be affected by the row deletion
        test_create_data_table(
            &mut gc,
            sheet_id,
            pos![A1],
            2,
            3,
            &["A", "B", "C", "D", "E", "F"],
        );

        test_create_data_table(
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
        assert!(sheet.delete_rows(&mut transaction, vec![4]).is_ok());

        // Verify both tables still exist but have fewer rows
        assert_eq!(sheet.data_tables.len(), 2);

        for (_, dt) in sheet.data_tables.iter() {
            assert_eq!(dt.height(true), 2); // Both tables should have 2 rows left
        }
    }

    #[test]
    fn test_delete_rows_with_chart() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_js_chart(&mut gc, sheet_id, pos![B2], 4, 4);

        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Delete rows that contain the chart
        assert!(sheet.delete_rows(&mut transaction, vec![3, 4]).is_ok());

        // Verify the chart was resized
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 2, false);
    }

    #[test]
    fn test_delete_rows_with_chart_too_small() {
        let mut gc = GridController::test();
        let sheet_id = first_sheet_id(&gc);

        test_create_js_chart(&mut gc, sheet_id, pos![B2], 4, 4);

        let sheet = gc.sheet_mut(sheet_id);
        let mut transaction = PendingTransaction::default();

        // Delete all rows (except UI) that contain the chart
        assert!(
            sheet
                .delete_rows(&mut transaction, vec![3, 4, 5, 6])
                .is_ok()
        );

        // expect one row to survive since you need a minimum of 2 rows for a chart
        assert_data_table_size(&gc, sheet_id, pos![B2], 4, 1, false);
    }
}
