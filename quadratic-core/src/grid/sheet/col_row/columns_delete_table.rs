use crate::{
    Pos,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::Sheet,
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
        let mut dt_to_replace = Vec::new();
        let mut dt_to_delete = Vec::new();
        let mut adjust_chart_size = Vec::new();

        self.data_tables
            .iter()
            .enumerate()
            .for_each(|(index, (pos, table))| {
                let output_rect = table.output_rect(*pos, false);

                // we need to handle charts separately
                if table.is_html_or_image() {
                    let count = columns
                        .iter()
                        .filter(|col| **col >= output_rect.min.x && **col <= output_rect.max.x)
                        .count();
                    if count > 0 {
                        if let Some((width, height)) = table.chart_output {
                            let min = (width - count as u32).max(1);
                            if min != width {
                                adjust_chart_size.push((*pos, min, height));
                                transaction.add_from_code_run(
                                    self.id,
                                    *pos,
                                    table.is_image(),
                                    table.is_html(),
                                );
                            }
                        }
                    }
                    return;
                }
                // we can only adjust non-readonly (ie, non-code-run) tables
                if table.readonly {
                    return;
                }

                // check if the table is outside the deletion range
                if columns[0] > output_rect.max.x || columns[columns.len() - 1] < output_rect.min.x
                {
                    return;
                }

                // check if all columns in the table are included in the deletion range (*)
                let table_cols: Vec<i64> = (output_rect.min.x..=output_rect.max.x).collect();
                if table_cols.iter().all(|col| columns.contains(col)) {
                    set_dirty_code_cells.push(*pos);
                    dt_to_delete.push((*pos, index));
                    return;
                }

                // create a new data table with the columns removed
                let mut new_dt = table.clone();
                let mut deleted_count = 0; // Track number of columns already deleted

                for column in columns {
                    // Adjust the column index based on previously deleted columns
                    let adjusted_column = column - output_rect.min.x - deleted_count;
                    let column_index =
                        new_dt.get_column_index_from_display_index(adjusted_column as u32, true);
                    if new_dt.is_column_sorted(column_index as usize) {
                        new_dt.sort_dirty = true;
                    }

                    // add reverse ops for formats and borders, if necessary
                    // (note, formats and borders are 1-indexed)
                    if let Some(reverse_format_updates) =
                        new_dt.formats.copy_column(column_index as i64 + 1)
                    {
                        if reverse_format_updates.has_fills() {
                            transaction.add_fill_cells(self.id);
                        }
                        reverse_operations.push(Operation::DataTableFormats {
                            sheet_pos: pos.to_sheet_pos(self.id),
                            formats: reverse_format_updates,
                        });
                    }
                    if let Some(reverse_borders_updates) =
                        new_dt.borders.copy_column(column_index as i64 + 1)
                    {
                        reverse_operations.push(Operation::DataTableBorders {
                            sheet_pos: pos.to_sheet_pos(self.id),
                            borders: reverse_borders_updates,
                        });
                    }

                    if let Err(e) = new_dt.delete_column_sorted(column_index as usize) {
                        dbgjs!(format!(
                            "Error in check_delete_tables_columns: cannot delete column\n{:?}",
                            e
                        ));
                        continue;
                    }
                    deleted_count += 1;
                }

                // if the first column is inside the deletion range, then we need to
                // move the anchor cell to the first available column (display
                // column doesn't matter here since this is absolute columns
                // compared to the grid)
                if columns.contains(&output_rect.min.x) {
                    if let Some(change_column) = (output_rect.min.x + 1..=output_rect.max.x)
                        .find(|col| !columns.contains(col))
                    {
                        let new_pos = Pos {
                            x: change_column,
                            y: pos.y,
                        };
                        dt_to_add.push((*pos, new_pos, new_dt, index));
                        set_dirty_code_cells.push(*pos);
                        let mut new_output_rect = output_rect;
                        set_dirty_hash_rects.push(output_rect);
                        new_output_rect.translate(change_column - output_rect.min.x, 0);
                        set_dirty_hash_rects.push(new_output_rect);
                        set_dirty_code_cells.push(new_pos);
                    } else {
                        // this should never happen because of the (*) check above
                        dbgjs!("Unexpectedly could not find column in check_delete_table_column");
                    }
                } else {
                    dt_to_replace.push((*pos, index, new_dt));
                    set_dirty_hash_rects.push(output_rect);
                    set_dirty_code_cells.push(*pos);
                }
            });

        for (pos, index) in dt_to_delete {
            let old_dt = self.data_tables.shift_remove(&pos);
            reverse_operations.push(Operation::SetDataTable {
                sheet_pos: pos.to_sheet_pos(self.id),
                data_table: old_dt,
                index,
            });
        }

        // todo: we can optimize the undo by having delete_column_sorted return
        // the deleted column index and using an Operation::InsertDataTableColumn
        // instead of replacing the entire data table.

        for (pos, index, new_dt) in dt_to_replace {
            let old_dt = self.data_tables.insert(pos, new_dt);
            reverse_operations.push(Operation::SetDataTable {
                sheet_pos: pos.to_sheet_pos(self.id),
                data_table: old_dt,
                index,
            });
        }

        for (pos, new_pos, new_dt, index) in dt_to_add {
            // move anchor cell to new position
            let Some(old_anchor) = self.cell_value(pos) else {
                dbgjs!(format!("No anchor cell found for position: {:?}", pos));
                continue;
            };
            self.set_cell_value(new_pos, old_anchor);

            // remove old data table
            let old_dt = self.data_tables.shift_remove(&pos);
            reverse_operations.push(Operation::SetDataTable {
                sheet_pos: pos.to_sheet_pos(self.id),
                data_table: old_dt, // this should always be None
                index,
            });

            // add new data table
            self.data_tables.insert_sorted(new_pos, new_dt);

            reverse_operations.push(Operation::DeleteDataTable {
                sheet_pos: new_pos.to_sheet_pos(self.id),
            });
        }

        for (pos, width, height) in adjust_chart_size {
            if let Some(dt) = self.data_tables.get_mut(&pos) {
                if let Some((old_width, old_height)) = dt.chart_output.clone() {
                    dt.chart_output = Some((width, height));
                    reverse_operations.push(Operation::SetChartCellSize {
                        sheet_pos: pos.to_sheet_pos(self.id),
                        w: old_width,
                        h: old_height,
                    });
                }
            }
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
}

#[cfg(test)]
mod tests {
    use crate::{
        CellValue,
        controller::GridController,
        grid::{SheetId, sort::SortDirection},
        test_util::{
            assert_data_table_size, first_sheet, test_create_data_table, test_create_js_chart,
        },
    };

    use super::*;

    #[test]
    fn test_check_delete_tables_columns_outside_table_range() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 3, 1, &["A", "B", "C"]);
        test_create_data_table(&mut gc, SheetId::TEST, pos![B10], 3, 1, &["D", "E", "F"]);

        // Delete columns outside data table range
        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);

        sheet.check_delete_tables_columns(&mut transaction, &vec![5, 6]);
        assert!(
            sheet.data_tables.contains_key(&pos!(A1)),
            "Data table should remain unchanged when deleting columns outside its range"
        );
        assert!(
            sheet.data_tables.contains_key(&pos!(B10)),
            "Data table should remain unchanged when deleting columns outside its range"
        );
    }

    #[test]
    fn test_check_delete_tables_columns_middle_column() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 3, 1, &["A", "B", "C"]);

        // Delete middle column for A1
        let sheet = gc.sheet_mut(SheetId::TEST);
        sheet.check_delete_tables_columns(&mut transaction, &vec![2]);

        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 2, 1, false);
    }

    #[test]
    fn test_check_delete_tables_columns_anchor_column() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 3, 1, &["A", "B", "C"]);

        // Delete anchor column (first column)
        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);

        sheet.check_delete_tables_columns(&mut transaction, &vec![1]);
        assert!(
            !sheet.data_tables.contains_key(&pos!(A1)),
            "Original data table should be removed"
        );
        assert!(
            sheet.data_tables.contains_key(&pos!(B1)),
            "Data table should be moved to new position"
        );
        assert!(
            matches!(sheet.cell_value(pos![B1]), Some(CellValue::Import(_))),
            "Anchor cell should be moved to new position"
        );
    }

    #[test]
    fn test_check_delete_tables_columns_readonly_table() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 3, 1, &["A", "B", "C"]);

        // Test 4: Readonly table should not be modified
        let sheet = gc.sheet_mut(gc.sheet_ids()[0]);
        sheet.check_delete_tables_columns(&mut transaction, &vec![4]);

        if let Some(table) = sheet.data_tables.get(&pos!(D1)) {
            assert!(table.readonly, "Readonly table should remain unchanged");
        }
    }

    #[test]
    fn test_delete_first_column_with_entire_data_table() {
        let mut gc = GridController::test();
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 1, 3, &["A", "B", "C"]);

        // Delete first column
        gc.delete_columns(SheetId::TEST, vec![1], None);

        assert!(first_sheet(&gc).data_tables.is_empty());
    }

    #[test]
    fn test_delete_first_column_and_shift_data_table() {
        let mut gc = GridController::test();
        test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            2,
            2,
            &["A", "B", "C", "D"],
        );

        // Delete first column
        gc.delete_columns(SheetId::TEST, vec![1], None);
        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 1, 2, false);

        gc.undo(None);
        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 2, 2, false);
        assert_eq!(first_sheet(&gc).data_tables.len(), 1);
    }

    #[test]
    fn test_delete_multiple_columns_including_anchor_column() {
        let mut gc = GridController::test();
        test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            5,
            1,
            &["A", "B", "C", "D", "E"],
        );

        // Delete columns including anchor column
        gc.delete_columns(SheetId::TEST, vec![1, 3], None);

        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 3, 1, false);
        assert_eq!(first_sheet(&gc).data_tables.len(), 1);

        gc.undo(None);
        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 5, 1, false);
        assert_eq!(first_sheet(&gc).data_tables.len(), 1);
    }

    #[test]
    fn test_delete_multiple_tables_with_overlapping_columns() {
        let mut gc = GridController::test();
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 3, 1, &["A", "B", "C"]);
        test_create_data_table(&mut gc, SheetId::TEST, pos![B10], 3, 1, &["D", "E", "F"]);

        // Delete columns that overlap with both tables
        gc.delete_columns(SheetId::TEST, vec![2, 3], None);

        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 1, 1, false);
        assert_data_table_size(&gc, SheetId::TEST, pos![B10], 1, 1, false);
        assert_eq!(first_sheet(&gc).data_tables.len(), 2);

        gc.undo(None);
        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 3, 1, false);
        assert_data_table_size(&gc, SheetId::TEST, pos![B10], 3, 1, false);
        assert_eq!(first_sheet(&gc).data_tables.len(), 2);
    }

    #[test]
    fn test_delete_entire_table() {
        let mut gc = GridController::test();
        test_create_data_table(
            &mut gc,
            SheetId::TEST,
            pos![A1],
            3,
            2,
            &["A", "B", "C", "D", "E", "F"],
        );

        // Delete all columns that contain the table
        gc.delete_columns(SheetId::TEST, vec![1, 2, 3], None);

        assert!(
            first_sheet(&gc).data_tables.is_empty(),
            "Data table should be completely removed"
        );

        gc.undo(None);
        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 3, 2, false);
        assert_eq!(first_sheet(&gc).data_tables.len(), 1);
    }

    #[test]
    fn test_delete_multiple_entire_tables() {
        let mut gc = GridController::test();
        // Create two tables
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 2, 1, &["A", "B"]);
        test_create_data_table(&mut gc, SheetId::TEST, pos![D1], 2, 1, &["C", "D"]);

        // Delete all columns containing both tables
        gc.delete_columns(SheetId::TEST, vec![1, 2, 4, 5], None);

        assert!(
            first_sheet(&gc).data_tables.is_empty(),
            "All data tables should be completely removed"
        );

        gc.undo(None);
        assert_data_table_size(&gc, SheetId::TEST, pos![A1], 2, 1, false);
        assert_data_table_size(&gc, SheetId::TEST, pos![D1], 2, 1, false);
        assert_eq!(first_sheet(&gc).data_tables.len(), 2);
    }

    #[test]
    fn test_delete_entire_table_with_extra_columns() {
        let mut gc = GridController::test();
        test_create_data_table(&mut gc, SheetId::TEST, pos![B1], 2, 1, &["A", "B"]);

        // Delete more columns than the table occupies
        gc.delete_columns(SheetId::TEST, vec![1, 2, 3, 4], None);

        assert!(
            first_sheet(&gc).data_tables.is_empty(),
            "Data table should be completely removed"
        );

        gc.undo(None);
        assert_data_table_size(&gc, SheetId::TEST, pos![B1], 2, 1, false);
        assert_eq!(first_sheet(&gc).data_tables.len(), 1);
    }

    #[test]
    fn test_check_delete_tables_columns_sorted() {
        let mut gc = GridController::test();
        let mut transaction = PendingTransaction::default();

        // Create a data table and sort the first column
        test_create_data_table(&mut gc, SheetId::TEST, pos![A1], 3, 1, &["A", "B", "C"]);
        let sheet = gc.sheet_mut(SheetId::TEST);
        let data_table = sheet.data_table_mut(pos![A1]).unwrap();
        data_table.sort_column(0, SortDirection::Ascending).unwrap();

        // Verify initial state
        assert!(!data_table.sort_dirty);

        // Delete an unsorted column (column 2)
        let sheet = gc.sheet_mut(SheetId::TEST);
        sheet.check_delete_tables_columns(&mut transaction, &vec![2]);
        let data_table = sheet.data_table(pos![A1]).unwrap();
        assert!(
            !data_table.sort_dirty,
            "sort_dirty should remain false when deleting unsorted column"
        );

        // Delete the sorted column (column 1)
        let sheet = gc.sheet_mut(SheetId::TEST);
        sheet.check_delete_tables_columns(&mut transaction, &vec![1]);
        let data_table = sheet.data_table(pos![B1]).unwrap();
        assert!(
            data_table.sort_dirty,
            "sort_dirty should be true when deleting sorted column"
        );
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
}
