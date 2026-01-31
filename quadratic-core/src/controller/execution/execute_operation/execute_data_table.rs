use std::collections::HashSet;

use crate::{
    ArraySize, CellValue, ClearOption, Pos, Rect, SheetPos, SheetRect,
    a1::A1Selection,
    cell_values::CellValues,
    cellvalue::Import,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{
        DataTable, SheetId,
        fix_names::{sanitize_column_name, sanitize_table_name},
        formats::{FormatUpdate, SheetFormatUpdates},
        unique_data_table_name,
    },
};

use anyhow::{Result, bail};

impl GridController {
    /// Selects the entire data table, including the header
    fn select_full_data_table(
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        data_table_pos: Pos,
        data_table: &DataTable,
    ) {
        if transaction.is_user_ai_undo_redo() {
            let sheet_pos = data_table_pos.to_sheet_pos(sheet_id);
            transaction.add_update_selection(A1Selection::table(sheet_pos, data_table.name()));
        }
    }

    /// Adds signals to the transaction to send the modified data table to the
    /// client.
    fn mark_data_table_dirty(
        &self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        data_table_pos: Pos,
    ) -> Result<()> {
        let sheet = self.try_sheet_result(sheet_id)?;
        let data_table = sheet.data_table_result(&data_table_pos)?;
        data_table.add_dirty_table(transaction, sheet, data_table_pos)?;

        if !(cfg!(target_family = "wasm") || cfg!(test)) || transaction.is_server() {
            return Ok(());
        }

        self.thumbnail_dirty_sheet_rect(
            transaction,
            data_table.output_sheet_rect(data_table_pos.to_sheet_pos(sheet_id), false),
        );

        Ok(())
    }

