use crate::{
    ArraySize, CellValue, ClearOption, Pos, Rect, SheetPos, SheetRect,
    a1::{A1Context, A1Selection},
    cell_values::CellValues,
    cellvalue::Import,
    controller::{
        GridController, active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation,
    },
    grid::{
        DataTable, SheetId,
        formats::{FormatUpdate, SheetFormatUpdates},
        js_types::JsSnackbarSeverity,
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
        if transaction.is_user_undo_redo() {
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
        data_table.add_dirty_fills_and_borders(transaction, sheet_id);

        if !(cfg!(target_family = "wasm") || cfg!(test)) || transaction.is_server() {
            return Ok(());
        }

        if transaction.is_user_undo_redo() {
            let data_table_rect =
                data_table.output_sheet_rect(data_table_pos.to_sheet_pos(sheet_id), false);
            transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(data_table_rect);
        }

        Ok(())
    }

    // adds forward and reverse operations to the transaction
    // also adds compute and spill operations, in case of user transaction
    fn data_table_operations(
        &mut self,
        transaction: &mut PendingTransaction,
        forward_operations: Vec<Operation>,
        reverse_operations: Vec<Operation>,
        sheet_rect_for_compute_and_spills: Option<&SheetRect>,
    ) {
        if transaction.is_user_undo_redo() {
            transaction.forward_operations.extend(forward_operations);
            transaction.reverse_operations.extend(reverse_operations);

            let Some(sheet_rect) = sheet_rect_for_compute_and_spills else {
                return;
            };

            if transaction.is_user() {
                self.check_validations(transaction, sheet_rect);
                self.add_compute_operations(transaction, sheet_rect, None);
            }
        }
    }

    // delete any code runs within the sheet_rect.
    pub(crate) fn check_deleted_data_tables(
        &mut self,
        transaction: &mut PendingTransaction,
        sheet_rect: &SheetRect,
    ) {
        if !transaction.is_user() {
            return;
        }

        let Some(sheet) = self.grid.try_sheet(sheet_rect.sheet_id) else {
            // sheet may have been deleted
            return;
        };

        let data_tables_to_delete: Vec<Pos> = sheet
            .data_tables_pos_intersect_rect_sorted((*sheet_rect).into())
            .filter(|pos| {
                // only delete when there's not another code cell in the same position
                // (this maintains the original output until a run completes)
                sheet
                    .cell_value(*pos)
                    .is_none_or(|value| !(value.is_code() || value.is_import()))
            })
            .collect();

        // delete the data tables in reverse order, so that shift_remove is less expensive
        data_tables_to_delete.into_iter().rev().for_each(|pos| {
            self.finalize_data_table(
                transaction,
                pos.to_sheet_pos(sheet_rect.sheet_id),
                None,
                None,
            );
        });
    }

    pub(super) fn execute_set_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) {
        if let Operation::SetDataTable {
            sheet_pos,
            data_table,
            index,
        } = op
        {
            self.finalize_data_table(transaction, sheet_pos, data_table, Some(index));
        }
    }

    /// Adds or replaces a data table at a specific position.
    pub(super) fn execute_add_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::AddDataTable {
            sheet_pos,
            mut data_table,
            cell_value,
            index,
        } = op
        {
            data_table.name = unique_data_table_name(
                data_table.name(),
                false,
                Some(sheet_pos),
                self.a1_context(),
            )
            .into();

            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = Pos::from(sheet_pos);
            let sheet_rect_for_compute_and_spills = data_table.output_sheet_rect(sheet_pos, false);

            // select the entire data table
            Self::select_full_data_table(transaction, sheet_id, data_table_pos, &data_table);

            // update the CellValue
            let old_value = sheet
                .columns
                .set_value(&data_table_pos, cell_value.to_owned());

            // insert the data table into the sheet
            let (old_index, old_data_table, dirty_rects) = sheet.data_table_insert_before(
                index.unwrap_or(usize::MAX),
                &data_table_pos,
                data_table.to_owned(),
            );

            // mark new data table as dirty
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
            self.send_updated_bounds(transaction, sheet_id);

            // mark old data table as dirty, if it exists
            if let Some(old_data_table) = &old_data_table {
                let old_data_table_rect = old_data_table.output_sheet_rect(sheet_pos, false);
                transaction.add_dirty_hashes_from_sheet_rect(old_data_table_rect);
            }

            let forward_operations = vec![Operation::AddDataTable {
                sheet_pos,
                data_table,
                cell_value,
                index,
            }];
            let reverse_operations = vec![
                Operation::SetCellValues {
                    sheet_pos,
                    values: old_value.unwrap_or(CellValue::Blank).into(),
                },
                Operation::SetDataTable {
                    sheet_pos,
                    data_table: old_data_table,
                    index: old_index,
                },
            ];

            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&sheet_rect_for_compute_and_spills),
            );

            return Ok(());
        };

        bail!("Expected Operation::AddDataTable in execute_add_data_table");
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
            let data_table_pos = sheet.data_table_pos_that_contains(pos)?;

            // mark the data table as dirty
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let sheet = self.try_sheet_mut_result(sheet_id)?;

            let index = sheet.data_table_index_result(data_table_pos)?;
            let (data_table, dirty_rects) = sheet.delete_data_table(data_table_pos)?;
            let sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, false)
                .to_sheet_rect(sheet_id);

            let old_cell_value = sheet.cell_value_result(data_table_pos)?;
            sheet.columns.set_value(&data_table_pos, CellValue::Blank);

            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::AddDataTable {
                sheet_pos,
                data_table,
                cell_value: old_cell_value,
                index: Some(index),
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&sheet_rect_for_compute_and_spills),
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
            let data_table_pos = sheet.data_table_pos_that_contains(pos)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;

            if data_table.is_code() {
                dbgjs!(format!("Data table {} is readonly", data_table.name));
                return Ok(());
            }

            let rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);
            let mut old_values = sheet.get_code_cell_values(rect);

            transaction.add_code_cell(sheet_id, data_table_pos);
            transaction.add_dirty_hashes_from_sheet_rect(rect.to_sheet_rect(sheet_id));
            let rows = data_table.get_rows_with_wrap_in_rect(&data_table_pos, &rect, true);
            if !rows.is_empty() {
                let resize_rows = transaction
                    .resize_rows
                    .entry(sheet_pos.sheet_id)
                    .or_default();
                resize_rows.extend(rows);
            }

            pos.y -= data_table.y_adjustment(true);

            let is_sorted = data_table.display_buffer.is_some();

            // if there is a display buffer, use it to find the row index for all the values
            // this is used when the data table has sorted columns, maps input to actual coordinates
            if is_sorted {
                // rebuild CellValues with unsorted coordinates
                let mut values_unsorted = CellValues::new(0, 0);
                let mut old_values_unsorted = CellValues::new(0, 0);

                let rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);
                for y in rect.y_range() {
                    let display_row = y - data_table_pos.y;
                    let actual_row = data_table
                        .get_row_index_from_display_index(u64::try_from(display_row)?)
                        as i64;

                    for x in rect.x_range() {
                        let display_column = x - data_table_pos.x;

                        let value_x = u32::try_from(x - pos.x)?;
                        let value_y = u32::try_from(y - pos.y)?;

                        let x = u32::try_from(display_column)?;
                        let y = u32::try_from(actual_row)?;
                        if let Some(value) = values.remove(value_x, value_y) {
                            values_unsorted.set(x, y, value);
                        }

                        // account for hidden columns
                        let column_index = data_table.get_column_index_from_display_index(x, true);
                        if let Ok(value) = data_table.value.get(column_index, y) {
                            old_values_unsorted.set(x, y, value.to_owned());
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
                old_values = old_values_unsorted;
            }

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
            let (data_table, dirty_rects) =
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

            // Update the old values to match the new sorted data table
            if is_sorted {
                let mut old_sorted_values = CellValues::new(0, 0);
                let rect = Rect::from_numbers(0, 0, old_values.w as i64, old_values.h as i64);
                for x in rect.x_range() {
                    for y in rect.y_range() {
                        let value_x = u32::try_from(x)?;
                        let value_y = u32::try_from(y)?;

                        let display_y = data_table.get_display_index_from_row_index(value_y as u64);

                        if let Some(value) = old_values.remove(value_x, value_y) {
                            old_sorted_values.set(value_x, display_y as u32, value);
                        }
                    }
                }
                old_values = old_sorted_values;
            }

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
                Some(&rect.to_sheet_rect(sheet_id)),
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
            let data_table_pos = sheet.data_table_pos_that_contains(pos)?;

            // mark old data table as dirty
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            // Pull out the data table via a swap, removing it from the sheet
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let index = sheet.data_table_index_result(pos)?;
            let (data_table, dirty_rects) = sheet.delete_data_table(data_table_pos)?;
            let table_name = data_table.name.to_display().clone();
            let cell_value = sheet.cell_value_result(data_table_pos)?;
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
            sheet.set_cell_values(values_rect, values);

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
            )?;
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

            let values_sheet_rect = values_rect.to_sheet_rect(sheet_id);

            self.send_updated_bounds(transaction, sheet_id);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            reverse_operations.push(Operation::AddDataTable {
                sheet_pos,
                data_table,
                cell_value,
                index: Some(index),
            });
            reverse_operations.push(Operation::SetCellValues {
                sheet_pos: data_table_pos.to_sheet_pos(sheet_id),
                values: CellValues::new(
                    data_table_rect.width() as u32,
                    data_table_rect.height() as u32,
                ),
            });
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&values_sheet_rect.union(&data_table_rect)),
            );
            self.check_deleted_data_tables(transaction, &values_sheet_rect);

            // Move any validations that were tied to the table to the sheet
            let mut a1_context = A1Context::default();
            if let Some(table) = self.a1_context.try_table(&table_name) {
                // we only need the table in a separate a1_context (this is
                // done to avoid borrow issues below)
                a1_context.table_map.insert(table.clone());
                let sheet = self.try_sheet_mut_result(sheet_id)?;
                let reverse_operations = sheet
                    .validations
                    .transfer_to_sheet(&table_name, &a1_context);
                if !reverse_operations.is_empty() {
                    transaction.reverse_operations.extend(reverse_operations);
                    transaction.validations.insert(sheet_id);
                }
            }

            return Ok(());
        };

        bail!("Expected Operation::FlattenDataTable in execute_flatten_data_table");
    }

    pub(super) fn execute_code_data_table_to_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SwitchDataTableKind {
            sheet_pos,
            kind,
            value,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains(pos)?;
            let old_cell_value = sheet.cell_value_result(data_table_pos)?.to_owned();

            let old_data_table_kind = sheet.data_table_result(&data_table_pos)?.kind.to_owned();
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.kind = kind;
                Ok(())
            })?;

            let sheet_rect_for_compute_and_spills = data_table.output_sheet_rect(sheet_pos, false);

            sheet.columns.set_value(&data_table_pos, value);

            let sheet = self.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SwitchDataTableKind {
                sheet_pos,
                kind: old_data_table_kind,
                value: old_cell_value,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&sheet_rect_for_compute_and_spills),
            );

            return Ok(());
        };

        bail!("Expected Operation::SwitchDataTableKind in execute_flatten_data_table");
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

            let no_data_table = sheet.enforce_no_data_table_within_rect(sheet_rect.into());

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
            let format_update = data_table.transfer_formats_from_sheet(rect.min, sheet, rect)?;
            data_table.show_name = Some(true);
            data_table.show_columns = Some(true);

            if !format_update.is_default() {
                data_table
                    .formats
                    .get_or_insert_default()
                    .apply_updates(&format_update);
            }
            let data_table_rect = data_table.output_sheet_rect(sheet_pos, true);
            let cell_value = CellValue::Import(import);

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            // delete cell values and formats in rect on sheet
            sheet.columns.delete_values(rect);
            let sheet_format_update =
                sheet
                    .formats
                    .apply_updates(&SheetFormatUpdates::from_selection(
                        &A1Selection::from_rect(rect.to_sheet_rect(sheet_id)),
                        FormatUpdate::cleared(),
                    ));

            // insert data table in sheet
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            sheet.columns.set_value(&sheet_rect.min, cell_value);
            let (_, _, dirty_rects) =
                sheet.data_table_insert_full(&sheet_rect.min, data_table.to_owned());
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            self.check_deleted_data_tables(transaction, &rect.to_sheet_rect(sheet_id));

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
                Some(&sheet_rect.union(&data_table_rect)),
            );

            return Ok(());
        };

        bail!("Expected Operation::GridToDataTable in execute_grid_to_data_table");
    }

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
            name,
            alternating_colors,
            columns,
            show_name,
            show_columns,
        } = op.to_owned()
        {
            // do grid mutations first to keep the borrow checker happy
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.grid.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains(sheet_pos.into())?;
            let data_table_sheet_pos = data_table_pos.to_sheet_pos(sheet_id);
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let old_name = data_table.name().to_string();
            let mut old_columns = data_table.column_headers.to_owned();
            let mut old_alternating_colors = None;
            let mut old_show_name = None;
            let mut old_show_columns = None;

            if let Some(name) = name.to_owned() {
                if old_name != name {
                    // validate table name
                    if let Err(e) =
                        DataTable::validate_table_name(&name, sheet_pos, self.a1_context())
                    {
                        if cfg!(target_family = "wasm") || cfg!(test) {
                            crate::wasm_bindings::js::jsClientMessage(
                                e.to_owned(),
                                JsSnackbarSeverity::Error.to_string(),
                            );
                        }
                        // clear remaining operations
                        transaction.operations.clear();
                        bail!(e);
                    }

                    self.grid.update_data_table_name(
                        data_table_sheet_pos,
                        &old_name,
                        &name,
                        &self.a1_context,
                        false,
                    )?;
                    // mark code cells dirty to update meta data
                    transaction.add_code_cell(sheet_id, data_table_pos);
                }
            }

            // update column names that have changed in code cells
            if let (Some(columns), Some(old_columns)) = (columns.to_owned(), old_columns.as_ref()) {
                for (index, old_column) in old_columns.iter().enumerate() {
                    if let Some(new_column) = columns.get(index) {
                        if old_column.name != new_column.name {
                            // validate column name
                            if let Err(e) = DataTable::validate_column_name(
                                &old_name,
                                index,
                                &new_column.name.to_string(),
                                &self.a1_context,
                            ) {
                                if cfg!(target_family = "wasm") || cfg!(test) {
                                    crate::wasm_bindings::js::jsClientMessage(
                                        e.to_owned(),
                                        JsSnackbarSeverity::Error.to_string(),
                                    );
                                }
                                // clear remaining operations
                                transaction.operations.clear();
                                bail!(e);
                            }

                            self.grid.replace_table_column_name_in_code_cells(
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

            let sheet = self.grid.try_sheet_result(sheet_id)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(data_table_pos, false)
                .to_sheet_rect(sheet_id);

            let (_, dirty_rects) = self
                .grid
                .try_sheet_mut_result(sheet_id)?
                .modify_data_table_at(&data_table_pos, |dt| {
                    if columns.is_some() || show_name.is_some() || show_columns.is_some() {
                        dt.add_dirty_fills_and_borders(transaction, sheet_id);
                        transaction.add_dirty_hashes_from_sheet_rect(data_table_rect);
                        sheet_rect_for_compute_and_spills = Some(&data_table_rect);
                    }

                    // if the header is first row, update the column names in the data table value
                    if dt.header_is_first_row {
                        if let Some(columns) = columns.as_ref() {
                            for (index, column) in columns.iter().enumerate() {
                                dt.set_cell_value_at(index as u32, 0, column.name.to_owned());
                            }
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
                self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
                self.send_updated_bounds(transaction, sheet_id);
            }

            let sheet = self.grid.try_sheet_result(sheet_id)?;
            transaction.add_dirty_hashes_from_dirty_code_rects(sheet, dirty_rects);

            let forward_operations = vec![op];
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
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.data_table_pos_that_contains(sheet_pos.into())?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            let sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            let old_sort = data_table.sort.to_owned();
            let old_display_buffer = data_table.display_buffer.to_owned();
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
                Some(&sheet_rect_for_compute_and_spills),
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
            let data_table_pos = sheet.data_table_pos_that_contains(sheet_pos.into())?;
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

                let mut format_update = SheetFormatUpdates::default();

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
                    let has_code_cell = cell_values.iter().any(|cell_value| {
                        cell_value.is_code()
                            || cell_value.is_import()
                            || cell_value.is_image()
                            || cell_value.is_html()
                    });

                    if has_code_cell {
                        if cfg!(target_family = "wasm") || cfg!(test) {
                            crate::wasm_bindings::js::jsClientMessage(
                                "Cannot add code cell to table".to_string(),
                                JsSnackbarSeverity::Error.to_string(),
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

                    format_update = data_table.transfer_formats_from_sheet(
                        data_table_pos,
                        sheet,
                        formats_rect,
                    )?;

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
                    let old_sheet_values = sheet.columns.delete_values(values_rect);
                    reverse_operations.push(Operation::SetCellValues {
                        sheet_pos: values_rect.min.to_sheet_pos(sheet_id),
                        values: old_sheet_values.into(),
                    });
                    self.check_deleted_data_tables(
                        transaction,
                        &values_rect.to_sheet_rect(sheet_id),
                    );
                }

                let sheet = self.try_sheet_mut_result(sheet_id)?;
                let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                    if dt.header_is_first_row && column_header.is_none() {
                        if let Some(values) = &values {
                            let first_value = values[0].to_owned();
                            if !matches!(first_value, CellValue::Blank) {
                                column_header = Some(first_value.to_string());
                            }
                        }
                    }

                    dt.insert_column_sorted(index as usize, column_header, values)?;

                    if !format_update.is_default() {
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
                Some(&sheet_rect_for_compute_and_spills),
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
            let data_table_pos = sheet.data_table_pos_that_contains(sheet_pos.into())?;
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

                    if show_columns {
                        if let Some(column_header) = &old_column_header {
                            if let (Ok(value_x), Ok(value_y)) =
                                (u32::try_from(display_index - 1), u32::try_from(0))
                            {
                                sheet_cell_values.set(
                                    value_x,
                                    value_y,
                                    column_header.to_owned().into(),
                                );
                            }
                        }
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
                    )?;
                }

                let formats_rect =
                    Rect::from_numbers(index as i64 + 1, 1, 1, data_table.height(true) as i64);
                rects_to_remove.push(formats_rect);

                let old_values = data_table.get_column_sorted(index as usize)?;
                reverse_columns.push((index, old_column_header, Some(old_values)));
            }

            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            data_table.add_dirty_fills_and_borders(transaction, sheet_id);

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
                        deleted_selection,
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
                Some(&sheet_rect_for_compute_and_spills),
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
            let data_table_pos = sheet.data_table_pos_that_contains(sheet_pos.into())?;

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

                let mut format_update = SheetFormatUpdates::default();

                if swallow && values.is_none() {
                    // check for code cells in neighboring cells
                    let sheet_values_array = sheet.cell_values_in_rect(&values_rect, true)?;
                    let cell_values = sheet_values_array.into_cell_values_vec().into_vec();
                    let has_code_cell = cell_values.iter().any(|value| {
                        value.is_code() || value.is_import() || value.is_image() || value.is_html()
                    });
                    if has_code_cell {
                        if cfg!(target_family = "wasm") || cfg!(test) {
                            crate::wasm_bindings::js::jsClientMessage(
                                "Cannot add code cell to table".to_string(),
                                JsSnackbarSeverity::Error.to_string(),
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
                    format_update = data_table.transfer_formats_from_sheet(
                        data_table_pos,
                        sheet,
                        values_rect,
                    )?;

                    let sheet = self.try_sheet_mut_result(sheet_id)?;

                    // clear sheet values
                    sheet.columns.delete_values(values_rect);
                    // clear sheet formats
                    sheet
                        .formats
                        .apply_updates(&SheetFormatUpdates::from_selection(
                            &A1Selection::from_rect(values_rect.to_sheet_rect(sheet_id)),
                            FormatUpdate::cleared(),
                        ));
                    self.check_deleted_data_tables(
                        transaction,
                        &values_rect.to_sheet_rect(sheet_id),
                    );
                }

                let sheet = self.try_sheet_mut_result(sheet_id)?;
                let (_, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                    dt.insert_row(index as usize, values)?;

                    if !format_update.is_default() {
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
                Some(&sheet_rect_for_compute_and_spills),
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
            let data_table_pos = sheet.data_table_pos_that_contains(sheet_pos.into())?;
            let data_table = sheet.data_table_result(&data_table_pos)?;

            // check if the rows to delete are part of the data table's UI, bail if so
            // we need rows relative to the data table, not the sheet, hence (0, 0)
            let ui_rows = data_table.ui_rows((0, 0).into());
            if !ui_rows.is_empty() && rows.iter().any(|row| ui_rows.contains(&(*row as i64))) {
                let e = "delete_rows_error".to_string();
                if transaction.is_user_undo_redo() && cfg!(target_family = "wasm") {
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
                    )?;
                }

                let actual_row_index = get_unsorted_row_index(data_table, index);
                let formats_rect =
                    Rect::from_numbers(1, actual_row_index + 1, data_table.width() as i64, 1);
                data_table_formats_rects.push(formats_rect);
            }

            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            data_table.add_dirty_fills_and_borders(transaction, sheet_id);

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
                Some(&sheet_rect_for_compute_and_spills),
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
            let data_table_pos = sheet.data_table_pos_that_contains(sheet_pos.into())?;
            let data_table = sheet.data_table_result(&data_table_pos)?;
            if data_table.header_is_first_row == first_row_is_header {
                return Ok(());
            }

            // mark dirty if the first row is not the header, so that largest rect gets marked dirty
            if !data_table.header_is_first_row {
                self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
            }

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let (data_table, dirty_rects) = sheet.modify_data_table_at(&data_table_pos, |dt| {
                dt.toggle_first_row_as_header(first_row_is_header);
                Ok(())
            })?;

            let sheet_rect_for_compute_and_spills = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            // mark dirty if the first row is not the header, so that largest rect gets marked dirty
            if !data_table.header_is_first_row {
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
                Some(&sheet_rect_for_compute_and_spills),
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
            let sheet_id = sheet_pos.sheet_id;

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet_pos.into();

            let mut forward_operations = vec![];
            let mut reverse_operations = vec![];

            sheet.modify_data_table_at(&data_table_pos, |dt| {
                let reverse_formats = dt.formats.get_or_insert_default().apply_updates(&formats);
                dt.mark_formats_dirty(
                    transaction,
                    data_table_pos.to_sheet_pos(sheet_id),
                    &formats,
                    &reverse_formats,
                );

                if transaction.is_user_undo_redo() {
                    forward_operations.push(op);

                    reverse_operations.push(Operation::DataTableFormats {
                        sheet_pos,
                        formats: reverse_formats,
                    });
                }

                Ok(())
            })?;

            if transaction.is_user_undo_redo() {
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

                if transaction.is_user_undo_redo() {
                    forward_operations.push(op);

                    reverse_operations.push(Operation::DataTableBorders {
                        sheet_pos,
                        borders: reverse_borders,
                    });
                }

                Ok(())
            })?;

            if transaction.is_user_undo_redo() {
                transaction.generate_thumbnail |= self.thumbnail_dirty_borders(sheet_id, &borders);
            }

            self.data_table_operations(transaction, forward_operations, reverse_operations, None);

            return Ok(());
        };

        bail!("Expected Operation::DataTableBorders in execute_data_table_borders");
    }
}

#[cfg(test)]
pub(crate) mod tests {
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
            CodeCellLanguage, CodeCellValue, CodeRun, DataTableKind, SheetId,
            column_header::DataTableColumnHeader,
            data_table::sort::{DataTableSort, SortDirection},
        },
        test_util::{assert_cell_value_row, assert_display_cell_value, print_table_in_rect},
        wasm_bindings::js::{clear_js_calls, expect_js_call},
    };

    use super::*;

    #[track_caller]
    pub(crate) fn flatten_data_table<'a>(
        gc: &'a mut GridController,
        sheet_id: SheetId,
        pos: Pos,
        file_name: &'a str,
    ) {
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let op = Operation::FlattenDataTable { sheet_pos };

        assert_simple_csv(gc, sheet_id, pos, file_name);

        gc.start_user_transaction(vec![op], None, TransactionName::FlattenDataTable);

        assert!(
            gc.sheet(sheet_id)
                .data_table_pos_that_contains(pos)
                .is_err()
        );

        assert_flattened_simple_csv(gc, sheet_id, pos, file_name);

        print_table_in_rect(gc, sheet_id, Rect::new(1, 1, 4, 12));
    }

    #[track_caller]
    pub(crate) fn assert_flattened_simple_csv<'a>(
        gc: &'a GridController,
        sheet_id: SheetId,
        pos: Pos,
        file_name: &'a str,
    ) -> (&'a GridController, SheetId, Pos, &'a str) {
        // there should be no data tables
        assert!(
            gc.sheet(sheet_id)
                .data_table_pos_that_contains(pos)
                .is_err()
        );

        let first_row = vec!["city", "region", "country", "population"];
        assert_cell_value_row(gc, sheet_id, 1, 4, pos.y + 1, first_row);

        let last_row = vec!["Concord", "NH", "United States", "42605"];
        assert_cell_value_row(gc, sheet_id, 1, 4, pos.y + 11, last_row);

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
        assert_cell_value_row(gc, sheet_id, 1, 3, 3, first_row);

        let second_row = vec!["Marlborough", "MA", "United States", "38334"];
        assert_cell_value_row(gc, sheet_id, 1, 3, 4, second_row);

        let third_row = vec!["Northbridge", "MA", "United States", "14061"];
        assert_cell_value_row(gc, sheet_id, 1, 3, 5, third_row);

        let last_row = vec!["Westborough", "MA", "United States", "29313"];
        assert_cell_value_row(gc, sheet_id, 1, 3, 12, last_row);
        (gc, sheet_id, pos, file_name)
    }

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
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 11));

        flatten_data_table(&mut gc, sheet_id, pos, file_name);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // undo, the value should be a data table again
        gc.undo(None);
        assert_simple_csv(&gc, sheet_id, pos, file_name);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 11));

        // redo, the value should be on the grid
        gc.redo(None);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 11));
    }

    #[test]
    fn test_execute_flatten_data_table_with_first_row_as_header() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv();
        assert_simple_csv(&gc, sheet_id, pos, file_name);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 3, 11));

        let sheet_pos = pos.to_sheet_pos(sheet_id);
        gc.test_data_table_first_row_as_header(sheet_pos, false);

        let op = Operation::FlattenDataTable { sheet_pos };
        gc.start_user_transaction(vec![op], None, TransactionName::FlattenDataTable);

        gc.undo(None);

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
        let checkbox = test_create_checkbox(&mut gc, selection);
        assert_validation_id(&gc, pos![sheet_id!a3], Some(checkbox.id));

        gc.flatten_data_table(pos![sheet_id!a1], None);
        assert_validation_id(&gc, pos![sheet_id!a3], Some(checkbox.id));
    }

    #[test]
    fn test_execute_code_data_table_to_data_table() {
        let code_run = CodeRun {
            language: CodeCellLanguage::Javascript,
            code: "return [1,2,3]".into(),
            std_err: None,
            std_out: None,
            error: None,
            return_type: Some("number".into()),
            line_number: None,
            output_type: None,
            cells_accessed: Default::default(),
        };
        let data_table = DataTable::new(
            DataTableKind::CodeRun(code_run.clone()),
            "Table 1",
            Value::Array(Array::from(vec![vec!["1", "2", "3"]])),
            false,
            Some(true),
            Some(true),
            None,
        );

        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 1, y: 1 };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_table_insert_full(&pos, data_table);
        let code_cell_value = CodeCellValue {
            language: CodeCellLanguage::Javascript,
            code: "return [1,2,3]".into(),
        };
        sheet.set_cell_value(pos, CellValue::Code(code_cell_value.clone()));
        let data_table_pos = sheet.data_table_pos_that_contains(pos).unwrap();
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let expected = vec!["1", "2", "3"];

        // initial value
        assert_cell_value_row(&gc, sheet_id, 1, 3, 3, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table_at(&data_table_pos).unwrap();
        assert_eq!(data_table.kind, DataTableKind::CodeRun(code_run.clone()));

        let import = Import::new("".into());
        let kind = DataTableKind::Import(import.to_owned());
        let op = Operation::SwitchDataTableKind {
            sheet_pos,
            kind: kind.clone(),
            value: CellValue::Import(import),
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
        let (mut gc, sheet_id, pos, file_name) = simple_csv();
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 11));

        flatten_data_table(&mut gc, sheet_id, pos, file_name);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        let new_pos = Pos::new(pos.x, pos.y + 1);
        let max = Pos::new(4, 12);
        let sheet_pos = SheetPos::from((new_pos, sheet_id));
        let sheet_rect = SheetRect::new_pos_span(new_pos, max, sheet_id);
        let op = Operation::GridToDataTable { sheet_rect };
        let mut transaction = PendingTransaction::default();
        gc.execute_grid_to_data_table(&mut transaction, op.clone())
            .unwrap();
        gc.data_table_first_row_as_header(sheet_pos, true, None);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 13));
        assert_simple_csv(&gc, sheet_id, new_pos, file_name);

        // undo, the value should be on the grid again
        execute_reverse_operations(&mut gc, &transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 13));
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // redo, the value should be a data table again
        execute_forward_operations(&mut gc, &mut transaction);
        gc.data_table_first_row_as_header(sheet_pos, true, None);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 13));
        assert_simple_csv(&gc, sheet_id, new_pos, file_name);

        // undo, the value should be on th grid again
        execute_reverse_operations(&mut gc, &transaction);
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 13));
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // create a formula cell in the grid data table
        let formula_pos = SheetPos::new(sheet_id, 1, 3);
        gc.set_code_cell(
            formula_pos,
            CodeCellLanguage::Formula,
            "=1+1".into(),
            None,
            None,
        );
        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 13));

        // there should only be 1 data table, the formula data table
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 1);

        // expect that a data table is not created
        gc.execute_grid_to_data_table(&mut transaction, op).unwrap();

        // there should only be 1 data table, the formula data table
        assert_eq!(gc.grid.sheets()[0].data_tables.len(), 1);
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
        let op = Operation::DataTableMeta {
            sheet_pos,
            name: Some(updated_name.into()),
            alternating_colors: None,
            columns: None,
            show_ui: None,
            show_name: None,
            show_columns: None,
            readonly: None,
        };
        gc.start_user_transaction(vec![op.to_owned()], None, TransactionName::DataTableMeta);

        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        assert_eq!(&data_table.name().to_string(), updated_name);
        println!("Updated data table name: {}", &data_table.name);

        // undo, the value should be the initial name
        gc.undo(None);
        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        assert_eq!(&data_table.name().to_string(), "simple.csv");
        println!("Initial data table name: {}", &data_table.name);

        // redo, the value should be the updated name
        {
            gc.redo(None);
            let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
            assert_eq!(&data_table.name().to_string(), updated_name);
            println!("Updated data table name: {}", &data_table.name);
        }

        // ensure names are unique
        gc.start_user_transaction(vec![op.to_owned()], None, TransactionName::DataTableMeta);
        let data_table = gc.sheet_mut(sheet_id).data_table_at(&pos).unwrap();
        assert_eq!(&data_table.name().to_string(), "My_Table");

        // ensure numbers aren't added for unique names
        let op = Operation::DataTableMeta {
            sheet_pos,
            name: Some("ABC".into()),
            alternating_colors: None,
            columns: None,
            show_ui: None,
            show_name: None,
            show_columns: None,
            readonly: None,
        };
        gc.start_user_transaction(vec![op.to_owned()], None, TransactionName::DataTableMeta);
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

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 11));

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

        print_table_in_rect(&gc, sheet_id, Rect::new(1, 1, 4, 12));
        assert_data_table_row_height(&gc, sheet_id, pos, 10, index, values.clone());

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.edit_code_value(pos!(B9), &gc.a1_context).is_some());
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
        );
        gc.set_code_cell(
            pos!(I5).to_sheet_pos(sheet_id),
            CodeCellLanguage::Formula,
            "2+2".to_string(),
            None,
            None,
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
                JsSnackbarSeverity::Error
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
                JsSnackbarSeverity::Error
            ),
            true,
        );
    }

    #[test]
    fn test_execute_insert_column_row_over_data_table() {
        clear_js_calls();

        let (mut gc, sheet_id, pos, _) = simple_csv_at(pos!(E2));

        let sheet = gc.sheet_mut(sheet_id);

        sheet.set_cell_value(pos!(F14), CellValue::Import(Import::new("table1".into())));
        sheet.set_cell_value(pos!(I5), CellValue::Import(Import::new("table2".into())));

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.cell_value(pos!(F14)),
            Some(CellValue::Import(Import::new("table1".into())))
        );
        assert_eq!(
            sheet.cell_value(pos!(I5)),
            Some(CellValue::Import(Import::new("table2".into())))
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
                JsSnackbarSeverity::Error
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
                JsSnackbarSeverity::Error
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
        let validation = test_create_checkbox(&mut gc, selection);

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
        );

        assert_validation_id(&gc, checkbox_pos, None);

        // ensure the new column does not have a checkbox validation
        gc.data_table_insert_columns(sheet_pos, vec![0], false, None, None, None);
        assert_validation_id(&gc, checkbox_pos, None);

        assert_validation_count(&gc, sheet_id, 0);
    }
}
