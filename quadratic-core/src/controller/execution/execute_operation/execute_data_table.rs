use crate::{
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    CellValue, Pos, Rect, SheetRect,
};

impl GridController {
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
    ) {
        if let Operation::SetDataTableAt { sheet_pos, values } = op {
            let sheet_id = sheet_pos.sheet_id;
            let pos: Pos = sheet_pos.into();

            if let Some(sheet) = self.try_sheet_mut(sheet_id) {
                if values.size() != 1 {
                    return dbgjs!("Only single values are supported for now");
                }

                let value = if let Some(value) = values.get(0, 0).cloned() {
                    value
                } else {
                    return dbgjs!("No cell value found in CellValues at (0, 0)");
                };

                let old_value = sheet.get_code_cell_value(pos).unwrap_or(CellValue::Blank);

                dbgjs!(format!(
                    "SetDataTableAt sheet_pos: {:?} old_value: {:?} old_value: {:?}",
                    sheet_pos, old_value, value
                ));

                sheet.set_code_cell_value(pos, value.to_owned());
                let sheet_rect = SheetRect::from_numbers(
                    sheet_pos.x,
                    sheet_pos.y,
                    values.w as i64,
                    values.h as i64,
                    sheet_id,
                );

                if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                    self.send_updated_bounds_rect(&sheet_rect, false);
                    self.add_dirty_hashes_from_sheet_rect(transaction, sheet_rect);

                    if transaction.is_user() {
                        if let Some(sheet) = self.try_sheet(sheet_id) {
                            let rows = sheet.get_rows_with_wrap_in_rect(&sheet_rect.into());
                            if !rows.is_empty() {
                                let resize_rows =
                                    transaction.resize_rows.entry(sheet_id).or_default();
                                resize_rows.extend(rows);
                            }
                        }
                    }
                }

                if transaction.is_user_undo_redo() {
                    transaction
                        .forward_operations
                        .push(Operation::SetDataTableAt {
                            sheet_pos,
                            values: value.into(),
                        });

                    transaction
                        .reverse_operations
                        .push(Operation::SetDataTableAt {
                            sheet_pos,
                            values: old_value.into(),
                        });

                    if transaction.is_user() {
                        self.add_compute_operations(transaction, &sheet_rect, Some(sheet_pos));
                        self.check_all_spills(transaction, sheet_pos.sheet_id, true);
                    }
                }

                transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(&sheet_rect);
            };
        }
    }
}

#[cfg(test)]
mod tests {}
