use crate::{
    cell_values::CellValues,
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
    pub fn send_to_wasm(
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

    pub fn data_table_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: &SheetRect,
        forward_operations: Vec<Operation>,
        reverse_operations: Vec<Operation>,
    ) {
        if transaction.is_user_undo_redo() {
            transaction.forward_operations.extend(forward_operations);

            if transaction.is_user() {
                // self.check_deleted_data_tables(transaction, sheet_rect);
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
            let pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;

            // TODO(ddimaria): handle multiple values
            if values.size() != 1 {
                bail!("Only single values are supported for now");
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

            let old_values = data_table.value.to_owned().into_array()?;
            let values = data_table.display_value()?.into_array()?;
            let ArraySize { w, h } = values.size();

            let sheet_pos = data_table_pos.to_sheet_pos(sheet_id);
            let max = Pos {
                x: data_table_pos.x - 1 + w.get() as i64,
                y: data_table_pos.y - 1 + h.get() as i64,
            };
            let sheet_rect = SheetRect::new_pos_span(data_table_pos, max, sheet_id);

            let _ = sheet.set_cell_values(sheet_rect.into(), &values);
            let old_cell_values = CellValues::from(old_values);
            let cell_values = CellValues::from(values);

            // let the client know that the code cell changed to remove the styles
            if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                transaction.add_code_cell(sheet_id, data_table_pos);
            }

            self.send_to_wasm(transaction, &sheet_rect)?;

            let forward_operations = vec![Operation::SetCellValues {
                sheet_pos,
                values: cell_values,
            }];

            let reverse_operations = vec![
                Operation::SetCellValues {
                    sheet_pos,
                    values: old_cell_values,
                },
                Operation::SetCodeRun {
                    sheet_pos,
                    code_run: Some(data_table),
                    index: 0,
                },
            ];

            self.data_table_operations(
                transaction,
                &sheet_rect,
                forward_operations,
                reverse_operations,
            );

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

            let forward_operations = vec![
                Operation::SetCellValues {
                    sheet_pos,
                    values: CellValues::from(CellValue::Import(import)),
                },
                Operation::SetCodeRun {
                    sheet_pos,
                    code_run: Some(data_table),
                    index: 0,
                },
            ];

            let reverse_operations = vec![Operation::SetCellValues {
                sheet_pos,
                values: CellValues::from(old_values),
            }];

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
            // let rect = Rect::from(sheet_rect);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            // let sheet_pos = sheet_rect.min.to_sheet_pos(sheet_id);
            let sheet_rect = SheetRect::single_sheet_pos(sheet_pos);
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;

            let sort_order_enum = match sort_order.as_str() {
                "asc" => SortDirection::Ascending,
                "desc" => SortDirection::Descending,
                _ => bail!("Invalid sort order"),
            };

            data_table.sort(column_index as usize, sort_order_enum)?;

            self.send_to_wasm(transaction, &sheet_rect)?;

            // TODO(ddimaria): remove this clone
            let forward_operations = vec![op.clone()];

            let reverse_operations = vec![op.clone()];

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
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::user_actions::import::tests::{assert_simple_csv, simple_csv},
        grid::SheetId,
        test_util::{
            assert_cell_value_row, assert_data_table_cell_value_row, print_data_table, print_table,
        },
        SheetPos,
    };

    use super::*;

    pub(crate) fn flatten_data_table<'a>(
        gc: &'a mut GridController,
        sheet_id: SheetId,
        pos: Pos,
        file_name: &'a str,
    ) {
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let op = Operation::FlattenDataTable { sheet_pos };
        let mut transaction = PendingTransaction::default();

        assert_simple_csv(&gc, sheet_id, pos, file_name);

        gc.execute_flatten_data_table(&mut transaction, op).unwrap();

        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 2);

        gc.finalize_transaction(transaction);

        assert!(gc.sheet(sheet_id).first_data_table_within(pos).is_err());

        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        print_table(&gc, sheet_id, Rect::new(0, 0, 2, 2));
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

    #[test]
    fn test_execute_set_data_table_at() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let change_val_pos = Pos::new(1, 1);
        let sheet_pos = SheetPos::from((change_val_pos, sheet_id));

        let values = CellValue::Number(1.into()).into();
        let op = Operation::SetDataTableAt { sheet_pos, values };
        let mut transaction = PendingTransaction::default();

        gc.execute_set_data_table_at(&mut transaction, op).unwrap();

        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);

        gc.finalize_transaction(transaction);

        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let expected = CellValue::Number(1.into());
        assert_eq!(data_table.get_cell_for_formula(1, 1), expected);
    }

    #[test]
    fn test_execute_flatten_data_table() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv();

        assert_simple_csv(&gc, sheet_id, pos, file_name);

        flatten_data_table(&mut gc, sheet_id, pos, file_name);
        print_table(&gc, sheet_id, Rect::new(0, 0, 2, 2));

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

        // assert_eq!(transaction.forward_operations.len(), 1);
        // assert_eq!(transaction.reverse_operations.len(), 2);

        gc.finalize_transaction(transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 2, 2));

        assert_simple_csv(&gc, sheet_id, pos, file_name);
    }

    #[test]
    fn test_execute_sort_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        data_table.apply_header_from_first_row();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let max = Pos::new(3, 10);
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let op = Operation::SortDataTable {
            sheet_pos,
            column_index: 0,
            sort_order: "asc".into(),
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_sort_data_table(&mut transaction, op).unwrap();

        // assert_eq!(transaction.forward_operations.len(), 1);
        // assert_eq!(transaction.reverse_operations.len(), 2);

        gc.finalize_transaction(transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let first_row = vec!["Concord", "NH", "United States", "42605"];
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 3, 0, first_row);

        let second_row = vec!["Marlborough", "MA", "United States", "38334"];
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 3, 1, second_row);

        let third_row = vec!["Northbridge", "MA", "United States", "14061"];
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 3, 2, third_row);

        let last_row = vec!["Westborough", "MA", "United States", "29313"];
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 3, 9, last_row);
    }
}