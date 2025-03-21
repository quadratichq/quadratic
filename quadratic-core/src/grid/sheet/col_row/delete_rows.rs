use crate::{
    controller::active_transactions::pending_transaction::PendingTransaction, grid::Sheet,
};

impl Sheet {
    fn delete_tables_with_all_rows(&mut self, transaction: &mut PendingTransaction, rows: &[i64]) {
        let tables_to_delete = self.data_tables.iter().filter_map(|(pos, dt)| {
            let rect = dt.output_rect(*pos, false);
            if rect.y_range().all(|row| rows.contains(&row)) {
                Some(*pos)
            } else {
                None
            }
        });
    }

    fn ensure_no_table_ui(&self, rows: &[i64]) -> bool {
        for (pos, dt) in self.data_tables.iter() {
            let ui_rows = dt.ui_rows(*pos);
            if rows.iter().any(|row| ui_rows.contains(row)) {
                return true;
            }
        }
        false
    }

    fn delete_table_rows(&mut self, transaction: &mut PendingTransaction, rows: &Vec<i64>) {
        let table_rows_to_delete = self.data_tables.iter().filter_map(|(pos, dt)| {
            let rect = dt.output_rect(*pos, false);
            let rows_to_delete = rows
                .iter()
                .filter(|row| {
                    !dt.ui_rows(*pos).contains(row) && dt.output_rect(*pos, false).contains(*pos)
                })
                .collect::<Vec<_>>();
            if rows_to_delete.is_empty() {
                None
            } else {
                Some((*pos, rows_to_delete))
            }
        });
    }

    /// Deletes rows. Returns false if the rows contain table UI and the
    /// operation was aborted.
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

        self.delete_table_rows(transaction, &rows);

        for row in rows {
            self.delete_row(transaction, row);
        }
        self.recalculate_bounds();
        return Ok(());
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue,
        controller::{
            GridController, active_transactions::pending_transaction::PendingTransaction,
        },
        test_util::test_create_data_table,
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
}
