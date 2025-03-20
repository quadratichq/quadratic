use crate::{
    // Pos,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        // operations::operation::Operation,
    },
    grid::Sheet,
};

impl Sheet {
    /// Adjust any data tables that partially overlap the deleted rows. The
    /// data table will automatically be deleted elsewhere if it is completely
    /// inside the deletion range.
    ///
    /// This fn deletes individual rows within a
    /// data table and moves the anchor if the anchor row (ie, the row
    /// with the CellValue::Import is deleted.
    ///
    /// This fn expects rows to be sorted (ascending) and deduplicated.
    pub(crate) fn check_delete_tables_rows(
        &mut self,
        _transaction: &mut PendingTransaction,
        _rows: &Vec<i64>,
    ) {
        // let mut reverse_operations = Vec::new();
        // let mut set_dirty_hash_rects = Vec::new();
        // let mut set_dirty_code_cells = Vec::new();
        // let mut dt_to_add = Vec::new();
        // let mut dt_to_remove = Vec::new();

        // self.data_tables
        //     .iter_mut()
        //     .enumerate()
        //     .for_each(|(index, (pos, table))| {
        //         // we can only adjust non-readonly (ie, non-code-run) tables
        //         if table.readonly {
        //             return;
        //         }
        //         let output_rect = table.output_rect(*pos, false);

        //         // check if the table is outside the deletion range
        //         if rows[0] > output_rect.max.y || rows[rows.len() - 1] < output_rect.min.y {
        //             return;
        //         }

        //         // check if the table is completely inside the deletion range (1)
        //         if !rows
        //             .iter()
        //             .all(|row| *row >= output_rect.min.y && *row <= output_rect.max.y)
        //         {
        //             return;
        //         }

        //         // create a new data table with the rows removed
        //         let mut new_dt = table.clone();
        //         for row in rows {
        //             // we use display the row index since that's how a user sees it
        //             let display_row = new_dt
        //                 .get_row_index_from_display_index((row - output_rect.min.y) as u32, true);
        //             if let Err(e) = new_dt.delete_row_sorted(display_row as usize) {
        //                 dbgjs!(format!("Error in check_delete_tables_rows: {:?}", e));
        //                 continue;
        //             }
        //         }

        //         // if the first row is inside the deletion range, then we need to
        //         // move the anchor cell to the first available row
        //         if rows.contains(&output_rect.min.y) {
        //             if let Some(change_row) =
        //                 (output_rect.min.y + 1..output_rect.max.y).find(|row| !rows.contains(row))
        //             {
        //                 let new_pos = Pos {
        //                     x: pos.x,
        //                     y: change_row,
        //                 };
        //                 dt_to_add.push((*pos, new_pos, new_dt));
        //                 dt_to_remove.push((*pos, index));

        //                 set_dirty_code_cells.push(*pos);
        //                 let mut new_output_rect = output_rect.clone();
        //                 set_dirty_hash_rects.push(output_rect);
        //                 new_output_rect.translate(0, change_row - output_rect.min.y);
        //                 set_dirty_hash_rects.push(new_output_rect);
        //                 set_dirty_code_cells.push(new_pos);
        //             } else {
        //                 // this should never happen because of the (1) check above
        //                 return;
        //             }
        //         } else {
        //             let old_dt = std::mem::replace(table, new_dt);
        //             reverse_operations.push(Operation::SetDataTable {
        //                 sheet_pos: pos.to_sheet_pos(self.id),
        //                 data_table: Some(old_dt),
        //                 index,
        //             });
        //             set_dirty_hash_rects.push(output_rect);
        //             set_dirty_code_cells.push(*pos);
        //         }
        //     });

        // for (pos, index) in dt_to_remove {
        //     let old_dt = self.data_tables.shift_remove(&pos);
        //     reverse_operations.push(Operation::SetDataTable {
        //         sheet_pos: pos.to_sheet_pos(self.id),
        //         data_table: old_dt,
        //         index,
        //     });
        // }

        // for (pos, new_pos, new_dt) in dt_to_add {
        //     let (index, old_dt) = self.data_tables.insert_sorted(new_pos, new_dt);
        //     reverse_operations.push(Operation::SetDataTable {
        //         sheet_pos: pos.to_sheet_pos(self.id),
        //         data_table: old_dt, // this should always be None
        //         index,
        //     });
        // }

        // for rect in set_dirty_hash_rects {
        //     transaction.add_dirty_hashes_from_sheet_rect(rect.to_sheet_rect(self.id));
        //     let sheet_rows = self.get_rows_with_wrap_in_rect(&rect, true);
        //     let table_rows = self.formats.get_rows_with_wrap_in_rect(&rect);

        //     if !sheet_rows.is_empty() || !table_rows.is_empty() {
        //         let resize_rows = transaction.resize_rows.entry(self.id).or_default();
        //         resize_rows.extend(sheet_rows);
        //         resize_rows.extend(table_rows);
        //     }
        // }
        // for pos in set_dirty_code_cells {
        //     transaction.add_from_code_run(self.id, pos, false, false);
        // }

        // transaction.reverse_operations.extend(reverse_operations);
    }

    pub fn delete_rows(&mut self, transaction: &mut PendingTransaction, rows: Vec<i64>) {
        if rows.is_empty() {
            return;
        }

        let mut rows = rows.clone();
        rows.sort_unstable();
        rows.dedup();

        // todo: check delete rows overlapping data table UI (in which case, return)

        self.check_delete_tables_rows(transaction, &rows);

        rows.reverse();

        for row in rows {
            self.delete_row(transaction, row);
        }
        self.recalculate_bounds();
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::GridController,
        grid::SheetId,
        test_util::{
            assert_data_table_size, test_create_code_table_first_sheet,
            test_create_data_table_first_sheet,
        },
    };

    use super::*;

    #[test]
    fn test_check_delete_tables_rows_outside_table_range() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        test_create_data_table_first_sheet(&mut gc, pos![A1], 1, 3, &["A", "B", "C"]);

        // Delete rows outside data table range
        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);
        sheet.check_delete_tables_rows(&mut transaction, &vec![5, 6]);
        assert!(
            sheet.data_tables.contains_key(&pos!(A1)),
            "Data table should remain unchanged when deleting rows outside its range"
        );
    }

    #[test]
    fn test_check_delete_tables_rows_middle_row() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        test_create_data_table_first_sheet(&mut gc, pos![A1], 1, 3, &["A", "B", "C"]);

        // Delete middle row
        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);
        sheet.check_delete_tables_rows(&mut transaction, &vec![2]);

        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 3, 2, false);
    }

    #[test]
    fn test_check_delete_tables_rows_anchor_row() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        test_create_data_table_first_sheet(&mut gc, pos![A1], 1, 3, &["A", "B", "C"]);

        // Delete anchor row (first row)
        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);

        sheet.check_delete_tables_rows(&mut transaction, &vec![1]);
        assert!(
            !sheet.data_tables.contains_key(&pos!(A1)),
            "Original data table should be removed"
        );
        assert!(
            sheet.data_tables.contains_key(&pos!(A2)),
            "Data table should be moved to new position"
        );
    }

    #[test]
    fn test_check_delete_tables_rows_readonly_table() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        test_create_code_table_first_sheet(&mut gc, pos![A1], 1, 3, vec!["A", "B", "C"]);

        // Test 4: Readonly table should not be modified
        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);
        sheet.check_delete_tables_rows(&mut transaction, &vec![4]);

        if let Some(table) = sheet.data_tables.get(&pos!(A4)) {
            assert!(table.readonly, "Readonly table should remain unchanged");
        }
    }
}