    // adds forward and reverse operations to the transaction
    // also adds compute and spill operations, in case of user transaction
    fn data_table_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        forward_operations: Vec<Operation>,
        reverse_operations: Vec<Operation>,
        sheet_rect_for_compute_and_spills: Option<SheetRect>,
    ) {
        if transaction.is_user_ai_undo_redo() {
            transaction.forward_operations.extend(forward_operations);
            transaction.reverse_operations.extend(reverse_operations);
        }

        if let Some(sheet_rect) = sheet_rect_for_compute_and_spills {
            self.check_validations(transaction, sheet_rect);
            self.check_conditional_format_fills(transaction, sheet_rect);
            self.add_compute_operations(transaction, sheet_rect, None);
        }
    }

    // delete any code runs within the sheet_rect.
    pub(crate) fn check_deleted_data_tables(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: &SheetRect,
    ) {
        if !transaction.is_user_ai() {
            return;
        }

        let Some(sheet) = self.grid.try_sheet(sheet_rect.sheet_id) else {
            // sheet may have been deleted
            return;
        };

        // Only delete CODE tables (formulas, Python, JavaScript), not import tables.
        // Setting values within an import table modifies the table data; it should not delete the table.
        // Import tables are only deleted when explicitly requested via DeleteDataTable operation.
        let data_tables_to_delete: Vec<Pos> = sheet
            .data_tables_pos_intersect_rect_sorted((*sheet_rect).into())
            .filter(|pos| {
                sheet_rect.contains(pos.to_sheet_pos(sheet_rect.sheet_id))
                    && sheet
                        .data_table_at(pos)
                        .is_some_and(|data_table| data_table.is_code())
            })
            .collect();

        // delete the data tables in reverse order, so that shift_remove is less expensive
        data_tables_to_delete.into_iter().rev().for_each(|pos| {
            self.finalize_data_table(
                transaction,
                pos.to_sheet_pos(sheet_rect.sheet_id),
                None,
                None,
                false,
            );
        });
    }

    pub(super) fn execute_set_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetDataTable {
            sheet_pos,
            data_table,
            index,
            ignore_old_data_table,
        } = op
        {
            self.finalize_data_table(
                transaction,
                sheet_pos,
                data_table,
                Some(index),
                ignore_old_data_table,
            );
            Ok(())
        } else {
            bail!("Expected Operation::SetDataTable in execute_set_data_table");
        }
    }

    pub(super) fn execute_add_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::AddDataTable {
            sheet_pos,
            data_table,
            index,
            // we ignore the cell_value because we no longer need it
            ..
        } = op
        {
            self.execute_set_data_table(
                transaction,
                Operation::SetDataTable {
                    sheet_pos,
                    data_table: Some(data_table),
                    index: index.unwrap_or(usize::MAX),
                    ignore_old_data_table: true,
                },
            )
        } else {
            bail!("Expected Operation::AddDataTable in execute_add_data_table");
        }
    }

    pub(super) fn execute_move_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::MoveDataTable {
            old_sheet_pos,
            new_sheet_pos,
        } = op
        {
            if old_sheet_pos == new_sheet_pos {
                return Ok(());
            }

            // return Ok for expected conditions, like sheets no longer exist, or data table no longer exists

            if self.grid.try_sheet(new_sheet_pos.sheet_id).is_none() {
                return Ok(());
            }
            let Some(old_sheet) = self.grid.try_sheet_mut(old_sheet_pos.sheet_id) else {
                return Ok(());
            };

            let Ok((_, dt, dirty_rects)) = old_sheet.delete_data_table(old_sheet_pos.into()) else {
                return Ok(());
            };
            old_sheet.recalculate_bounds(&self.a1_context);
            transaction.add_dirty_hashes_from_dirty_code_rects(old_sheet, dirty_rects);

            let Some(new_sheet) = self.grid.try_sheet_mut(new_sheet_pos.sheet_id) else {
                return Ok(());
            };
            let (_, _, dirty_rects) = new_sheet.data_tables.insert_full(new_sheet_pos.into(), dt);
            transaction.add_dirty_hashes_from_dirty_code_rects(new_sheet, dirty_rects);
            new_sheet.recalculate_bounds(&self.a1_context);

            transaction
                .reverse_operations
                .push(Operation::MoveDataTable {
                    old_sheet_pos: new_sheet_pos,
                    new_sheet_pos: old_sheet_pos,
                });

            Ok(())
        } else {
            bail!("Expected Operation::MoveDataTable in execute_move_data_table");
        }
    }

    pub(super) fn execute_delete_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DeleteDataTable { sheet_pos } = op {
            let sheet_id = sheet_pos.sheet_id;
            let pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_result(sheet_id)?;

            // Find the data table that contains this position
            let data_table_pos = match sheet.data_table_pos_that_contains(pos) {
                Some(p) => p,
                None => return Ok(()), // No table at this position, nothing to delete
            };

            // Only delete if the table's anchor matches the requested position.
            // This prevents deleting the wrong table when:
            // 1. The table was already deleted (e.g., by check_deleted_data_tables)
            // 2. Another table's spill cleared and now contains this position
            if data_table_pos != pos {
                return Ok(());
            }

            // mark the data table as dirty
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let sheet = self.try_sheet_mut_result(sheet_id)?;

            let (index, data_table, dirty_rects) = sheet.delete_data_table(data_table_pos)?;
            let sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, false)
                .to_sheet_rect(sheet_id);

            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SetDataTable {
                sheet_pos,
                data_table: Some(data_table),
                index,
                ignore_old_data_table: true,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(sheet_rect_for_compute_and_spills),
            );

            return Ok(());
        };

        bail!("Expected Operation::DeleteDataTable in execute_delete_data_table");
    }

    pub(super) fn execute_set_data_table_at(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetDataTableAt {
            mut sheet_pos,
            mut values,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let mut pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(pos)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;

            if data_table.is_code() {
                dbgjs!(format!("Data table {} is readonly", data_table.name));
                return Ok(());
            }

            let display_rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);

            transaction.add_code_cell(sheet_id, data_table_pos);
            transaction.add_dirty_hashes_from_sheet_rect(display_rect.to_sheet_rect(sheet_id));

            let mut rows_to_resize = HashSet::new();
            data_table.get_rows_with_wrap_in_display_rect(
                &data_table_pos,
                &display_rect,
                true,
                &mut rows_to_resize,
            );

            // Also check if the new values contain multiline text (newlines)
            // that would require row resizing
            for column in values.columns.iter() {
                for (&y, cell_value) in column.iter() {
                    if let CellValue::Text(text) = cell_value
                        && (text.contains('\n') || text.contains('\r'))
                    {
                        // Calculate the actual row in sheet coordinates
                        let sheet_row = pos.y + y as i64;
                        rows_to_resize.insert(sheet_row);
                    }
                }
            }

            if !rows_to_resize.is_empty() {
                transaction
                    .resize_rows
                    .entry(sheet_pos.sheet_id)
                    .or_default()
                    .extend(rows_to_resize);
            }

            pos.y -= data_table.y_adjustment(true);

            let is_sorted = data_table.display_buffer.is_some();

            // if there is a display buffer, use it to find the row index for all the values
            // this is used when the data table has sorted columns, maps input to actual coordinates
            let old_values = if is_sorted {
                // rebuild CellValues with unsorted coordinates
                let mut values_unsorted = CellValues::new(0, 0);
                let mut old_values = CellValues::new(0, 0);

                let rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);
                for y in rect.y_range() {
                    let display_row = u32::try_from(y - data_table_pos.y)?;
                    let actual_row = u32::try_from(
                        data_table.get_row_index_from_display_index(display_row as u64),
                    )?;

                    for x in rect.x_range() {
                        let display_column = u32::try_from(x - data_table_pos.x)?;

                        let value_x: u32 = u32::try_from(x - pos.x)?;
                        let value_y = u32::try_from(y - pos.y)?;

                        if let Some(value) = values.remove(value_x, value_y) {
                            values_unsorted.set(display_column, actual_row, value);
                        }

                        // account for hidden columns
                        let column_index =
                            data_table.get_column_index_from_display_index(display_column, true);
                        if let Ok(value) = data_table.value.get(column_index, actual_row) {
                            old_values.set(display_column, display_row, value.to_owned());
                        }
                    }
                }

                pos = data_table_pos;
                values = values_unsorted;
                sheet_pos = SheetPos::new(
                    sheet_id,
                    data_table_pos.x,
                    data_table_pos.y + data_table.y_adjustment(true),
                );
                old_values
            } else {
                sheet.get_code_cell_values(display_rect)
            };

            // check if any column is hidden, shift values to account for hidden columns
            if data_table
                .column_headers
                .as_ref()
                .is_some_and(|headers| headers.iter().any(|header| !header.display))
            {
                // rebuild CellValues with actual coordinates, mapped from display coordinates due to hidden columns
                let mut actual_values = CellValues::new(0, 0);

                let rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);
                for x in rect.x_range() {
                    let display_column = u32::try_from(x - data_table_pos.x)?;
                    let column_index =
                        data_table.get_column_index_from_display_index(display_column, true);

                    for y in rect.y_range() {
                        let row_index = u32::try_from(y - data_table_pos.y)?;

                        let value_x = u32::try_from(x - pos.x)?;
                        let value_y = u32::try_from(y - pos.y)?;

                        if let Some(value) = values.remove(value_x, value_y) {
                            actual_values.set(column_index, row_index, value);
                        }
                    }
                }

                pos = data_table_pos;
                values = actual_values;
            }

            // set the new value, and sort if necessary
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (_, dirty_rects) =
                sheet
                    .data_tables
                    .modify_data_table_at(&data_table_pos, |data_table| {
                        let rect = Rect::from(&values);
                        for y in rect.y_range() {
                            for x in rect.x_range() {
                                let new_x = u32::try_from(pos.x - data_table_pos.x + x)?;
                                let new_y = u32::try_from(pos.y - data_table_pos.y + y)?;
                                if let Some(value) = values.remove(x as u32, y as u32) {
                                    data_table.set_cell_value_at(new_x, new_y, value);
                                }
                            }
                        }

                        if is_sorted {
                            data_table.check_sort()?;
                        }

                        Ok(())
                    })?;

            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SetDataTableAt {
                sheet_pos,
                values: old_values,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(display_rect.to_sheet_rect(sheet_id)),
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
            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(pos)?;

            // mark old data table as dirty
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            // Pull out the data table via a swap, removing it from the sheet
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (index, data_table, dirty_rects) = sheet.delete_data_table(data_table_pos)?;
            let table_name = data_table.name.to_display().clone();

            let data_table_rect = data_table
                .output_rect(data_table_pos, false)
                .to_sheet_rect(sheet_id);

            let show_name = data_table.get_show_name();
            let show_columns = data_table.get_show_columns();

            let mut values = data_table.display_value(false)?.into_array()?;
            let ArraySize { w, h } = values.size();

            if !data_table.header_is_first_row && show_columns {
                let headers = data_table.column_headers_to_cell_values();
                values.insert_row(0, headers)?;
            }

            // delete the heading row if toggled off
            if data_table.header_is_first_row && !show_columns {
                values.delete_row(0)?;
            }

            // insert the heading row if toggled on
            if show_name {
                let mut table_row = vec![CellValue::Blank; w.get() as usize];
                table_row[0] = data_table.name.to_owned();
                values.insert_row(0, Some(table_row))?;
            }

            let mut reverse_operations = vec![];

            let values_rect = Rect::from_numbers(
                data_table_pos.x,
                data_table_pos.y,
                values.width() as i64,
                values.height() as i64,
            );
            let values_sheet_rect = values_rect.to_sheet_rect(sheet_id);
            let old_values = sheet.set_cell_values(values_rect, values);

            let mut sheet_format_updates = SheetFormatUpdates::default();
            let formats_rect = Rect::from_numbers(
                data_table_pos.x,
                data_table_pos.y + data_table.y_adjustment(true),
                w.get() as i64,
                h.get() as i64,
            );
            data_table.transfer_formats_to_sheet(
                data_table_pos,
                formats_rect,
                &mut sheet_format_updates,
            );
            if !sheet_format_updates.is_default() {
                sheet.formats.apply_updates(&sheet_format_updates);
                reverse_operations.push(Operation::SetCellFormatsA1 {
                    sheet_id,
                    formats: SheetFormatUpdates::from_selection(
                        &A1Selection::from_rect(formats_rect.to_sheet_rect(sheet_id)),
                        FormatUpdate::cleared(),
                    ),
                });
            }

            // Move any validations that were tied to the table to the sheet
            let sheet = self.grid.try_sheet_mut_result(sheet_id)?;
            let validations_reverse_operations = sheet
                .validations
                .transfer_to_sheet(&table_name, &self.a1_context);
            if !validations_reverse_operations.is_empty() {
                transaction
                    .reverse_operations
                    .extend(validations_reverse_operations);
                transaction.validations.insert(sheet_id);
            }

            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            reverse_operations.push(Operation::SetDataTable {
                sheet_pos,
                data_table: Some(data_table),
                index,
                ignore_old_data_table: true,
            });
            reverse_operations.push(Operation::SetCellValues {
                sheet_pos: data_table_pos.to_sheet_pos(sheet_id),
                values: old_values.into(),
            });
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(values_sheet_rect.union(&data_table_rect)),
            );

            return Ok(());
        };

        bail!("Expected Operation::FlattenDataTable in execute_flatten_data_table");
    }

    pub(super) fn execute_code_data_table_to_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SwitchDataTableKind { sheet_pos, kind } = op.clone() {
            let sheet_id = sheet_pos.sheet_id;
            let pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(pos)?;

            let old_data_table_kind = sheet.data_table_result(&data_table_pos)?.kind.to_owned();
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.kind = kind.to_owned();
                Ok(())
            })?;

            let sheet_rect_for_compute_and_spills = data_table.output_sheet_rect(sheet_pos, false);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SwitchDataTableKind {
                sheet_pos,
                kind: old_data_table_kind,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(sheet_rect_for_compute_and_spills),
            );

            return Ok(());
        };

        bail!(
            "Expected Operation::SwitchDataTableKind(WithoutCellValue) in execute_code_data_table_to_data_table"
        );
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

            let no_data_table = sheet.enforce_no_data_table_within_rect(sheet_rect.into())?;

            if !no_data_table {
                return Ok(());
            }

            let old_values = sheet.cell_values_in_rect(&rect, false)?;

            let context = self.a1_context();
            let import = Import::new(self.grid.next_data_table_name(context));
            let mut data_table =
                DataTable::from((import.to_owned(), old_values.to_owned(), context));

            // show_name & show_columns false is required for correct mapping of formats, values will shift when show_ui is true
            data_table.show_name = Some(false);
            data_table.show_columns = Some(false);
            let format_update = data_table.transfer_formats_from_sheet(rect.min, rect, sheet);
            data_table.show_name = Some(true);
            data_table.show_columns = Some(true);

            if let Some(format_update) = format_update
                && !format_update.is_default()
            {
                data_table
                    .formats
                    .get_or_insert_default()
                    .apply_updates(&format_update);
            }
            let data_table_rect = data_table.output_sheet_rect(sheet_pos, true);

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            // delete cell values and formats in rect on sheet
            sheet.delete_values(rect);
            let sheet_format_update =
                sheet
                    .formats
                    .apply_updates(&SheetFormatUpdates::from_selection(
                        &A1Selection::from_rect(rect.to_sheet_rect(sheet_id)),
                        FormatUpdate::cleared(),
                    ));

            // insert data table in sheet
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (_, _, _, dirty_rects) =
                sheet.data_table_insert_full(sheet_rect.min, data_table.to_owned());
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            // Sets the cursor to the entire table, including the new header
            Self::select_full_data_table(transaction, sheet_id, sheet_rect.min, &data_table);

            // mark deleted cells as dirty
            transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);

            // mark new data table as dirty
            self.mark_data_table_dirty(transaction, sheet_id, sheet_rect.min)?;
            self.send_updated_bounds(transaction, sheet_id);

            let forward_operations = vec![op];
            let reverse_operations = vec![
                Operation::SetCellFormatsA1 {
                    sheet_id,
                    formats: sheet_format_update,
                },
                Operation::SetCellValues {
                    sheet_pos,
                    values: old_values.into(),
                },
                Operation::DeleteDataTable { sheet_pos },
            ];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(sheet_rect.union(&data_table_rect)),
            );

            return Ok(());
        };

        bail!("Expected Operation::GridToDataTable in execute_grid_to_data_table");
    }

    /// **Deprecated** in favor of [`Self::execute_data_table_option_meta()`].
    pub(super) fn execute_data_table_meta(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DataTableMeta {
            sheet_pos,
            name,
            alternating_colors,
            columns,
            show_ui,
            show_name,
            show_columns,
            ..
        } = op
        {
            let hide_ui = show_ui.is_some_and(|show_ui| !show_ui);

            let show_name = if hide_ui {
                Some(ClearOption::Some(false))
            } else {
                show_name.map(|show_name| Some(show_name).into())
            };

            let show_columns = if hide_ui {
                Some(ClearOption::Some(false))
            } else {
                show_columns.map(|show_columns| Some(show_columns).into())
            };

            let new_op = Operation::DataTableOptionMeta {
                sheet_pos,
                name,
                alternating_colors,
                columns,
                show_name,
                show_columns,
            };
            self.execute_data_table_option_meta(transaction, new_op)?;

            return Ok(());
        }

        bail!("Expected Operation::DataTableMeta in execute_data_table_meta");
    }

    pub(super) fn execute_data_table_option_meta(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DataTableOptionMeta {
            sheet_pos,
            mut name,
            alternating_colors,
            mut columns,
            show_name,
            show_columns,
        } = op
        {
            // do grid mutations first to keep the borrow checker happy
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.grid.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let data_table_sheet_pos = data_table_pos.to_sheet_pos(sheet_id);
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let old_name = data_table.name().to_string();
            let mut old_columns = data_table.column_headers.to_owned();
            let mut old_alternating_colors = None;
            let mut old_show_name = None;
            let mut old_show_columns = None;

            if let Some(name) = name.as_mut()
                && old_name != *name
            {
                // sanitize table name
                let table_name = sanitize_table_name(name.to_string());

                *name = unique_data_table_name(
                    &table_name,
                    false,
                    Some(data_table_sheet_pos),
                    &self.a1_context,
                );

                self.grid.update_data_table_name(
                    data_table_sheet_pos,
                    &old_name,
                    name,
                    &self.a1_context,
                    false,
                )?;

                // mark code cells dirty to update meta data
                transaction.add_code_cell(sheet_id, data_table_pos);
            }

            // update column names that have changed in code cells
            if let (Some(columns), Some(old_columns)) = (columns.as_mut(), old_columns.as_ref()) {
                for (index, old_column) in old_columns.iter().enumerate() {
                    if let Some(new_column) = columns.get_mut(index) {
                        let is_code_cell = new_column.name.is_image() || new_column.name.is_html();

                        if is_code_cell {
                            if cfg!(target_family = "wasm") || cfg!(test) {
                                crate::wasm_bindings::js::jsClientMessage(
                                    "Cannot add code cell to table".to_string(),
                                    crate::grid::js_types::JsSnackbarSeverity::Error.to_string(),
                                );
                            }
                            // clear remaining operations
                            transaction.operations.clear();
                            bail!("Cannot add code cell to column header");
                        }

                        if old_column.name != new_column.name {
                            // sanitize column name
                            let column_name = sanitize_column_name(new_column.name.to_string());

                            let data_table = self.grid.data_table_at(sheet_id, &data_table_pos)?;
                            let unique_column_name = data_table.unique_column_header_name(
                                Some(&column_name),
                                index,
                                Some(index),
                            );

                            new_column.name = CellValue::Text(unique_column_name);

                            self.grid.update_data_table_column_name(
                                &old_name,
                                &old_column.name.to_string(),
                                &new_column.name.to_string(),
                                &self.a1_context,
                            );
                        }
                    }
                }
            }

            let mut sheet_rect_for_compute_and_spills = None;

            let (data_table, dirty_rects) = self
                .grid
                .try_sheet_mut_result(sheet_id)?
                .modify_data_table_at(&data_table_pos, |dt| {
                    if columns.is_some() || show_name.is_some() || show_columns.is_some() {
                        let data_table_rect = dt
                            .output_rect(data_table_pos, false)
                            .to_sheet_rect(sheet_id);
                        dt.add_dirty_fills_and_borders(transaction, sheet_id, data_table_pos);
                        transaction.add_dirty_hashes_from_sheet_rect(data_table_rect);
                        sheet_rect_for_compute_and_spills = Some(data_table_rect);
                    }

                    // if the header is first row, update the column names in the data table value
                    if dt.header_is_first_row
                        && let Some(columns) = columns.as_ref()
                    {
                        for (index, column) in columns.iter().enumerate() {
                            dt.set_cell_value_at(index as u32, 0, column.name.to_owned());
                        }
                    }

                    old_alternating_colors = alternating_colors.map(|alternating_colors| {
                        // mark code cell dirty to update alternating color
                        transaction.add_code_cell(sheet_id, data_table_pos);
                        std::mem::replace(&mut dt.alternating_colors, alternating_colors)
                    });

                    old_columns = columns.to_owned().and_then(|columns| {
                        let old_columns = dt.column_headers.replace(columns);
                        dt.normalize_column_header_names();
                        // mark code cells as dirty to updata meta data
                        transaction.add_code_cell(sheet_id, data_table_pos);
                        old_columns
                    });

                    old_show_name = show_name
                        .map(|show_name| std::mem::replace(&mut dt.show_name, show_name.into()));

                    old_show_columns = show_columns.map(|show_columns| {
                        std::mem::replace(&mut dt.show_columns, show_columns.into())
                    });

                    Ok(())
                })?;

            // changing these options shifts the entire data table, need to mark the entire data table as dirty
            if show_name.is_some() || show_columns.is_some() || columns.is_some() {
                let data_table_rect = data_table
                    .output_rect(data_table_pos, false)
                    .to_sheet_rect(sheet_id);
                sheet_rect_for_compute_and_spills = sheet_rect_for_compute_and_spills.map_or(
                    Some(data_table_rect),
                    |sheet_rect_for_compute_and_spills| {
                        Some(sheet_rect_for_compute_and_spills.union(&data_table_rect))
                    },
                );
                self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
                self.send_updated_bounds(transaction, sheet_id);
            }

            let sheet = self.grid.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![Operation::DataTableOptionMeta {
                sheet_pos,
                name,
                alternating_colors,
                columns,
                show_name,
                show_columns,
            }];
            let reverse_operations = vec![Operation::DataTableOptionMeta {
                sheet_pos,
                name: Some(old_name),
                alternating_colors: old_alternating_colors,
                columns: old_columns,
                show_name: old_show_name.map(|old_show_name| old_show_name.into()),
                show_columns: old_show_columns.map(|old_show_columns| old_show_columns.into()),
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                sheet_rect_for_compute_and_spills,
            );

            return Ok(());
        };

        bail!("Expected Operation::DataTableOptionMeta in execute_data_table_option_meta");
    }

    pub(super) fn execute_sort_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SortDataTable {
            sheet_pos,
            sort,
            display_buffer,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            // mark old data table as dirty
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let old_sort = data_table.sort.to_owned();
            let old_display_buffer = data_table.display_buffer.to_owned();
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.sort = sort.and_then(|sort| if sort.is_empty() { None } else { Some(sort) });
                if let Some(display_buffer) = display_buffer {
                    dt.display_buffer = display_buffer;
                    dt.check_sort()?;
                } else {
                    dt.sort_all()?;
                }

                Ok(())
            })?;

            // mark new data table as dirty
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SortDataTable {
                sheet_pos,
                sort: old_sort,
                display_buffer: Some(old_display_buffer),
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(sheet_rect_for_compute_and_spills),
            );

            return Ok(());
        };

        bail!("Expected Operation::SortDataTable in execute_sort_data_table");
    }

    pub(super) fn execute_insert_data_table_column(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        #[allow(unused_variables)]
        if let Operation::InsertDataTableColumns {
            sheet_pos,
            mut columns,
            swallow,
            select_table,
            copy_formats_from: None,
            copy_formats: None,
        } = op.to_owned()
        {
            if columns.is_empty() {
                return Ok(());
            }

            // ensure columns are inserted in ascending order
            columns.sort_by(|a, b| a.0.cmp(&b.0));

            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let mut reverse_operations: Vec<Operation> = vec![];
            let reverse_columns = columns
                .iter()
                .map(|(index, _, _)| *index)
                .collect::<Vec<_>>();

            let min_column = columns.first().map_or(0, |col| col.0);
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let display_min_column =
                data_table.get_display_index_from_column_index(min_column, true);

            for (index, mut column_header, mut values) in columns {
                let sheet = self.try_sheet_result(sheet_id)?;
                let data_table = sheet.data_table_result(&data_table_pos)?;
                let data_table_rect = data_table
                    .output_rect(data_table_pos, true)
                    .to_sheet_rect(sheet_id);

                let mut format_update = None;

                if swallow && column_header.is_none() && values.is_none() {
                    let display_index = data_table.get_display_index_from_column_index(index, true);
                    let show_name = data_table.get_show_name();
                    let show_columns = data_table.get_show_columns();
                    let y_adjustment = if show_name { 1 } else { 0 };

                    let values_rect = Rect::from_numbers(
                        data_table_pos.x + display_index,
                        data_table_pos.y + y_adjustment,
                        1,
                        data_table_rect.height() as i64 - y_adjustment,
                    );
                    let sheet_values_array = sheet.cell_values_in_rect(&values_rect, true)?;
                    let mut cell_values = sheet_values_array.into_cell_values_vec().into_vec();

                    // Check for DataTables or CellValue::Code cells in the rect.
                    // TODO: Remove has_code_cell_in_rect check once we support code cells inside tables.
                    if sheet
                        .data_tables
                        .has_content_except(values_rect, data_table_pos)
                        || sheet.has_code_cell_in_rect(values_rect)
                    {
                        if cfg!(target_family = "wasm") || cfg!(test) {
                            crate::wasm_bindings::js::jsClientMessage(
                                "Cannot add code cell to table".to_string(),
                                crate::grid::js_types::JsSnackbarSeverity::Error.to_string(),
                            );
                        }
                        // clear remaining operations
                        transaction.operations.clear();
                        bail!("Cannot add code cell to table");
                    } else {
                        if show_columns {
                            let header = if data_table.header_is_first_row {
                                cell_values[0].to_string()
                            } else {
                                cell_values.remove(0).to_string()
                            };

                            column_header = if header.is_empty() {
                                None
                            } else {
                                Some(header)
                            }
                        }

                        values = Some(cell_values);
                    }

                    // swallow sheet formatting
                    let formats_rect = Rect::from_numbers(
                        data_table_pos.x + display_index,
                        data_table_pos.y + data_table.y_adjustment(true),
                        1,
                        data_table_rect.height() as i64 - data_table.y_adjustment(true),
                    );

                    format_update =
                        data_table.transfer_formats_from_sheet(data_table_pos, formats_rect, sheet);

                    let sheet = self.try_sheet_mut_result(sheet_id)?;

                    // clear sheet formats
                    let old_sheet_formats =
                        sheet
                            .formats
                            .apply_updates(&SheetFormatUpdates::from_selection(
                                &A1Selection::from_rect(values_rect.to_sheet_rect(sheet_id)),
                                FormatUpdate::cleared(),
                            ));
                    reverse_operations.push(Operation::SetCellFormatsA1 {
                        sheet_id,
                        formats: old_sheet_formats,
                    });

                    // clear sheet values
                    let old_sheet_values = sheet.delete_values(values_rect);
                    reverse_operations.push(Operation::SetCellValues {
                        sheet_pos: values_rect.min.to_sheet_pos(sheet_id),
                        values: old_sheet_values.into(),
                    });
                }

                let sheet = self.try_sheet_mut_result(sheet_id)?;
                let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                    if dt.header_is_first_row
                        && column_header.is_none()
                        && let Some(values) = &values
                    {
                        let first_value = values[0].to_owned();
                        if !matches!(first_value, CellValue::Blank) {
                            column_header = Some(first_value.to_string());
                        }
                    }

                    dt.insert_column_sorted(index as usize, column_header, values)?;

                    if let Some(format_update) = format_update
                        && !format_update.is_default()
                    {
                        dt.formats
                            .get_or_insert_default()
                            .apply_updates(&format_update);
                    }

                    Ok(())
                })?;

                let sheet = self.try_sheet_result(sheet_id)?;
                transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            }

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.check_sort()?;
                Ok(())
            })?;
            let mut sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);
            sheet_rect_for_compute_and_spills.min.x += (display_min_column - 1).max(0);

            if select_table {
                Self::select_full_data_table(transaction, sheet_id, data_table_pos, data_table);
            }

            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![op];
            reverse_operations.push(Operation::DeleteDataTableColumns {
                sheet_pos,
                columns: reverse_columns,
                flatten: false,
                select_table,
            });
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(sheet_rect_for_compute_and_spills),
            );

            return Ok(());
        };

        bail!("Expected Operation::InsertDataTableColumns in execute_insert_data_table_column");
    }

    pub(super) fn execute_delete_data_table_column(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DeleteDataTableColumns {
            sheet_pos,
            mut columns,
            flatten,
            select_table,
        } = op.to_owned()
        {
            if columns.is_empty() {
                return Ok(());
            }

            let mut reverse_columns = vec![];
            let mut reverse_operations: Vec<Operation> = vec![];

            // ensure columns are deleted in reverse order
            columns.sort_by(|a, b| b.cmp(a));

            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let data_table = sheet.data_table_result(&data_table_pos)?;

            let min_column = columns.first().map_or(0, |col| col.to_owned());
            let display_min_column =
                data_table.get_display_index_from_column_index(min_column, true);

            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let old_sort = data_table.sort.to_owned();
            let old_display_buffer = data_table.display_buffer.to_owned();

            // for flattening
            let mut old_data_table_rect = data_table.output_rect(data_table_pos, true);
            old_data_table_rect.min.x += 1; // cannot flatten the first column

            let show_name = data_table.get_show_name();
            let show_columns = data_table.get_show_columns();

            let y_adjustment = if show_name { 1 } else { 0 };
            old_data_table_rect.min.y += y_adjustment;

            let mut sheet_cell_values =
                CellValues::new(old_data_table_rect.width(), old_data_table_rect.height());
            let mut sheet_format_updates = SheetFormatUpdates::default();
            let mut rects_to_remove = vec![];

            // used to store the values of the columns that are deleted for the
            // validation check below
            let mut columns_deleted = vec![];

            for &index in columns.iter() {
                let display_index = data_table.get_display_index_from_column_index(index, true);
                if let Ok(name) = data_table.column_name(display_index as usize) {
                    columns_deleted.push(name);
                }

                let sheet = self.try_sheet_result(sheet_id)?;
                let data_table = sheet.data_table_result(&data_table_pos)?;

                let old_values = data_table.get_column_sorted(index as usize)?;
                let old_column_header = data_table
                    .get_column_header(index as usize)
                    .map(|header| header.name.to_owned().to_string());

                if flatten {
                    // collect values to flatten
                    let old_values = old_values.to_owned();
                    let y_adjustment = if show_columns && !data_table.header_is_first_row {
                        1
                    } else {
                        0
                    };
                    for (y, old_value) in old_values.into_iter().enumerate() {
                        if y == 0 && data_table.header_is_first_row && !show_columns {
                            continue;
                        }

                        if let (Ok(value_x), Ok(value_y)) = (
                            u32::try_from(display_index - 1),
                            u32::try_from(y + y_adjustment),
                        ) {
                            sheet_cell_values.set(value_x, value_y, old_value);
                        }
                    }

                    if show_columns
                        && let Some(column_header) = &old_column_header
                        && let (Ok(value_x), Ok(value_y)) =
                            (u32::try_from(display_index - 1), u32::try_from(0))
                    {
                        sheet_cell_values.set(value_x, value_y, column_header.to_owned().into());
                    }

                    // collect formats to flatten
                    let formats_rect = Rect::from_numbers(
                        data_table_pos.x + display_index,
                        data_table_pos.y + data_table.y_adjustment(true),
                        1,
                        data_table.height(false) as i64,
                    );
                    data_table.transfer_formats_to_sheet(
                        data_table_pos,
                        formats_rect,
                        &mut sheet_format_updates,
                    );
                }

                let formats_rect =
                    Rect::from_numbers(index as i64 + 1, 1, 1, data_table.height(true) as i64);
                rects_to_remove.push(formats_rect);

                let old_values = data_table.get_column_sorted(index as usize)?;
                reverse_columns.push((index, old_column_header, Some(old_values)));
            }

            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            data_table.add_dirty_fills_and_borders(transaction, sheet_id, data_table_pos);

            let remove_selection =
                A1Selection::from_rects(rects_to_remove, sheet_id, &self.a1_context);

            // delete table formats
            if let Some(remove_selection) = remove_selection {
                let sheet = self.try_sheet_mut_result(sheet_id)?;
                let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                    let data_table_reverse_format = dt
                        .formats
                        .get_or_insert_default()
                        .apply_updates(&SheetFormatUpdates::from_selection(
                            &remove_selection,
                            FormatUpdate::cleared(),
                        ));
                    if !data_table_reverse_format.is_default() {
                        reverse_operations.push(Operation::DataTableFormats {
                            sheet_pos,
                            formats: data_table_reverse_format,
                        });
                    }

                    Ok(())
                })?;

                let sheet = self.try_sheet_result(sheet_id)?;
                transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            }

            if !columns_deleted.is_empty() {
                let sheet = self.try_sheet_result(sheet_id)?;
                let data_table = sheet.data_table_result(&data_table_pos)?;
                if let Some(deleted_selection) = A1Selection::from_table_columns(
                    data_table.name.to_display().as_str(),
                    columns_deleted,
                    &self.a1_context,
                ) {
                    reverse_operations.extend(self.check_deleted_validations(
                        transaction,
                        sheet_id,
                        &deleted_selection,
                        None,
                    ));
                }
            }

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                // delete columns
                for index in columns.iter() {
                    dt.delete_column_sorted(*index as usize)?;
                }

                if old_sort.is_some() || old_display_buffer.is_some() {
                    reverse_operations.push(Operation::SortDataTable {
                        sheet_pos,
                        sort: old_sort,
                        display_buffer: Some(old_display_buffer),
                    });
                    dt.check_sort()?;
                }

                Ok(())
            })?;

            reverse_operations.push(Operation::InsertDataTableColumns {
                sheet_pos,
                columns: reverse_columns,
                swallow: false,
                select_table,
                copy_formats_from: None,
                copy_formats: None,
            });

            if flatten {
                if !sheet_cell_values.is_empty() {
                    let reverse_sheet_values =
                        sheet.set_cell_values(old_data_table_rect, sheet_cell_values.into());
                    reverse_operations.push(Operation::SetCellValues {
                        sheet_pos: old_data_table_rect.min.to_sheet_pos(sheet_id),
                        values: reverse_sheet_values.into(),
                    });
                }

                if !sheet_format_updates.is_default() {
                    let reverse_sheet_formats = sheet.formats.apply_updates(&sheet_format_updates);
                    reverse_operations.push(Operation::SetCellFormatsA1 {
                        sheet_id,
                        formats: reverse_sheet_formats,
                    });
                }
            }

            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let mut sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);
            sheet_rect_for_compute_and_spills.min.x += display_min_column;

            if select_table {
                Self::select_full_data_table(transaction, sheet_id, data_table_pos, data_table);
            }
            transaction.add_code_cell(sheet_id, data_table_pos);
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            self.send_updated_bounds(transaction, sheet_id);

            let forward_operations = vec![op];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(sheet_rect_for_compute_and_spills),
            );
            return Ok(());
        };

        bail!("Expected Operation::DeleteDataTableColumns in execute_delete_data_table_column");
    }

    pub(super) fn execute_insert_data_table_row(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        #[allow(unused_variables)]
        if let Operation::InsertDataTableRows {
            sheet_pos,
            mut rows,
            swallow,
            select_table,

            // todo, implement copy formats
            copy_formats_from,
            copy_formats,
        } = op.to_owned()
        {
            if rows.is_empty() {
                return Ok(());
            }

            rows.sort_by(|a, b| a.0.cmp(&b.0));
            let min_display_row = rows.first().map_or(0, |row| row.0);

            let reverse_rows = rows.iter().map(|(index, _)| *index).collect::<Vec<_>>();

            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;

            for (index, mut values) in rows {
                let sheet = self.try_sheet_result(sheet_id)?;
                let data_table = sheet.data_table_result(&data_table_pos)?;
                let data_table_rect = data_table
                    .output_rect(data_table_pos, true)
                    .to_sheet_rect(sheet_id);

                let values_rect = Rect::from_numbers(
                    data_table_pos.x,
                    data_table_pos.y + index as i64,
                    data_table_rect.width() as i64,
                    1,
                );

                let mut format_update = None;

                if swallow && values.is_none() {
                    // check for code cells or data tables in neighboring cells
                    let sheet_values_array = sheet.cell_values_in_rect(&values_rect, true)?;
                    let cell_values = sheet_values_array.into_cell_values_vec().into_vec();
                    // Check for DataTables or CellValue::Code cells in the rect.
                    // TODO: Remove has_code_cell_in_rect check once we support code cells inside tables.
                    if sheet
                        .data_tables
                        .has_content_except(values_rect, data_table_pos)
                        || sheet.has_code_cell_in_rect(values_rect)
                    {
                        if cfg!(target_family = "wasm") || cfg!(test) {
                            crate::wasm_bindings::js::jsClientMessage(
                                "Cannot add code cell to table".to_string(),
                                crate::grid::js_types::JsSnackbarSeverity::Error.to_string(),
                            );
                        }
                        // clear remaining operations
                        transaction.operations.clear();
                        bail!("Cannot add code cell to table");
                    } else {
                        // account for hidden columns
                        let mut row_values = vec![CellValue::Blank; data_table.width()];
                        for (index, cell_value) in cell_values.into_iter().enumerate() {
                            let column_index =
                                data_table.get_column_index_from_display_index(index as u32, true);
                            row_values[usize::try_from(column_index)?] = cell_value;
                        }
                        values = Some(row_values);
                    }

                    // swallow sheet formatting
                    format_update =
                        data_table.transfer_formats_from_sheet(data_table_pos, values_rect, sheet);

                    let sheet = self.try_sheet_mut_result(sheet_id)?;

                    // clear sheet values
                    sheet.delete_values(values_rect);
                    // clear sheet formats
                    sheet
                        .formats
                        .apply_updates(&SheetFormatUpdates::from_selection(
                            &A1Selection::from_rect(values_rect.to_sheet_rect(sheet_id)),
                            FormatUpdate::cleared(),
                        ));
                }

                let sheet = self.try_sheet_mut_result(sheet_id)?;
                let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                    dt.insert_row(index as usize, values)?;

                    if let Some(format_update) = format_update
                        && !format_update.is_default()
                    {
                        dt.formats
                            .get_or_insert_default()
                            .apply_updates(&format_update);
                    }

                    Ok(())
                })?;

                let sheet = self.try_sheet_result(sheet_id)?;
                transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            }

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.check_sort()?;
                Ok(())
            })?;
            let mut sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);
            sheet_rect_for_compute_and_spills.min.y += (min_display_row as i64 - 1).max(0);

            if select_table {
                Self::select_full_data_table(transaction, sheet_id, data_table_pos, data_table);
            }

            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DeleteDataTableRows {
                sheet_pos,
                rows: reverse_rows,
                flatten: swallow,
                select_table,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(sheet_rect_for_compute_and_spills),
            );

            return Ok(());
        };

        bail!("Expected Operation::InsertDataTableRows in execute_insert_data_table_row");
    }

    pub(super) fn execute_delete_data_table_row(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DeleteDataTableRows {
            sheet_pos,
            mut rows,
            flatten,
            select_table,
        } = op.to_owned()
        {
            if rows.is_empty() {
                return Ok(());
            }

            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let data_table = sheet.data_table_result(&data_table_pos)?;

            // check if the rows to delete are part of the data table's UI, bail if so
            // we need rows relative to the data table, not the sheet, hence (0, 0)
            let ui_rows = data_table.ui_rows((0, 0).into());
            if !ui_rows.is_empty() && rows.iter().any(|row| ui_rows.contains(&(*row as i64))) {
                let e = "delete_rows_error".to_string();
                if transaction.is_user_ai_undo_redo() && cfg!(target_family = "wasm") {
                    let severity = crate::grid::js_types::JsSnackbarSeverity::Warning;
                    crate::wasm_bindings::js::jsClientMessage(e.to_owned(), severity.to_string());
                }
                bail!(e);
            }

            rows.sort_by(|a, b| b.cmp(a));
            rows.dedup();
            let min_display_row = rows.first().map_or(0, |row| row.to_owned());

            let mut reverse_rows = vec![];
            let mut reverse_operations: Vec<Operation> = vec![];

            let all_rows_being_deleted = rows.len() == data_table.height(true);
            if all_rows_being_deleted {
                let sheet = self.try_sheet_mut_result(sheet_id)?;
                let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                    let table_display_height = dt.height(false);
                    dt.insert_row(table_display_height, None)?;

                    reverse_operations.push(Operation::DeleteDataTableRows {
                        sheet_pos,
                        rows: vec![table_display_height as u32],
                        flatten: false,
                        select_table: false,
                    });

                    Ok(())
                })?;
                transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            }

            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let data_table_rect = data_table.output_rect(data_table_pos, true);
            let y_adjustment = data_table.y_adjustment(true);

            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let get_unsorted_row_index = |data_table: &DataTable, index: u32| {
                let data_index = index as i64 - y_adjustment;
                data_table.get_row_index_from_display_index(data_index as u64) as i64
            };

            // for flattening
            let mut old_data_table_rect = data_table.output_rect(data_table_pos, true);
            old_data_table_rect.min.y += y_adjustment;
            old_data_table_rect.min.y += 1; //cannot flatten the first row
            let mut sheet_cell_values =
                CellValues::new(old_data_table_rect.width(), old_data_table_rect.height());
            let mut sheet_format_updates = SheetFormatUpdates::default();
            let mut data_table_formats_rects = vec![];

            for &index in rows.iter() {
                let sheet = self.try_sheet_result(sheet_id)?;
                let data_table = sheet.data_table_result(&data_table_pos)?;

                let values_rect = Rect::from_numbers(
                    data_table_pos.x,
                    data_table_pos.y + index as i64,
                    data_table_rect.width() as i64,
                    1,
                );

                if flatten {
                    // collect values to flatten
                    let mut old_values = data_table.get_row_sorted(index as usize)?;
                    // handle hidden columns
                    if let Some(column_headers) = &data_table.column_headers {
                        let display_old_values = old_values
                            .into_iter()
                            .enumerate()
                            .filter(|(x, _)| {
                                column_headers.get(*x).is_some_and(|header| header.display)
                            })
                            .map(|(_, value)| value)
                            .collect::<Vec<_>>();
                        old_values = display_old_values;
                    }
                    for (x, old_value) in old_values.into_iter().enumerate() {
                        if let (Ok(value_x), Ok(value_y)) = (
                            u32::try_from(x),
                            u32::try_from(index as i64 - 1 - data_table.y_adjustment(true)),
                        ) {
                            sheet_cell_values.set(value_x, value_y, old_value);
                        }
                    }

                    // collect formats to flatten
                    data_table.transfer_formats_to_sheet(
                        data_table_pos,
                        values_rect,
                        &mut sheet_format_updates,
                    );
                }

                let actual_row_index = get_unsorted_row_index(data_table, index);
                let formats_rect =
                    Rect::from_numbers(1, actual_row_index + 1, data_table.width() as i64, 1);
                data_table_formats_rects.push(formats_rect);
            }

            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            data_table.add_dirty_fills_and_borders(transaction, sheet_id, data_table_pos);

            // delete table formats
            if let Some(formats_selection) =
                A1Selection::from_rects(data_table_formats_rects, sheet_id, &self.a1_context)
            {
                let sheet = self.try_sheet_mut_result(sheet_id)?;
                let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                    let data_table_reverse_format = dt
                        .formats
                        .get_or_insert_default()
                        .apply_updates(&SheetFormatUpdates::from_selection(
                            &formats_selection,
                            FormatUpdate::cleared(),
                        ));
                    if !data_table_reverse_format.is_default() {
                        reverse_operations.push(Operation::DataTableFormats {
                            sheet_pos,
                            formats: data_table_reverse_format,
                        });
                    }

                    Ok(())
                })?;

                let sheet = self.try_sheet_result(sheet_id)?;
                transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            }

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                // sort and display buffer
                if dt.display_buffer.is_some() {
                    reverse_operations.push(Operation::SortDataTable {
                        sheet_pos,
                        sort: dt.sort.to_owned(),
                        display_buffer: Some(dt.display_buffer.to_owned()),
                    });
                }

                // delete columns
                for index in rows.into_iter() {
                    let (reverse_row_index, reverse_row, _, _) =
                        dt.delete_row_sorted(index as usize)?;
                    reverse_rows.push((reverse_row_index, reverse_row));
                }
                reverse_rows.reverse();
                dt.check_sort()?;

                reverse_operations.push(Operation::InsertDataTableRows {
                    sheet_pos,
                    rows: reverse_rows,
                    swallow: false,
                    select_table,

                    // todo, implement copy formats
                    copy_formats_from: None,
                    copy_formats: None,
                });

                Ok(())
            })?;

            if flatten {
                if !sheet_cell_values.is_empty() {
                    let reverse_sheet_values =
                        sheet.set_cell_values(old_data_table_rect, sheet_cell_values.into());
                    reverse_operations.push(Operation::SetCellValues {
                        sheet_pos: old_data_table_rect.min.to_sheet_pos(sheet_id),
                        values: reverse_sheet_values.into(),
                    });
                }

                if !sheet_format_updates.is_default() {
                    let reverse_sheet_formats = sheet.formats.apply_updates(&sheet_format_updates);
                    reverse_operations.push(Operation::SetCellFormatsA1 {
                        sheet_id,
                        formats: reverse_sheet_formats,
                    });
                }
            }

            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let mut sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);
            sheet_rect_for_compute_and_spills.min.y += min_display_row as i64;

            if select_table {
                Self::select_full_data_table(transaction, sheet_id, data_table_pos, data_table);
            }
            transaction.add_code_cell(sheet_id, data_table_pos);
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            self.send_updated_bounds(transaction, sheet_id);

            let forward_operations = vec![op];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(sheet_rect_for_compute_and_spills),
            );

            return Ok(());
        };

        bail!("Expected Operation::DeleteDataTableRows in execute_delete_data_table_row");
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

            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains_result(sheet_pos.into())?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            if data_table.header_is_first_row == first_row_is_header {
                return Ok(());
            }

            let mut sheet_rect_for_compute_and_spills = None;

            // mark dirty if the first row is not the header, so that largest rect gets marked dirty
            if !data_table.header_is_first_row {
                sheet_rect_for_compute_and_spills = Some(
                    data_table
                        .output_rect(data_table_pos, true)
                        .to_sheet_rect(sheet_id),
                );
                self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
            }

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.toggle_first_row_as_header(first_row_is_header);
                Ok(())
            })?;

            // mark dirty if the first row is not the header, so that largest rect gets marked dirty
            if !data_table.header_is_first_row {
                sheet_rect_for_compute_and_spills = Some(
                    data_table
                        .output_rect(data_table_pos, true)
                        .to_sheet_rect(sheet_id),
                );
                self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
            }

            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header: !first_row_is_header,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                sheet_rect_for_compute_and_spills,
            );

            return Ok(());
        };

        bail!(
            "Expected Operation::DataTableFirstRowAsHeader in execute_data_table_first_row_as_header"
        );
    }

    pub(super) fn execute_data_table_format(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DataTableFormats { sheet_pos, formats } = op.to_owned() {
            if formats.is_default() {
                return Ok(());
            }

            let sheet_id = sheet_pos.sheet_id;

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet_pos.into();

            let mut forward_operations = vec![];
            let mut reverse_operations = vec![];

            sheet.modify_data_table_at(&data_table_pos, |dt| {
                // mark old table dirty
                dt.mark_formats_dirty(transaction, data_table_pos.to_sheet_pos(sheet_id), &formats);

                let reverse_formats = dt.formats.get_or_insert_default().apply_updates(&formats);
                if dt
                    .formats
                    .as_ref()
                    .is_some_and(|formats| formats.is_all_default())
                {
                    dt.formats = None;
                }

                // mark new table dirty
                dt.mark_formats_dirty(transaction, data_table_pos.to_sheet_pos(sheet_id), &formats);

                if transaction.is_user_ai_undo_redo() {
                    forward_operations.push(op);

                    reverse_operations.push(Operation::DataTableFormats {
                        sheet_pos,
                        formats: reverse_formats,
                    });
                }

                Ok(())
            })?;

            if transaction.is_user_ai_undo_redo() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_formats(sheet_id, &formats);
            }

            self.data_table_operations(transaction, forward_operations, reverse_operations, None);

            return Ok(());
        };

        bail!("Expected Operation::DataTableFormat in execute_data_table_format");
    }

    pub(super) fn execute_data_table_borders(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DataTableBorders { sheet_pos, borders } = op.to_owned() {
            let sheet_id = sheet_pos.sheet_id;

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet_pos.into();

            let mut forward_operations = vec![];
            let mut reverse_operations = vec![];

            sheet.modify_data_table_at(&data_table_pos, |dt| {
                let reverse_borders = dt.borders.get_or_insert_default().set_borders_a1(&borders);

                transaction.add_borders(sheet_id);

                if transaction.is_user_ai_undo_redo() {
                    forward_operations.push(op);

                    reverse_operations.push(Operation::DataTableBorders {
                        sheet_pos,
                        borders: reverse_borders,
                    });
                }

                Ok(())
            })?;

            if transaction.is_user_ai_undo_redo() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_borders(sheet_id, &borders);
            }

            self.data_table_operations(transaction, forward_operations, reverse_operations, None);

            return Ok(());
        };

        bail!("Expected Operation::DataTableBorders in execute_data_table_borders");
    }
}

