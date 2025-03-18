use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
    Pos,
};

impl Sheet {
    /// Adjust any data tables that partially overlap the deleted columns. The
    /// data table will automatically be deleted elsewhere if it is completely
    /// inside the deletion range.
    ///
    /// This fn deletes individual columns within a
    /// data table and moves the anchor if the anchor column (ie, the column
    /// with the CellValue::Import is deleted.
    ///
    /// This fn expects columns to be sorted (ascending) and deduplicated.
    pub(crate) fn check_delete_tables_columns(
        &mut self,
        transaction: &mut PendingTransaction,
        columns: &Vec<i64>,
    ) {
        let mut reverse_operations = Vec::new();
        let mut set_dirty_hash_rects = Vec::new();
        let mut set_dirty_code_cells = Vec::new();
        let mut dt_to_add = Vec::new();
        let mut dt_to_remove = Vec::new();

        self.data_tables
            .iter_mut()
            .enumerate()
            .for_each(|(index, (pos, table))| {
                // we can only adjust non-readonly (ie, non-code-run) tables
                if table.readonly {
                    return;
                }
                let output_rect = table.output_rect(*pos, false);

                // check if the table is outside the deletion range
                if columns[0] > output_rect.max.x || columns[columns.len() - 1] < output_rect.min.x
                {
                    return;
                }

                // check if the table is completely inside the deletion range (1)
                if !columns
                    .iter()
                    .all(|col| *col >= output_rect.min.x && *col <= output_rect.max.x)
                {
                    return;
                }

                // create a new data table with the columns removed
                let mut new_dt = table.clone();
                for column in columns {
                    // we use display the column index since that's how a user sees it
                    let display_column = new_dt.get_column_index_from_display_index(
                        (column - output_rect.min.x) as u32,
                        true,
                    );
                    if let Err(e) = new_dt.delete_column_sorted(display_column as usize) {
                        dbgjs!(format!("Error in check_delete_tables_columns: {:?}", e));
                        continue;
                    }
                }

                // if the first column is inside the deletion range, then we need to
                // move the anchor cell to the first available column (display
                // column doesn't matter here since this is absolute columns
                // compared to the grid)
                if columns.contains(&output_rect.min.x) {
                    if let Some(change_column) =
                        columns.iter().find(|col| **col > output_rect.min.x)
                    {
                        let new_pos = Pos {
                            x: *change_column + output_rect.min.x,
                            y: pos.y,
                        };
                        dt_to_add.push((*pos, new_pos, new_dt));
                        dt_to_remove.push((*pos, index));

                        set_dirty_code_cells.push(*pos);
                        let mut new_output_rect = output_rect.clone();
                        set_dirty_hash_rects.push(output_rect);
                        new_output_rect.translate(*change_column, 0);
                        set_dirty_hash_rects.push(new_output_rect);
                        set_dirty_code_cells.push(new_pos);
                    } else {
                        // this should never happen because of the (1) check above
                        return;
                    }
                } else {
                    let old_dt = std::mem::replace(table, new_dt);
                    reverse_operations.push(Operation::SetDataTable {
                        sheet_pos: pos.to_sheet_pos(self.id),
                        data_table: Some(old_dt),
                        index,
                    });
                    set_dirty_hash_rects.push(output_rect);
                    set_dirty_code_cells.push(*pos);
                }
            });

        for (pos, index) in dt_to_remove {
            let old_dt = self.data_tables.shift_remove(&pos);
            reverse_operations.push(Operation::SetDataTable {
                sheet_pos: pos.to_sheet_pos(self.id),
                data_table: old_dt,
                index,
            });
        }

        for (pos, new_pos, new_dt) in dt_to_add {
            let (index, old_dt) = self.data_tables.insert_sorted(new_pos, new_dt);
            reverse_operations.push(Operation::SetDataTable {
                sheet_pos: pos.to_sheet_pos(self.id),
                data_table: old_dt, // this should always be None
                index,
            });
        }

        for rect in set_dirty_hash_rects {
            transaction.add_dirty_hashes_from_sheet_rect(rect.to_sheet_rect(self.id));
            let sheet_rows = self.get_rows_with_wrap_in_rect(&rect, true);

            let table_rows = self.formats.get_rows_with_wrap_in_rect(&rect);

            if !sheet_rows.is_empty() || !table_rows.is_empty() {
                let resize_rows = transaction.resize_rows.entry(self.id).or_default();
                resize_rows.extend(sheet_rows);
                resize_rows.extend(table_rows);
            }
        }
        for pos in set_dirty_code_cells {
            transaction.add_from_code_run(self.id, pos, false, false);
        }

        transaction.reverse_operations.extend(reverse_operations);
    }

    pub fn delete_columns(&mut self, transaction: &mut PendingTransaction, columns: Vec<i64>) {
        if columns.is_empty() {
            return;
        }

        let mut columns = columns.clone();
        columns.sort_unstable();
        columns.dedup();

        self.check_delete_tables_columns(transaction, &columns);

        columns.reverse();

        for column in columns {
            self.delete_column(transaction, column);
        }
        self.recalculate_bounds();
    }

    pub fn delete_rows(&mut self, transaction: &mut PendingTransaction, rows: Vec<i64>) {
        let mut rows = rows.clone();
        rows.sort_unstable();
        rows.dedup();
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
        test_util::{assert_data_table_size, test_create_data_table_first_sheet},
    };

    use super::*;

    #[test]
    fn test_check_delete_tables_columns() {
        let mut gc = GridController::test();

        // dummy transaction
        let mut transaction = PendingTransaction::default();

        // Create a simple data table
        test_create_data_table_first_sheet(&mut gc, pos![A1], 3, 1, &["A", "B", "C"]);

        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);

        // Test 1: Columns outside data table range
        sheet.check_delete_tables_columns(&mut transaction, &vec![5, 6]);
        assert!(
            sheet.data_tables.contains_key(&pos!(A1)),
            "Data table should remain unchanged when deleting columns outside its range"
        );

        // Test 2: Delete middle column
        let mut transaction = PendingTransaction::default();
        sheet.check_delete_tables_columns(&mut transaction, &vec![2]);

        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 2, 1);

        // // Test 3: Delete anchor column (first column)
        // let mut transaction = PendingTransaction::default();
        // sheet.check_delete_tables_columns(&mut transaction, &vec![1]);
        // assert!(
        //     !sheet.data_tables.contains_key(&pos!(A1)),
        //     "Original data table should be removed"
        // );
        // assert!(
        //     sheet.data_tables.values().next().is_some(),
        //     "Data table should be moved to new position"
        // );

        // // Test 4: Readonly table should not be modified
        // let mut readonly_table = DataTable::default();
        // readonly_table.readonly = true;
        // sheet.data_tables.insert(pos!(D1), readonly_table);
        // let mut transaction = PendingTransaction::default();
        // sheet.check_delete_tables_columns(&mut transaction, &vec![4]);
        // if let Some(table) = sheet.data_tables.get(&pos!(D1)) {
        //     assert!(table.readonly, "Readonly table should remain unchanged");
        // }
    }
}
