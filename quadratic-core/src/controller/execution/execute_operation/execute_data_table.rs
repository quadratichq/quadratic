use crate::{
    cellvalue::Import,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::{DataTable, SortDirection},
    ArraySize, CellValue, Pos, Rect, SheetRect,
};

use anyhow::{bail, Result};

impl GridController {
    fn send_to_wasm(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: &SheetRect,
    ) -> Result<()> {
        if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
            self.send_updated_bounds_rect(&sheet_rect, false);
            transaction.add_dirty_hashes_from_sheet_rect(*sheet_rect);

            if transaction.is_user() {
                let sheet = self.try_sheet_result(sheet_rect.sheet_id)?;
                let rows = sheet.get_rows_with_wrap_in_rect(&(*sheet_rect).into());

                if !rows.is_empty() {
                    let resize_rows = transaction
                        .resize_rows
                        .entry(sheet_rect.sheet_id)
                        .or_default();
                    resize_rows.extend(rows);
                }
            }
        }

        Ok(())
    }

    fn data_table_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: &SheetRect,
        forward_operations: Vec<Operation>,
        reverse_operations: Vec<Operation>,
    ) {
        if transaction.is_user_undo_redo() {
            transaction.forward_operations.extend(forward_operations);

            if transaction.is_user() {
                self.add_compute_operations(transaction, sheet_rect, None);
                self.check_all_spills(transaction, sheet_rect.sheet_id, true);
            }

            transaction.reverse_operations.extend(reverse_operations);
        }

        transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(&sheet_rect);
    }

    // delete any code runs within the sheet_rect.
    pub(super) fn check_deleted_data_tables(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: &SheetRect,
    ) {
        let sheet_id = sheet_rect.sheet_id;
        let Some(sheet) = self.grid.try_sheet(sheet_id) else {
            // sheet may have been deleted
            return;
        };
        let rect: Rect = (*sheet_rect).into();
        let data_tables_to_delete: Vec<Pos> = sheet
            .data_tables
            .iter()
            .filter_map(|(pos, _)| {
                // only delete code runs that are within the sheet_rect
                if rect.contains(*pos) {
                    // only delete when there's not another code cell in the same position (this maintains the original output until a run completes)
                    if let Some(value) = sheet.cell_value(*pos) {
                        if matches!(value, CellValue::Code(_)) {
                            None
                        } else {
                            Some(*pos)
                        }
                    } else {
                        Some(*pos)
                    }
                } else {
                    None
                }
            })
            .collect();
        data_tables_to_delete.iter().for_each(|pos| {
            self.finalize_code_run(transaction, pos.to_sheet_pos(sheet_id), None, None);
        });
    }

    pub(super) fn execute_set_data_table_at(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetDataTableAt { sheet_pos, values } = op {
            let sheet_id = sheet_pos.sheet_id;
            let mut pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(pos)?;

            // TODO(ddimaria): handle multiple values
            if values.size() != 1 {
                bail!("Only single values are supported for now");
            }

            let data_table = sheet.data_table_result(data_table_pos)?;

            if data_table.show_header && !data_table.header_is_first_row {
                pos.y -= 1;
            }

            let value = values.safe_get(0, 0).cloned()?;
            let old_value = sheet.get_code_cell_value(pos).unwrap_or(CellValue::Blank);

            // sen the new value
            sheet.set_code_cell_value(pos, value.to_owned());

            let sheet_rect = SheetRect::from_numbers(
                sheet_pos.x,
                sheet_pos.y,
                values.w as i64,
                values.h as i64,
                sheet_id,
            );

            self.send_to_wasm(transaction, &sheet_rect)?;

            let forward_operations = vec![Operation::SetDataTableAt {
                sheet_pos,
                values: value.into(),
            }];

            let reverse_operations = vec![Operation::SetDataTableAt {
                sheet_pos,
                values: old_value.into(),
            }];

            self.data_table_operations(
                transaction,
                &sheet_rect,
                forward_operations,
                reverse_operations,
            );

            return Ok(());
        };

        bail!("Expected Operation::SetDataTableAt in execute_set_data_table_at");
    }

    pub(super) fn execute_flatten_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::FlattenDataTable { sheet_pos } = op {
            let sheet_id = sheet_pos.sheet_id;
            let pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(pos)?;

            // Pull out the data table via a swap, removing it from the sheet
            let data_table = sheet.delete_data_table(data_table_pos)?;

            let values = data_table.display_value()?.into_array()?;
            let ArraySize { w, h } = values.size();

            let sheet_pos = data_table_pos.to_sheet_pos(sheet_id);
            let max = Pos {
                x: data_table_pos.x - 1 + w.get() as i64,
                y: data_table_pos.y - 1 + h.get() as i64,
            };
            let sheet_rect = SheetRect::new_pos_span(data_table_pos, max, sheet_id);

            let _ = sheet.set_cell_values(sheet_rect.into(), &values);

            // let the client know that the code cell changed to remove the styles
            if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                transaction.add_code_cell(sheet_id, data_table_pos);
            }

            self.send_to_wasm(transaction, &sheet_rect)?;
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![Operation::FlattenDataTable { sheet_pos }];

            let reverse_operations = vec![Operation::GridToDataTable { sheet_rect }];

            self.data_table_operations(
                transaction,
                &sheet_rect,
                forward_operations,
                reverse_operations,
            );
            self.check_deleted_data_tables(transaction, &sheet_rect);

            return Ok(());
        };

        bail!("Expected Operation::FlattenDataTable in execute_flatten_data_table");
    }

    pub(super) fn execute_grid_to_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::GridToDataTable { sheet_rect } = op {
            let sheet_id = sheet_rect.sheet_id;
            let rect = Rect::from(sheet_rect);
            let sheet = self.try_sheet_result(sheet_id)?;
            let sheet_pos = sheet_rect.min.to_sheet_pos(sheet_id);

            let old_values = sheet.cell_values_in_rect(&rect, false)?;

            let import = Import::new("simple.csv".into());
            let data_table = DataTable::from((import.to_owned(), old_values.to_owned(), sheet));
            let cell_value = CellValue::Import(import.to_owned());

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            sheet.delete_cell_values(rect);
            sheet.set_cell_value(sheet_rect.min, cell_value);
            sheet
                .data_tables
                .insert_full(sheet_rect.min, data_table.to_owned());

            // let the client know that the code cell has been created to apply the styles
            if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                transaction.add_code_cell(sheet_id, sheet_rect.min);
            }

            self.send_to_wasm(transaction, &sheet_rect)?;

            let forward_operations = vec![Operation::GridToDataTable { sheet_rect }];

            let reverse_operations = vec![Operation::FlattenDataTable { sheet_pos }];

            self.data_table_operations(
                transaction,
                &sheet_rect,
                forward_operations,
                reverse_operations,
            );

            return Ok(());
        };

        bail!("Expected Operation::GridToDataTable in execute_grid_to_data_table");
    }

    pub(super) fn execute_sort_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SortDataTable {
            sheet_pos,
            column_index,
            sort_order,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let sheet_rect = SheetRect::single_sheet_pos(sheet_pos);
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;

            let sort_order_enum = match sort_order.as_str() {
                "asc" => SortDirection::Ascending,
                "desc" => SortDirection::Descending,
                "none" => SortDirection::None,
                _ => bail!("Invalid sort order"),
            };

            let old_value = data_table.sort_column(column_index as usize, sort_order_enum)?;

            self.send_to_wasm(transaction, &sheet_rect)?;

            let forward_operations = vec![op];

            let reverse_operations = vec![Operation::SortDataTable {
                sheet_pos,
                column_index,
                sort_order: old_value
                    .map(|v| v.direction)
                    .unwrap_or(SortDirection::None)
                    .to_string(),
            }];

            self.data_table_operations(
                transaction,
                &sheet_rect,
                forward_operations,
                reverse_operations,
            );

            return Ok(());
        };

        bail!("Expected Operation::SortDataTable in execute_sort_data_table");
    }

    pub(super) fn execute_data_table_first_row_as_header(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DataTableFirstRowAsHeader {
            sheet_pos,
            first_row_is_header,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let sheet_rect = SheetRect::single_sheet_pos(sheet_pos);
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(sheet_pos.into(), true)
                .to_sheet_rect(sheet_id);

            data_table.toggle_first_row_as_header(first_row_is_header);

            self.send_to_wasm(transaction, &data_table_rect)?;
            transaction.add_code_cell(sheet_id, sheet_pos.into());

            let forward_operations = vec![op];

            let reverse_operations = vec![Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header: !first_row_is_header,
            }];

            self.data_table_operations(
                transaction,
                &sheet_rect,
                forward_operations,
                reverse_operations,
            );

            return Ok(());
        };

        bail!("Expected Operation::DataTableFirstRowAsHeader in execute_data_table_first_row_as_header");
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::{
            execution::execute_operation::{
                execute_forward_operations, execute_reverse_operations,
            },
            user_actions::import::tests::{assert_simple_csv, simple_csv},
        },
        grid::SheetId,
        test_util::{
            assert_cell_value_row, assert_data_table_cell_value, assert_data_table_cell_value_row,
            print_data_table, print_table,
        },
        SheetPos,
    };

    use super::*;

    pub(crate) fn flatten_data_table<'a>(
        gc: &'a mut GridController,
        sheet_id: SheetId,
        pos: Pos,
        file_name: &'a str,
    ) -> PendingTransaction {
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let op = Operation::FlattenDataTable { sheet_pos };
        let mut transaction = PendingTransaction::default();

        assert_simple_csv(&gc, sheet_id, pos, file_name);

        gc.execute_flatten_data_table(&mut transaction, op).unwrap();

        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);

        assert!(gc.sheet(sheet_id).first_data_table_within(pos).is_err());

        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        print_table(&gc, sheet_id, Rect::new(0, 0, 2, 2));

        transaction
    }

    #[track_caller]
    pub(crate) fn assert_flattened_simple_csv<'a>(
        gc: &'a GridController,
        sheet_id: SheetId,
        pos: Pos,
        file_name: &'a str,
    ) -> (&'a GridController, SheetId, Pos, &'a str) {
        // there should be no data tables
        assert!(gc.sheet(sheet_id).first_data_table_within(pos).is_err());

        let first_row = vec!["city", "region", "country", "population"];
        assert_cell_value_row(&gc, sheet_id, 0, 3, 0, first_row);

        let last_row = vec!["Concord", "NH", "United States", "42605"];
        assert_cell_value_row(&gc, sheet_id, 0, 3, 10, last_row);

        (gc, sheet_id, pos, file_name)
    }

    #[track_caller]
    pub(crate) fn assert_sorted_data_table<'a>(
        gc: &'a GridController,
        sheet_id: SheetId,
        pos: Pos,
        file_name: &'a str,
    ) -> (&'a GridController, SheetId, Pos, &'a str) {
        let first_row = vec!["Concord", "NH", "United States", "42605"];
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 3, 1, first_row);

        let second_row = vec!["Marlborough", "MA", "United States", "38334"];
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 3, 2, second_row);

        let third_row = vec!["Northbridge", "MA", "United States", "14061"];
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 3, 3, third_row);

        let last_row = vec!["Westborough", "MA", "United States", "29313"];
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 3, 10, last_row);
        (gc, sheet_id, pos, file_name)
    }

    #[test]
    fn test_execute_set_data_table_at() {
        let (mut gc, sheet_id, _, _) = simple_csv();
        let x = 1;
        let y = 1;
        let change_val_pos = Pos::new(x, y);
        let sheet_pos = SheetPos::from((change_val_pos, sheet_id));

        let values = CellValue::Number(1.into()).into();
        let op = Operation::SetDataTableAt { sheet_pos, values };
        let mut transaction = PendingTransaction::default();

        // the initial value from the csv
        assert_data_table_cell_value(&gc, sheet_id, x, y, "MA");

        gc.execute_set_data_table_at(&mut transaction, op).unwrap();

        // expect the value to be "1"
        assert_data_table_cell_value(&gc, sheet_id, x, y, "1");

        // undo, the value should be "MA" again
        execute_reverse_operations(&mut gc, &transaction);
        assert_data_table_cell_value(&gc, sheet_id, x, y, "MA");

        // redo, the value should be "1" again
        execute_forward_operations(&mut gc, &mut transaction);
        assert_data_table_cell_value(&gc, sheet_id, x, y, "1");
    }

    #[test]
    fn test_execute_flatten_data_table() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv();

        assert_simple_csv(&gc, sheet_id, pos, file_name);

        let mut transaction = flatten_data_table(&mut gc, sheet_id, pos, file_name);
        print_table(&gc, sheet_id, Rect::new(0, 0, 2, 2));

        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        assert_simple_csv(&gc, sheet_id, pos, file_name);

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);
    }

    #[test]
    fn test_execute_grid_to_data_table() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv();
        flatten_data_table(&mut gc, sheet_id, pos, file_name);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        let max = Pos::new(3, 10);
        let sheet_rect = SheetRect::new_pos_span(pos, max, sheet_id);
        let op = Operation::GridToDataTable { sheet_rect };
        let mut transaction = PendingTransaction::default();
        gc.execute_grid_to_data_table(&mut transaction, op).unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 2, 2));

        assert_simple_csv(&gc, sheet_id, pos, file_name);

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        assert_simple_csv(&gc, sheet_id, pos, file_name);
    }

    #[test]
    fn test_execute_sort_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        data_table.apply_first_row_as_header();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let op = Operation::SortDataTable {
            sheet_pos,
            column_index: 0,
            sort_order: "asc".into(),
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_sort_data_table(&mut transaction, op).unwrap();

        assert_sorted_data_table(&gc, sheet_id, pos, "simple.csv");
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_sorted_data_table(&gc, sheet_id, pos, "simple.csv");
    }
}
