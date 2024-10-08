use crate::{
    cell_values::CellValues,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
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
            self.add_dirty_hashes_from_sheet_rect(transaction, *sheet_rect);

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
                self.check_deleted_data_tables(transaction, sheet_rect);
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

            let values = data_table.value.to_owned().into_array()?;
            let ArraySize { w, h } = values.size();

            let sheet_pos = data_table_pos.to_sheet_pos(sheet_id);
            let max = Pos {
                x: data_table_pos.x - 1 + w.get() as i64,
                y: data_table_pos.y - 1 + h.get() as i64,
            };
            let sheet_rect = SheetRect::new_pos_span(data_table_pos, max, sheet_id);

            let old_values = sheet.set_cell_values(sheet_rect.into(), &values);
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
}

#[cfg(test)]
mod tests {
    use crate::{
        controller::user_actions::import::tests::simple_csv, test_util::print_table, SheetPos,
    };

    use super::*;

    #[test]
    fn test_execute_set_data_table_at() {
        // let (sheet, data_table) = new_data_table();
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let change_val_pos = Pos::new(1, 1);
        let sheet_pos = SheetPos::from((change_val_pos, sheet_id));
        // let values_array = data_table.value.clone().into_array().unwrap();
        // let ArraySize { w, h } = values_array.size();
        // let cell_values = values_array.into_cell_values_vec().into_vec();
        // let values = CellValues::from_flat_array(w.get(), h.get(), cell_values);

        let values = CellValue::Number(1.into()).into();
        let op = Operation::SetDataTableAt { sheet_pos, values };
        let mut transaction = PendingTransaction::default();

        gc.execute_set_data_table_at(&mut transaction, op);

        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);

        gc.finalize_transaction(transaction);

        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
        let expected = CellValue::Number(1.into());
        assert_eq!(data_table.get_cell_for_formula(1, 1), expected);
    }

    #[test]
    fn test_execute_flatten_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let op = Operation::FlattenDataTable { sheet_pos };
        let mut transaction = PendingTransaction::default();

        gc.execute_flatten_data_table(&mut transaction, op);

        // assert_eq!(transaction.forward_operations.len(), 1);
        // assert_eq!(transaction.reverse_operations.len(), 1);

        gc.finalize_transaction(transaction);

        print_table(&gc, sheet_id, Rect::new(0, 0, 10, 10));
    }
}