#[cfg(test)]
mod tests {
    use crate::controller::user_actions::import::tests::{
        assert_flattened_simple_csv, assert_sorted_data_table, flatten_data_table,
    };
    use crate::test_util::*;

    use crate::{
        Array, SheetPos, Value,
        controller::{
            active_transactions::transaction_name::TransactionName,
            execution::execute_operation::{
                execute_forward_operations, execute_reverse_operations,
            },
            user_actions::import::tests::{assert_simple_csv, simple_csv, simple_csv_at},
        },
        grid::{
            CodeCellLanguage, CodeRun, DataTableKind, SheetId,
            column_header::DataTableColumnHeader,
            data_table::sort::{DataTableSort, SortDirection},
        },
        test_util::{assert_cell_value_row, assert_display_cell_value, print_table_in_rect},
        wasm_bindings::js::{clear_js_calls, expect_js_call},
    };

    use super::*;

    #[track_caller]
    pub(crate) fn assert_data_table_column_width<'a>(
        gc: &'a GridController,
        sheet_id: SheetId,
        pos: Pos,
        width: u32,
        index: u32,
        name: &'a str,
    ) {
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap().to_owned();
        let headers = data_table.column_headers.unwrap();

        assert_eq!(headers.len(), width as usize);
        assert_eq!(
            headers[index as usize],
            DataTableColumnHeader::new(name.into(), true, index)
        );
        assert_eq!(data_table.value.into_array().unwrap().size().w.get(), width);
    }

    #[track_caller]
    pub(crate) fn assert_data_table_row_height(
        gc: &GridController,
        sheet_id: SheetId,
        pos: Pos,
        height: u32,
        index: u32,
        values: Vec<CellValue>,
    ) {
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap().to_owned();
        let row = data_table.get_row(index as usize).unwrap();
        assert_eq!(row, values);
        assert_eq!(
            data_table.value.into_array().unwrap().size().h.get(),
            height
        );
    }

    #[test]
    fn test_execute_set_data_table_at() {
        let (mut gc, sheet_id, _, _) = simple_csv();

        // where the data starts
        let x = 2;
        let y = 3;

        let change_val_pos = Pos::new(x, y);
        let sheet_pos = SheetPos::from((change_val_pos, sheet_id));

        let values = CellValue::Number(1.into()).into();
        let op = Operation::SetDataTableAt { sheet_pos, values };
        let mut transaction = PendingTransaction::default();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 11));

        // the initial value from the csv
        assert_display_cell_value(&gc, sheet_id, x, y, "MA");

        gc.execute_set_data_table_at(&mut transaction, op.clone())
            .unwrap();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 11));

        // expect the value to be "1"
        assert_display_cell_value(&gc, sheet_id, x, y, "1");

        // undo, the value should be "MA" again
        execute_reverse_operations(&mut gc, &transaction);
        assert_display_cell_value(&gc, sheet_id, x, y, "MA");

        // redo, the value should be "1" again
        execute_forward_operations(&mut gc, &mut transaction);
        assert_display_cell_value(&gc, sheet_id, x, y, "1");

        // sort the data table and see if the value is still correct
        let sort = vec![DataTableSort {
            column_index: 0,
            direction: SortDirection::Descending,
        }];
        let sort_op = Operation::SortDataTable {
            sheet_pos,
            sort: Some(sort),
            display_buffer: None,
        };
        gc.execute_sort_data_table(&mut transaction, sort_op)
            .unwrap();

        gc.execute_set_data_table_at(&mut transaction, op).unwrap();
        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_display_cell_value(&gc, sheet_id, x, y, "1");
    }

    #[test]
    fn test_execute_flatten_data_table() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv();
        assert_simple_csv(&gc, sheet_id, pos, file_name);

        flatten_data_table(&mut gc, sheet_id, pos, file_name);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // undo, the value should be a data table again
        gc.undo(1, None, false);
        assert_simple_csv(&gc, sheet_id, pos, file_name);

        // redo, the value should be on the grid
        gc.redo(1, None, false);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);
    }

    #[test]
    fn test_execute_flatten_data_table_with_first_row_as_header() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv();
        assert_simple_csv(&gc, sheet_id, pos, file_name);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 11));

        let sheet_pos = pos.to_sheet_pos(sheet_id);
        gc.test_data_table_first_row_as_header(sheet_pos, false);

        let op = Operation::FlattenDataTable { sheet_pos };
        gc.start_user_ai_transaction(vec![op], None, TransactionName::FlattenDataTable, false);

        gc.undo(1, None, false);

        gc.test_data_table_first_row_as_header(sheet_pos, true);
        assert_eq!(
            gc.sheet(sheet_id).display_value(pos![A5]),
            Some(CellValue::Text("Westborough".into()))
        );
    }

    #[test]
    fn test_flatten_data_table_with_validations() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_create_data_table(&mut gc, sheet_id, pos![A1], 2, 2);

        let selection = A1Selection::test_a1_context("test_table[Column 1]", gc.a1_context());
        let checkbox = test_create_checkbox_with_id(&mut gc, selection);
        assert_validation_id(&gc, pos![sheet_id!a3], Some(checkbox.id));

        gc.flatten_data_table(pos![sheet_id!a1], None, false);
        assert_validation_id(&gc, pos![sheet_id!a3], Some(checkbox.id));
    }

    #[test]
    fn test_execute_code_data_table_to_data_table() {
        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;

        let code_run = CodeRun::new_javascript("return [1,2,3]".into());
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run.clone()),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1", "2", "3"]])),
            false,
            Some(true),
            Some(true),
            None,
        );
        let sheet_pos = pos![sheet_id!A1];
        let data_table_pos = sheet_pos.into();
        test_create_raw_data_table(&mut gc, sheet_pos, data_table);
        assert_code_language(
            &gc,
            sheet_pos,
            CodeCellLanguage::Javascript,
            "return [1,2,3]".to_string(),
        );
        let expected = vec!["1", "2", "3"];

        // initial value
        assert_cell_value_row(&gc, sheet_id, 1, 3, 3, expected.clone());

        let import = Import::new("".into());
        let kind = DataTableKind::Import(import.to_owned());
        let op = Operation::SwitchDataTableKind {
            sheet_pos,
            kind: kind.clone(),
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_code_data_table_to_data_table(&mut transaction, op)
            .unwrap();

        assert_cell_value_row(&gc, sheet_id, 1, 3, 3, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table_at(&data_table_pos).unwrap();
        assert_eq!(data_table.kind, kind);

        // undo, the value should be a code run data table again
        execute_reverse_operations(&mut gc, &transaction);
        assert_cell_value_row(&gc, sheet_id, 1, 3, 3, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table_at(&data_table_pos).unwrap();
        assert_eq!(data_table.kind, DataTableKind::CodeRun(code_run));

        // redo, the value should be a data table
        execute_forward_operations(&mut gc, &mut transaction);
        assert_cell_value_row(&gc, sheet_id, 1, 3, 3, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table_at(&data_table_pos).unwrap();
        assert_eq!(data_table.kind, kind);
    }

    #[test]
    fn test_execute_grid_to_data_table() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);

        test_set_values(&mut gc, sheet_id, pos![A1], 3, 3);
        assert_cell_value_row(&gc, sheet_id, 1, 3, 1, vec!["0", "1", "2"]);

        gc.grid_to_data_table(rect![sheet_id!A1:C3], None, true, None, false)
            .unwrap();
        // height is 4 because the first row is a header, and column names = false
        assert_import(&gc, pos![sheet_id!A1], "Table1", 3, 4);

        // undo, the value should be on the grid again
        gc.undo(1, None, false);
        assert_cell_value_row(&gc, sheet_id, 1, 3, 1, vec!["0", "1", "2"]);

        // back to a table
        gc.redo(1, None, false);
        assert_import(&gc, pos![sheet_id!A1], "Table1", 3, 4);

        // leave it as raw data
        gc.undo(1, None, false);

        // create a formula cell in the grid data table
        let formula_pos = pos![sheet_id!E1];
        gc.set_code_cell(
            formula_pos,
            CodeCellLanguage::Formula,
            "=1+1".into(),
            None,
            None,
            false,
        );

        // 1x1 formulas are stored as CellValue::Code, not DataTable
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 0);
        assert!(matches!(
            gc.sheet(sheet_id).cell_value(pos![E1]),
            Some(CellValue::Code(_))
        ));

        // expect that a data table is not created from a CellValue::Code cell
        assert!(
            gc.grid_to_data_table(rect![sheet_id!E1:E1], None, true, None, false)
                .is_err()
        );

        // there should still be no DataTables (the formula is CellValue::Code)
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 0);
    }

    #[test]
    fn test_execute_sort_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        gc.sheet_mut(sheet_id)
            .modify_data_table_at(&pos, |dt| {
                dt.apply_first_row_as_header();
                Ok(())
            })
            .unwrap();

        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let sort = vec![DataTableSort {
            column_index: 0,
            direction: SortDirection::Ascending,
        }];
        let op = Operation::SortDataTable {
            sheet_pos,
            sort: Some(sort),
            display_buffer: None,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_sort_data_table(&mut transaction, op).unwrap();

        assert_sorted_data_table(&gc, sheet_id, pos, "simple.csv");
        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_sorted_data_table(&gc, sheet_id, pos, "simple.csv");
    }

    #[test]
    fn test_execute_update_data_table_name() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        let updated_name = "My_Table";

        assert_eq!(&data_table.name().to_string(), "simple.csv");
        println!("Initial data table name: {}", &data_table.name());

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let op = Operation::DataTableOptionMeta {
            sheet_pos,
            name: Some(updated_name.into()),
            alternating_colors: None,
            columns: None,
            show_name: None,
            show_columns: None,
        };
        gc.start_user_ai_transaction(
            vec![op.to_owned()],
            None,
            TransactionName::DataTableMeta,
            false,
        );

        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        assert_eq!(&data_table.name().to_string(), updated_name);
        println!("Updated data table name: {}", &data_table.name);

        // undo, the value should be the initial name
        gc.undo(1, None, false);
        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        assert_eq!(&data_table.name().to_string(), "simple.csv");
        println!("Initial data table name: {}", &data_table.name);

        // redo, the value should be the updated name
        {
            gc.redo(1, None, false);
            let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
            assert_eq!(&data_table.name().to_string(), updated_name);
            println!("Updated data table name: {}", &data_table.name);
        }

        // ensure names are unique
        gc.start_user_ai_transaction(
            vec![op.to_owned()],
            None,
            TransactionName::DataTableMeta,
            false,
        );
        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        assert_eq!(&data_table.name().to_string(), "My_Table");

        // ensure numbers aren't added for unique names
        let op = Operation::DataTableOptionMeta {
            sheet_pos,
            name: Some("ABC".into()),
            alternating_colors: None,
            columns: None,
            show_name: None,
            show_columns: None,
        };
        gc.start_user_ai_transaction(
            vec![op.to_owned()],
            None,
            TransactionName::DataTableMeta,
            false,
        );
        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        assert_eq!(&data_table.name().to_string(), "ABC");
    }

    #[test]
    fn test_execute_insert_data_table_column() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 0;
        let op = Operation::InsertDataTableColumns {
            sheet_pos,
            columns: vec![(index, None, None)],
            swallow: false,
            select_table: true,

            copy_formats_from: None,
            copy_formats: None,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_insert_data_table_column(&mut transaction, op)
            .unwrap();

        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_data_table_column_width(&gc, sheet_id, pos, 5, index, "Column 1");

        // ensure the value_index is set correctly
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        for (index, header) in data_table
            .column_headers
            .as_ref()
            .unwrap()
            .iter()
            .enumerate()
        {
            assert_eq!(header.value_index, index as u32);
        }

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_data_table_column_width(&gc, sheet_id, pos, 5, index, "Column 1");
    }

    #[test]
    fn test_execute_delete_data_table_column() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 2, 11));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 0;
        let op = Operation::DeleteDataTableColumns {
            sheet_pos,
            columns: vec![index],
            flatten: false,
            select_table: true,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_delete_data_table_column(&mut transaction, op)
            .unwrap();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 2, 11));
        assert_data_table_column_width(&gc, sheet_id, pos, 3, index, "region");

        // ensure the value_index is set correctly
        let data_table = gc.sheet(sheet_id).data_table_at(&pos).unwrap();
        for (index, header) in data_table
            .column_headers
            .as_ref()
            .unwrap()
            .iter()
            .enumerate()
        {
            assert_eq!(header.value_index, index as u32);
        }

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 2, 11));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 2, 11));
        assert_data_table_column_width(&gc, sheet_id, pos, 3, index, "region");
    }

    #[test]
    fn test_execute_insert_data_table_row() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 2, 11));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 2;
        let op = Operation::InsertDataTableRows {
            sheet_pos,
            rows: vec![(index, None)],
            swallow: false,
            select_table: true,

            copy_formats_from: None,
            copy_formats: None,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_insert_data_table_row(&mut transaction, op)
            .unwrap();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 2, 12));
        let blank = CellValue::Blank;
        let values = vec![blank.clone(), blank.clone(), blank.clone(), blank.clone()];
        assert_data_table_row_height(&gc, sheet_id, pos, 12, index, values);

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 2, 11));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 2, 12));
        let values = vec![blank.clone(), blank.clone(), blank.clone(), blank.clone()];
        assert_data_table_row_height(&gc, sheet_id, pos, 12, index, values);
    }

    #[test]
    fn test_execute_delete_data_table_row() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 11));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 2;
        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        let values = data_table.get_row(index as usize + 1).unwrap();
        let op = Operation::DeleteDataTableRows {
            sheet_pos,
            rows: vec![index],
            flatten: true,
            select_table: true,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_delete_data_table_row(&mut transaction, op)
            .unwrap();

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 12));
        assert_data_table_row_height(&gc, sheet_id, pos, 10, index, values.clone());

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 11));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 12));
        assert_data_table_row_height(&gc, sheet_id, pos, 10, index, values);
    }

    #[test]
    fn test_execute_delete_data_table_row_on_resize() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        assert_data_table_size(&gc, sheet_id, pos, 4, 12, true);

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 11;
        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        let values = data_table.get_row(index as usize + 1).unwrap();
        let op = Operation::DeleteDataTableRows {
            sheet_pos,
            rows: vec![index],
            flatten: true,
            select_table: true,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_delete_data_table_row(&mut transaction, op)
            .unwrap();

        assert_data_table_row_height(&gc, sheet_id, pos, 10, index, values.clone());
        assert_data_table_size(&gc, sheet_id, pos, 4, 11, true);

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.display_value(pos!(B9)).is_some());
    }

    #[test]
    fn test_execute_insert_column_row_over_code_cell() {
        clear_js_calls();

        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        gc.set_code_cell(
            pos!(F14).to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "1+1".to_string(),
            None,
            None,
            false,
        );
        gc.set_code_cell(
            pos!(I5).to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "2+2".to_string(),
            None,
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.display_value(pos!(F14)),
            Some(CellValue::Number(2.into()))
        );
        assert_eq!(
            sheet.display_value(pos!(I5)),
            Some(CellValue::Number(4.into()))
        );

        let mut transaction = PendingTransaction::default();
        let insert_column_op = Operation::InsertDataTableColumns {
            sheet_pos: pos.to_sheet_pos(sheet_id),
            columns: vec![(4, None, None)],
            swallow: true,
            select_table: true,
            copy_formats_from: None,
            copy_formats: None,
        };
        let column_result = gc.execute_insert_data_table_column(&mut transaction, insert_column_op);
        assert!(column_result.is_err());
        expect_js_call(
            "jsClientMessage",
            format!(
                "{},{}",
                "Cannot add code cell to table",
                crate::grid::js_types::JsSnackbarSeverity::Error
            ),
            true,
        );

        let mut transaction = PendingTransaction::default();
        let insert_row_op = Operation::InsertDataTableRows {
            sheet_pos: pos.to_sheet_pos(sheet_id),
            rows: vec![(12, None)],
            swallow: true,
            select_table: true,
            copy_formats_from: None,
            copy_formats: None,
        };
        let row_result = gc.execute_insert_data_table_row(&mut transaction, insert_row_op);
        assert!(row_result.is_err());
        expect_js_call(
            "jsClientMessage",
            format!(
                "{},{}",
                "Cannot add code cell to table",
                crate::grid::js_types::JsSnackbarSeverity::Error
            ),
            true,
        );
    }

    #[test]
    fn test_execute_insert_column_row_over_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        test_create_data_table(&mut gc, sheet_id, pos![F14], 2, 2);
        test_create_data_table(&mut gc, sheet_id, pos![I5], 2, 2);

        let mut transaction = PendingTransaction::default();
        let insert_column_op = Operation::InsertDataTableColumns {
            sheet_pos: pos.to_sheet_pos(sheet_id),
            columns: vec![(4, None, None)],
            swallow: true,
            select_table: true,
            copy_formats_from: None,
            copy_formats: None,
        };
        let column_result = gc.execute_insert_data_table_column(&mut transaction, insert_column_op);
        assert!(column_result.is_err());
        expect_js_call(
            "jsClientMessage",
            format!(
                "{},{}",
                "Cannot add code cell to table",
                crate::grid::js_types::JsSnackbarSeverity::Error
            ),
            true,
        );

        let mut transaction = PendingTransaction::default();
        let insert_row_op = Operation::InsertDataTableRows {
            sheet_pos: pos.to_sheet_pos(sheet_id),
            rows: vec![(12, None)],
            swallow: true,
            select_table: true,
            copy_formats_from: None,
            copy_formats: None,
        };
        let row_result = gc.execute_insert_data_table_row(&mut transaction, insert_row_op);
        assert!(row_result.is_err());
        expect_js_call(
            "jsClientMessage",
            format!(
                "{},{}",
                "Cannot add code cell to table",
                crate::grid::js_types::JsSnackbarSeverity::Error
            ),
            true,
        );
    }

    #[test]
    fn test_execute_delete_data_table_column_with_validations() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let sheet_pos = pos![sheet_id!a1];

        test_create_data_table(&mut gc, sheet_id, sheet_pos.into(), 2, 2);
        let selection = A1Selection::test_a1_context("test_table[Column 1]", &gc.a1_context);
        let validation = test_create_checkbox_with_id(&mut gc, selection);

        let checkbox_pos = pos![sheet_id!a3];
        assert_validation_id(&gc, checkbox_pos, Some(validation.id));
        assert_validation_count(&gc, sheet_id, 1);

        gc.data_table_mutations(
            pos!(sheet_id!a1),
            false,
            None,
            Some(vec![0]),
            None,
            None,
            None,
            None,
            None,
            false,
        );

        assert_validation_id(&gc, checkbox_pos, None);

        // ensure the new column does not have a checkbox validation
        gc.data_table_insert_columns(sheet_pos, vec![0], false, None, None, None, false);
        assert_validation_id(&gc, checkbox_pos, None);

        assert_validation_count(&gc, sheet_id, 0);
    }

    #[test]
    fn test_execute_unique_column_header_name_on_insert_column() {
        let mut gc = test_create_gc();
        let sheet_id = first_sheet_id(&gc);
        let sheet_pos = pos![sheet_id!E5];

        test_create_data_table(&mut gc, sheet_id, sheet_pos.into(), 5, 25);

        gc.data_table_insert_columns(sheet_pos, vec![2], false, None, None, None, false);

        let data_table = gc.sheet(sheet_id).data_table_at(&sheet_pos.into()).unwrap();
        assert_eq!(data_table.column_headers.as_ref().unwrap().len(), 6);
        assert_eq!(
            data_table.column_headers.as_ref().unwrap()[2].name,
            CellValue::Text("Column 6".to_string())
        );
    }
}
