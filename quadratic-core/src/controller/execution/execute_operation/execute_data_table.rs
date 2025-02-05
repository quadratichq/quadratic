use crate::{
    a1::A1Selection,
    cell_values::CellValues,
    cellvalue::Import,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::{
        formats::{FormatUpdate, SheetFormatUpdates},
        js_types::JsSnackbarSeverity,
        DataTable, DataTableKind, SheetId,
    },
    Array, ArraySize, CellValue, Pos, Rect, SheetRect,
};

use anyhow::{bail, Result};

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
            transaction
                .add_update_selection(A1Selection::table(sheet_pos, &data_table.name.to_display()));
        }
    }

    fn mark_data_table_dirty(
        &self,
        transaction: &mut PendingTransaction,
        sheet_id: SheetId,
        data_table_pos: Pos,
    ) -> Result<()> {
        if !(cfg!(target_family = "wasm") || cfg!(test)) || transaction.is_server() {
            return Ok(());
        }

        let sheet = self.try_sheet_result(sheet_id)?;
        let data_table = sheet.data_table_result(data_table_pos)?;
        data_table.add_dirty_table(transaction, sheet, data_table_pos)?;

        let data_table_rect =
            data_table.output_sheet_rect(data_table_pos.to_sheet_pos(sheet_id), false);
        transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(data_table_rect);

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
                self.add_compute_operations(transaction, sheet_rect, None);
                self.check_all_spills(transaction, sheet_rect.sheet_id);
            }
        }
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
                        if matches!(value, CellValue::Code(_))
                            || matches!(value, CellValue::Import(_))
                        {
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
            self.finalize_data_table(transaction, pos.to_sheet_pos(sheet_id), None, None);
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

    pub(super) fn execute_add_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::AddDataTable {
            sheet_pos,
            data_table,
            cell_value,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = Pos::from(sheet_pos);
            let mut data_table_rect = data_table.output_sheet_rect(sheet_pos, false);

            // mark table fills and borders as dirty
            data_table.add_dirty_fills_and_borders(transaction, sheet_id);

            let old_values = sheet.delete_cell_values(data_table_rect.into());

            sheet.set_cell_value(data_table_pos, cell_value);
            sheet.data_tables.insert_sorted(data_table_pos, data_table);

            // mark new data table as dirty
            self.send_updated_bounds(sheet_id);
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let forward_operations = vec![op];
            let reverse_operations = vec![
                Operation::DeleteDataTable { sheet_pos },
                Operation::SetCellValues {
                    sheet_pos,
                    values: old_values.into(),
                },
            ];

            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_rect),
            );

            // Sets the cursor to the entire table, including the new header
            if transaction.is_user() {
                data_table_rect.max.y += 1;
                transaction.add_update_selection(A1Selection::from_rect(data_table_rect));
            }

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
            self.finalize_data_table(transaction, sheet_pos, None, None);

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
            sheet_pos,
            mut values,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let mut pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(pos)?;
            let data_table = sheet.data_table_result(data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(data_table_pos, false)
                .to_sheet_rect(sheet_id);

            if data_table.readonly {
                dbgjs!(format!("Data table {} is readonly", data_table.name));
                return Ok(());
            }

            let rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);
            let old_values = sheet.get_code_cell_values(rect);

            pos.y -= data_table.y_adjustment(true);

            // if there is a display buffer, use it to find the row index for all the values
            // this is used when the data table has sorted columns, maps input to actual coordinates
            if data_table.display_buffer.is_some() {
                let rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);

                // rebuild CellValues with actual coordinates
                let mut actual_values = CellValues::new(0, 0);

                for y in rect.y_range() {
                    let display_row = y - data_table_pos.y;
                    let actual_row = data_table.transmute_index(u64::try_from(display_row)?) as i64;

                    for x in rect.x_range() {
                        let display_column = x - data_table_pos.x;

                        let value_x = u32::try_from(x - pos.x)?;
                        let value_y = u32::try_from(y - pos.y)?;

                        if let Some(value) = values.remove(value_x, value_y) {
                            let x = u32::try_from(display_column)?;
                            let y = u32::try_from(actual_row)?;
                            actual_values.set(x, y, value);
                        }
                    }
                }

                pos = data_table_pos;
                values = actual_values;
            }

            // check if any column is hidden, shift values to account for hidden columns
            if data_table
                .column_headers
                .as_ref()
                .is_some_and(|headers| headers.iter().any(|header| !header.display))
            {
                let rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);

                // rebuild CellValues with actual coordinates
                let mut actual_values = CellValues::new(0, 0);

                for x in rect.x_range() {
                    let display_column = u32::try_from(x - data_table_pos.x)?;
                    let column_index =
                        data_table.get_column_index_from_display_index(display_column);

                    for y in rect.y_range() {
                        let row_index: u32 = u32::try_from(y - data_table_pos.y)?;

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

            // send the new value
            sheet.set_code_cell_values(pos, values);

            // mark new data table as dirty
            self.send_updated_bounds(sheet_id);
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SetDataTableAt {
                sheet_pos,
                values: old_values,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_rect),
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
            let data_table_pos = sheet.first_data_table_within(pos)?;

            // mark old data table as dirty
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            // Pull out the data table via a swap, removing it from the sheet
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table = sheet.delete_data_table(data_table_pos)?;
            let cell_value = sheet.cell_value_result(data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(data_table_pos, false)
                .to_sheet_rect(sheet_id);

            let mut values = data_table.display_value(false)?.into_array()?;
            let ArraySize { w, h } = values.size();

            if !data_table.header_is_first_row && data_table.show_ui && data_table.show_columns {
                let headers = data_table.column_headers_to_cell_values();
                values.insert_row(0, headers)?;
            }

            // delete the heading row if toggled off
            if data_table.header_is_first_row && (!data_table.show_ui || !data_table.show_columns) {
                values.delete_row(0)?;
            }

            // insert the heading row if toggled on
            if data_table.show_ui && data_table.show_name {
                let mut table_row = vec![CellValue::Blank; w.get() as usize];
                table_row[0] = data_table.name.to_owned();
                values.insert_row(0, Some(table_row))?;
            }

            let max = Pos {
                x: data_table_pos.x - 1 + w.get() as i64,
                y: data_table_pos.y - 1 + h.get() as i64,
            };
            let sheet_rect = SheetRect::new_pos_span(data_table_pos, max, sheet_id);
            let rect = Rect::from(sheet_rect);

            let _ = sheet.set_cell_values(rect, &values);

            // send updated bounds to the client after flattening the data table
            self.send_updated_bounds(sheet_id);

            // mark new grid rect as dirty
            transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);

            // mark table fills and borders as dirty
            data_table.add_dirty_fills_and_borders(transaction, sheet_id);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::AddDataTable {
                sheet_pos,
                data_table,
                cell_value,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&sheet_rect.union(&data_table_rect)),
            );
            self.check_deleted_data_tables(transaction, &sheet_rect);

            return Ok(());
        };

        bail!("Expected Operation::FlattenDataTable in execute_flatten_data_table");
    }

    pub(super) fn execute_code_data_table_to_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SwitchDataTableKind { sheet_pos, kind } = op.to_owned() {
            let sheet_id = sheet_pos.sheet_id;
            let pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(pos)?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            let old_data_table_kind = data_table.kind.to_owned();
            let sheet_rect = data_table.output_sheet_rect(sheet_pos, false);

            data_table.kind = match old_data_table_kind {
                DataTableKind::CodeRun(_) => match kind {
                    DataTableKind::CodeRun(_) => kind,
                    DataTableKind::Import(import) => DataTableKind::Import(import),
                },
                DataTableKind::Import(_) => match kind {
                    DataTableKind::CodeRun(code_run) => DataTableKind::CodeRun(code_run),
                    DataTableKind::Import(_) => kind,
                },
            };

            // mark code cell as dirty
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
                Some(&sheet_rect),
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

            let import = Import::new(self.grid.next_data_table_name());
            let data_table =
                DataTable::from((import.to_owned(), old_values.to_owned(), &self.grid));
            let data_table_rect = data_table.output_sheet_rect(sheet_pos, true);
            let cell_value = CellValue::Import(import);

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            sheet.delete_cell_values(rect);
            sheet.set_cell_value(sheet_rect.min, cell_value);
            sheet
                .data_tables
                .insert_sorted(sheet_rect.min, data_table.to_owned());

            // mark deleted cells as dirty
            transaction.add_dirty_hashes_from_sheet_rect(sheet_rect);

            // mark new data table as dirty
            self.send_updated_bounds(sheet_id);
            self.mark_data_table_dirty(transaction, sheet_id, sheet_rect.min)?;

            let forward_operations = vec![op];
            let reverse_operations = vec![
                Operation::DeleteDataTable { sheet_pos },
                Operation::SetCellValues {
                    sheet_pos,
                    values: old_values.into(),
                },
            ];

            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&sheet_rect.union(&data_table_rect)),
            );

            // Sets the cursor to the entire table, including the new header
            if transaction.is_user() {
                let mut sheet_rect = sheet_rect.to_owned();
                sheet_rect.max.y += 2;
                transaction.add_update_selection(A1Selection::table(
                    sheet_rect.min.to_sheet_pos(sheet_id),
                    &data_table.name.to_display(),
                ));
            }

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
        } = op.to_owned()
        {
            // do grid mutations first to keep the borrow checker happy
            let sheet_id = sheet_pos.sheet_id;
            let pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table_sheet_pos = data_table_pos.to_sheet_pos(sheet_id);
            let old_name = self
                .grid
                .data_table(sheet_id, data_table_pos)?
                .name
                .to_display();

            if let Some(name) = name {
                self.grid
                    .update_data_table_name(data_table_sheet_pos, &old_name, &name, false)?;
                // mark code cells dirty to update meta data
                transaction.add_code_cell(sheet_id, pos);
            }

            let old_data_table = self.grid.data_table(sheet_id, pos)?;
            let old_columns = old_data_table.column_headers.to_owned();

            // update column names that have changed in code cells
            if let (Some(columns), Some(old_columns)) = (columns.to_owned(), old_columns) {
                for (index, old_column) in old_columns.iter().enumerate() {
                    if let Some(new_column) = columns.get(index) {
                        if old_column.name != new_column.name {
                            self.grid.replace_data_table_column_name_in_code_cells(
                                &old_column.name.to_string(),
                                &new_column.name.to_string(),
                            );
                        }
                    }
                }
            }

            let data_table = self
                .try_sheet_mut_result(sheet_id)?
                .data_table_mut(data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            // if the header is first row, update the column names in the data table value
            if data_table.header_is_first_row {
                if let Some(columns) = columns.as_ref() {
                    for (index, column) in columns.iter().enumerate() {
                        data_table.set_cell_value_at(index as u32, 0, column.name.to_owned());
                    }
                }
            }

            let old_alternating_colors = alternating_colors.map(|alternating_colors| {
                // mark code cell dirty to update alternating color
                transaction.add_code_cell(sheet_id, pos);
                std::mem::replace(&mut data_table.alternating_colors, alternating_colors)
            });

            if show_ui.is_some()
                || show_name.is_some()
                || show_columns.is_some()
                || columns.is_some()
            {
                data_table.add_dirty_fills_and_borders(transaction, sheet_id);
                transaction.add_dirty_hashes_from_sheet_rect(data_table_rect);
            }

            let old_columns = columns.to_owned().and_then(|columns| {
                let old_columns = std::mem::replace(&mut data_table.column_headers, Some(columns));
                data_table.normalize_column_header_names();
                // mark code cells as dirty to updata meta data
                transaction.add_code_cell(sheet_id, pos);
                old_columns
            });

            let old_show_ui = show_ui
                .as_ref()
                .map(|show_ui| std::mem::replace(&mut data_table.show_ui, *show_ui));

            let old_show_name = show_name
                .as_ref()
                .map(|show_name| std::mem::replace(&mut data_table.show_name, *show_name));

            let old_show_columns = show_columns
                .as_ref()
                .map(|show_columns| std::mem::replace(&mut data_table.show_columns, *show_columns));

            let data_table_rect = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            // changing these options shifts the entire data table, need to mark the entire data table as dirty
            if show_ui.is_some()
                || show_name.is_some()
                || show_columns.is_some()
                || columns.is_some()
            {
                self.send_updated_bounds(sheet_id);
                self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;
            }

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DataTableMeta {
                sheet_pos,
                name: Some(old_name),
                alternating_colors: old_alternating_colors,
                columns: old_columns,
                show_ui: old_show_ui,
                show_name: old_show_name,
                show_columns: old_show_columns,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_rect),
            );

            return Ok(());
        };

        bail!("Expected Operation::DataTableMeta in execute_data_table_meta");
    }

    pub(super) fn execute_sort_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SortDataTable { sheet_pos, sort } = op.to_owned() {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            let data_table_sheet_rect = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            let old_value = data_table.sort.to_owned();
            data_table.sort = sort.and_then(|sort| if sort.is_empty() { None } else { Some(sort) });
            data_table.sort_all()?;

            data_table.add_dirty_fills_and_borders(transaction, sheet_id);
            self.send_updated_bounds(sheet_id);
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SortDataTable {
                sheet_pos,
                sort: old_value,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_sheet_rect),
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
        if let Operation::InsertDataTableColumn {
            sheet_pos,
            index,
            mut column_header,
            mut values,
            swallow,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_result(data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            let column_index = data_table.get_column_index_from_display_index(index);

            let values_rect = Rect::from_numbers(
                data_table_pos.x + index as i64,
                data_table_pos.y + data_table.y_adjustment(true),
                1,
                data_table_rect.height() as i64 - data_table.y_adjustment(true),
            );

            transaction.add_dirty_hashes_from_sheet_rect(values_rect.to_sheet_rect(sheet_id));
            transaction.add_code_cell(sheet_id, data_table_pos);

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
                    values = Some(cell_values);
                }

                // swallow sheet formatting
                for x in values_rect.x_range() {
                    let format_display_x = u32::try_from(x - data_table_pos.x)?;
                    let format_actual_x =
                        data_table.get_column_index_from_display_index(format_display_x);

                    for y in values_rect.y_range() {
                        let format_display_y =
                            u64::try_from(y - data_table_pos.y - data_table.y_adjustment(true))?;
                        let format_actual_y = data_table.transmute_index(format_display_y);

                        let format = sheet.formats.format((x, y).into());
                        if !format.is_default() {
                            format_update.set_format_cell(
                                (format_actual_x as i64 + 1, format_actual_y as i64 + 1).into(),
                                format.into(),
                            );
                        }
                    }
                }

                // clear sheet values
                let _ = sheet.delete_cell_values(values_rect);
                // clear sheet formats
                sheet
                    .formats
                    .apply_updates(&SheetFormatUpdates::from_selection(
                        &A1Selection::from_rect(values_rect.to_sheet_rect(sheet_id)),
                        FormatUpdate::cleared(),
                    ));
            }

            let data_table = sheet.data_table_mut(data_table_pos)?;
            if data_table.header_is_first_row && column_header.is_none() {
                if let Some(values) = &values {
                    let first_value = values[0].to_owned();
                    if !matches!(first_value, CellValue::Blank) {
                        column_header = Some(first_value.to_string());
                    }
                }
            }
            data_table.insert_column_sorted(column_index as usize, column_header, values)?;
            if !format_update.is_default() {
                data_table.formats.apply_updates(&format_update);
            }

            Self::select_full_data_table(transaction, sheet_id, data_table_pos, data_table);
            data_table.add_dirty_fills_and_borders(transaction, sheet_id);
            self.send_updated_bounds(sheet_id);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DeleteDataTableColumn {
                sheet_pos,
                index,
                flatten: swallow,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_rect),
            );

            return Ok(());
        };

        bail!("Expected Operation::InsertDataTableColumn in execute_insert_data_table_column");
    }

    pub(super) fn execute_delete_data_table_column(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DeleteDataTableColumn {
            sheet_pos,
            index,
            flatten,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_result(data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            let column_index = data_table.get_column_index_from_display_index(index);
            let old_values = data_table.get_column_sorted(column_index as usize)?;
            let old_column_header = data_table
                .get_column_header(column_index as usize)
                .map(|header| header.name.to_owned().to_string());
            let values_rect = Rect::from_numbers(
                data_table_pos.x + index as i64,
                data_table_pos.y + data_table.y_adjustment(true),
                1,
                old_values.len() as i64,
            );

            transaction.add_dirty_hashes_from_sheet_rect(values_rect.to_sheet_rect(sheet_id));
            transaction.add_code_cell(sheet_id, data_table_pos);
            data_table.add_dirty_fills_and_borders(transaction, sheet_id);

            if flatten && !old_values.is_empty() {
                // flatten the values
                let values = Array::from(
                    old_values
                        .iter()
                        .map(|v| vec![v.to_owned()])
                        .collect::<Vec<Vec<_>>>(),
                );

                // flatten the formats
                let mut format_update = SheetFormatUpdates::default();
                for x in values_rect.x_range() {
                    let format_display_x = u32::try_from(x - data_table_pos.x)?;
                    let format_actual_x =
                        data_table.get_column_index_from_display_index(format_display_x);

                    for y in values_rect.y_range() {
                        let format_display_y =
                            u64::try_from(y - data_table_pos.y - data_table.y_adjustment(true))?;
                        let format_actual_y = data_table.transmute_index(format_display_y);

                        let format = data_table.formats.format(
                            (format_actual_x as i64 + 1, format_actual_y as i64 + 1).into(),
                        );
                        if !format.is_default() {
                            format_update.set_format_cell((x, y).into(), format.into());
                        }
                    }
                }

                let _ = sheet.set_cell_values(values_rect, &values);
                drop(values);

                if !format_update.is_default() {
                    sheet.formats.apply_updates(&format_update);
                }
            }

            let data_table = sheet.data_table_mut(data_table_pos)?;
            data_table.delete_column(column_index as usize)?;

            Self::select_full_data_table(transaction, sheet_id, data_table_pos, data_table);
            self.send_updated_bounds(sheet_id);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::InsertDataTableColumn {
                sheet_pos,
                index,
                column_header: if flatten { None } else { old_column_header },
                values: if flatten { None } else { Some(old_values) },
                swallow: flatten,
            }];

            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_rect),
            );

            return Ok(());
        };

        bail!("Expected Operation::DeleteDataTableColumn in execute_delete_data_table_column");
    }

    pub(super) fn execute_insert_data_table_row(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::InsertDataTableRow {
            sheet_pos,
            index,
            mut values,
            swallow,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_result(data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            let values_rect = Rect::from_numbers(
                data_table_pos.x,
                data_table_rect.max.y + 1,
                data_table_rect.width() as i64,
                1,
            );

            transaction.add_dirty_hashes_from_sheet_rect(values_rect.to_sheet_rect(sheet_id));
            transaction.add_code_cell(sheet_id, data_table_pos);

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
                    let table_width = data_table.value.size().w.get();
                    let mut row_values = vec![CellValue::Blank; table_width as usize];
                    for (index, cell_value) in cell_values.into_iter().enumerate() {
                        let column_index =
                            data_table.get_column_index_from_display_index(index as u32);
                        row_values[column_index as usize] = cell_value;
                    }
                    values = Some(row_values);
                }

                // swallow sheet formatting
                for x in values_rect.x_range() {
                    let format_display_x = u32::try_from(x - data_table_pos.x)?;
                    let format_actual_x =
                        data_table.get_column_index_from_display_index(format_display_x);

                    for y in values_rect.y_range() {
                        let format_display_y =
                            u64::try_from(y - data_table_pos.y - data_table.y_adjustment(true))?;
                        let format_actual_y = data_table.transmute_index(format_display_y);

                        let format = sheet.formats.format((x, y).into());
                        if !format.is_default() {
                            format_update.set_format_cell(
                                (format_actual_x as i64 + 1, format_actual_y as i64 + 1).into(),
                                format.into(),
                            );
                        }
                    }
                }

                // clear sheet values
                let _ = sheet.delete_cell_values(values_rect);
                // clear sheet formats
                sheet
                    .formats
                    .apply_updates(&SheetFormatUpdates::from_selection(
                        &A1Selection::from_rect(values_rect.to_sheet_rect(sheet_id)),
                        FormatUpdate::cleared(),
                    ));
            }

            let data_table = sheet.data_table_mut(data_table_pos)?;
            data_table.insert_row_sorted_hidden(index as usize, values)?;
            if !format_update.is_default() {
                data_table.formats.apply_updates(&format_update);
            }

            Self::select_full_data_table(transaction, sheet_id, data_table_pos, data_table);
            data_table.add_dirty_fills_and_borders(transaction, sheet_id);
            self.send_updated_bounds(sheet_id);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DeleteDataTableRow {
                sheet_pos,
                index,
                flatten: swallow,
            }];

            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_rect),
            );

            return Ok(());
        };

        bail!("Expected Operation::InsertDataTableRow in execute_insert_data_table_row");
    }

    pub(super) fn execute_delete_data_table_row(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DeleteDataTableRow {
            sheet_pos,
            index,
            flatten,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_result(data_table_pos)?;
            let data_table_rect = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            let old_values = data_table.get_row_sorted(index as usize)?;
            let columns_to_show = data_table.columns_to_show();
            let display_values = data_table.display_columns(&columns_to_show, &old_values);
            let values_rect = Rect::from_numbers(
                data_table_pos.x,
                data_table_pos.y + index as i64,
                display_values.len() as i64,
                1,
            );

            transaction.add_dirty_hashes_from_sheet_rect(values_rect.to_sheet_rect(sheet_id));
            transaction.add_code_cell(sheet_id, data_table_pos);
            data_table.add_dirty_fills_and_borders(transaction, sheet_id);

            let mut reverse_operations = vec![];

            if flatten && !old_values.is_empty() {
                // flatten the values
                let values = Array::from(vec![display_values]);

                // flatten the formats
                let mut format_update = SheetFormatUpdates::default();
                for y in values_rect.y_range() {
                    let format_display_y =
                        u64::try_from(y - data_table_pos.y - data_table.y_adjustment(true))?;
                    let format_actual_y = data_table.transmute_index(format_display_y);

                    for x in values_rect.x_range() {
                        let format_display_x = u32::try_from(x - data_table_pos.x)?;
                        let format_actual_x =
                            data_table.get_column_index_from_display_index(format_display_x);

                        let format = data_table.formats.format(
                            (format_actual_x as i64 + 1, format_actual_y as i64 + 1).into(),
                        );
                        if !format.is_default() {
                            format_update.set_format_cell((x, y).into(), format.into());
                        }
                    }
                }

                let _ = sheet.set_cell_values(values_rect, &values);
                drop(values);
                reverse_operations.push(Operation::SetCellValues {
                    sheet_pos: values_rect.min.to_sheet_pos(sheet_id),
                    values: CellValues::new_blank(values_rect.width(), values_rect.height()),
                });

                if !format_update.is_default() {
                    sheet.formats.apply_updates(&format_update);
                    reverse_operations.push(Operation::SetCellFormatsA1 {
                        sheet_id,
                        formats: SheetFormatUpdates::from_selection(
                            &A1Selection::from_rect(values_rect.to_sheet_rect(sheet_id)),
                            FormatUpdate::cleared(),
                        ),
                    });
                }
            }

            let data_table = sheet.data_table_mut(data_table_pos)?;
            data_table.delete_row_sorted(index as usize)?;

            Self::select_full_data_table(transaction, sheet_id, data_table_pos, data_table);
            self.send_updated_bounds(sheet_id);

            let forward_operations = vec![op];
            // cannot undo using swallow because table may contain hidden columns
            // hidden values are lost and not flattened, need to insert the row with values for undo
            reverse_operations.push(Operation::InsertDataTableRow {
                sheet_pos,
                index,
                values: Some(old_values),
                swallow: false,
            });

            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_rect),
            );

            return Ok(());
        };

        bail!("Expected Operation::DeleteDataTableRow in execute_delete_data_table_row");
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
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;

            data_table.toggle_first_row_as_header(first_row_is_header);

            data_table.add_dirty_fills_and_borders(transaction, sheet_id);

            let data_table_rect = data_table
                .output_rect(data_table_pos, true)
                .to_sheet_rect(sheet_id);

            self.send_updated_bounds(sheet_id);
            self.mark_data_table_dirty(transaction, sheet_id, data_table_pos)?;

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header: !first_row_is_header,
            }];
            self.data_table_operations(
                transaction,
                forward_operations,
                reverse_operations,
                Some(&data_table_rect),
            );

            return Ok(());
        };

        bail!("Expected Operation::DataTableFirstRowAsHeader in execute_data_table_first_row_as_header");
    }

    pub(super) fn execute_data_table_format(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::DataTableFormats { sheet_pos, formats } = op.to_owned() {
            let sheet_id = sheet_pos.sheet_id;

            transaction.generate_thumbnail |= self.thumbnail_dirty_formats(sheet_id, &formats);

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet_pos.into();
            let data_table = sheet.data_table_mut(data_table_pos)?;

            let reverse_formats = data_table.formats.apply_updates(&formats);

            data_table.mark_formats_dirty(
                transaction,
                data_table_pos.to_sheet_pos(sheet_id),
                &formats,
                &reverse_formats,
            );

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DataTableFormats {
                sheet_pos,
                formats: reverse_formats,
            }];
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

            transaction.generate_thumbnail |= self.thumbnail_dirty_borders(sheet_id, &borders);

            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet_pos.into();
            let data_table = sheet.data_table_mut(data_table_pos)?;

            let reverse_borders = data_table.borders.set_borders_a1(&borders);

            transaction.add_borders(sheet_id);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DataTableBorders {
                sheet_pos,
                borders: reverse_borders,
            }];
            self.data_table_operations(transaction, forward_operations, reverse_operations, None);

            return Ok(());
        };

        bail!("Expected Operation::DataTableBorders in execute_data_table_borders");
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{
        controller::{
            execution::execute_operation::{
                execute_forward_operations, execute_reverse_operations,
            },
            user_actions::import::tests::{assert_simple_csv, simple_csv},
        },
        grid::{
            column_header::DataTableColumnHeader,
            data_table::sort::{DataTableSort, SortDirection},
            CodeCellLanguage, CodeCellValue, CodeRun, SheetId,
        },
        test_util::{
            assert_cell_value_row, assert_data_table_cell_value, assert_data_table_cell_value_row,
            print_data_table, print_table,
        },
        Array, SheetPos, Value,
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

        assert_simple_csv(gc, sheet_id, pos, file_name);

        gc.execute_flatten_data_table(&mut transaction, op).unwrap();

        assert_eq!(transaction.forward_operations.len(), 1);
        assert_eq!(transaction.reverse_operations.len(), 1);

        assert!(gc.sheet(sheet_id).first_data_table_within(pos).is_err());

        assert_flattened_simple_csv(gc, sheet_id, pos, file_name);

        print_table(gc, sheet_id, Rect::new(1, 1, 4, 12));

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
        assert_data_table_cell_value_row(gc, sheet_id, 1, 3, 3, first_row);

        let second_row = vec!["Marlborough", "MA", "United States", "38334"];
        assert_data_table_cell_value_row(gc, sheet_id, 1, 3, 4, second_row);

        let third_row = vec!["Northbridge", "MA", "United States", "14061"];
        assert_data_table_cell_value_row(gc, sheet_id, 1, 3, 5, third_row);

        let last_row = vec!["Westborough", "MA", "United States", "29313"];
        assert_data_table_cell_value_row(gc, sheet_id, 1, 3, 12, last_row);
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
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap().to_owned();
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
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap().to_owned();
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

        print_data_table(&gc, sheet_id, Rect::new(1, 1, 3, 10));

        // the initial value from the csv
        assert_data_table_cell_value(&gc, sheet_id, x, y, "MA");

        gc.execute_set_data_table_at(&mut transaction, op.clone())
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 1, 3, 10));

        // expect the value to be "1"
        assert_data_table_cell_value(&gc, sheet_id, x - 2, y, "1");

        // undo, the value should be "MA" again
        execute_reverse_operations(&mut gc, &transaction);
        assert_data_table_cell_value(&gc, sheet_id, x, y, "MA");

        // redo, the value should be "1" again
        execute_forward_operations(&mut gc, &mut transaction);
        assert_data_table_cell_value(&gc, sheet_id, x - 2, y, "1");

        // sort the data table and see if the value is still correct
        let sort = vec![DataTableSort {
            column_index: 0,
            direction: SortDirection::Descending,
        }];
        let sort_op = Operation::SortDataTable {
            sheet_pos,
            sort: Some(sort),
        };
        gc.execute_sort_data_table(&mut transaction, sort_op)
            .unwrap();

        gc.execute_set_data_table_at(&mut transaction, op).unwrap();
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_data_table_cell_value(&gc, sheet_id, x - 2, y, "1");
    }

    #[test]
    fn test_execute_flatten_data_table() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv();
        assert_simple_csv(&gc, sheet_id, pos, file_name);
        print_table(&gc, sheet_id, Rect::new(1, 1, 3, 11));

        let mut transaction = flatten_data_table(&mut gc, sheet_id, pos, file_name);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        assert_simple_csv(&gc, sheet_id, pos, file_name);
        print_table(&gc, sheet_id, Rect::new(1, 1, 3, 11));

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);
        print_table(&gc, sheet_id, Rect::new(1, 1, 3, 11));
    }

    #[test]
    fn test_execute_code_data_table_to_data_table() {
        let code_run = CodeRun {
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
            false,
            true,
            None,
        );

        let mut gc = GridController::test();
        let sheet_id = gc.grid.sheets()[0].id;
        let pos = Pos { x: 0, y: 0 };
        let sheet = gc.sheet_mut(sheet_id);
        sheet.data_tables.insert_sorted(pos, data_table);
        let code_cell_value = CodeCellValue {
            language: CodeCellLanguage::Javascript,
            code: "return [1,2,3]".into(),
        };
        sheet.set_cell_value(pos, CellValue::Code(code_cell_value.clone()));
        let data_table_pos = sheet.first_data_table_within(pos).unwrap();
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let expected = vec!["1", "2", "3"];

        // initial value
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 2, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table(data_table_pos).unwrap();
        assert_eq!(data_table.kind, DataTableKind::CodeRun(code_run.clone()));

        let import = Import::new("".into());
        let kind = DataTableKind::Import(import.to_owned());
        let op = Operation::SwitchDataTableKind {
            sheet_pos,
            kind: kind.clone(),
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_code_data_table_to_data_table(&mut transaction, op)
            .unwrap();

        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 2, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table(data_table_pos).unwrap();
        assert_eq!(data_table.kind, kind);

        // undo, the value should be a code run data table again
        execute_reverse_operations(&mut gc, &transaction);
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 2, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table(data_table_pos).unwrap();
        assert_eq!(data_table.kind, DataTableKind::CodeRun(code_run));

        // redo, the value should be a data table
        execute_forward_operations(&mut gc, &mut transaction);
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 2, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table(data_table_pos).unwrap();
        assert_eq!(data_table.kind, kind);
    }

    #[test]
    fn test_execute_grid_to_data_table() {
        let (mut gc, sheet_id, pos, file_name) = simple_csv();
        print_table(&gc, sheet_id, Rect::new(1, 1, 4, 11));

        flatten_data_table(&mut gc, sheet_id, pos, file_name);
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        let new_pos = Pos::new(pos.x, pos.y + 1);
        let max = Pos::new(4, 12);
        let sheet_pos = SheetPos::from((new_pos, sheet_id));
        let sheet_rect = SheetRect::new_pos_span(new_pos, max, sheet_id);
        let op = Operation::GridToDataTable { sheet_rect };
        let mut transaction = PendingTransaction::default();
        gc.execute_grid_to_data_table(&mut transaction, op).unwrap();
        gc.data_table_first_row_as_header(sheet_pos, true, None);
        print_table(&gc, sheet_id, Rect::new(1, 1, 4, 13));
        assert_simple_csv(&gc, sheet_id, new_pos, file_name);

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_table(&gc, sheet_id, Rect::new(1, 1, 4, 13));
        assert_flattened_simple_csv(&gc, sheet_id, pos, file_name);

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        gc.data_table_first_row_as_header(sheet_pos, true, None);
        print_table(&gc, sheet_id, Rect::new(1, 1, 4, 13));
        assert_simple_csv(&gc, sheet_id, new_pos, file_name);
    }

    #[test]
    fn test_execute_sort_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        data_table.apply_first_row_as_header();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let sort = vec![DataTableSort {
            column_index: 0,
            direction: SortDirection::Ascending,
        }];
        let op = Operation::SortDataTable {
            sheet_pos,
            sort: Some(sort),
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

    #[test]
    fn test_execute_update_data_table_name() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        let updated_name = "My_Table";

        assert_eq!(&data_table.name.to_display(), "simple.csv");
        println!("Initial data table name: {}", &data_table.name);

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let op = Operation::DataTableMeta {
            sheet_pos,
            name: Some(updated_name.into()),
            alternating_colors: None,
            columns: None,
            show_ui: None,
            show_name: None,
            show_columns: None,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_data_table_meta(&mut transaction, op.clone())
            .unwrap();

        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        assert_eq!(&data_table.name.to_display(), updated_name);
        println!("Updated data table name: {}", &data_table.name);

        // undo, the value should be the initial name
        execute_reverse_operations(&mut gc, &transaction);
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        assert_eq!(&data_table.name.to_display(), "simple.csv");
        println!("Initial data table name: {}", &data_table.name);

        // redo, the value should be the updated name
        {
            execute_forward_operations(&mut gc, &mut transaction);
            let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
            assert_eq!(&data_table.name.to_display(), updated_name);
            println!("Updated data table name: {}", &data_table.name);
        }

        // ensure names are unique
        let mut transaction = PendingTransaction::default();
        gc.execute_data_table_meta(&mut transaction, op).unwrap();
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        // todo: this was wrong. the same data table should not conflict with itself (it used to be "My Table1")
        assert_eq!(&data_table.name.to_display(), "My_Table");

        // ensure numbers aren't added for unique names
        let op = Operation::DataTableMeta {
            sheet_pos,
            name: Some("ABC".into()),
            alternating_colors: None,
            columns: None,
            show_ui: None,
            show_name: None,
            show_columns: None,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_data_table_meta(&mut transaction, op).unwrap();
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        assert_eq!(&data_table.name.to_display(), "ABC");
    }

    #[test]
    fn test_execute_insert_data_table_column() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 0;
        let op = Operation::InsertDataTableColumn {
            sheet_pos,
            index,
            column_header: None,
            values: None,
            swallow: false,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_insert_data_table_column(&mut transaction, op)
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_data_table_column_width(&gc, sheet_id, pos, 5, index, "Column 1");

        // ensure the value_index is set correctly
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
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
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_data_table_column_width(&gc, sheet_id, pos, 5, index, "Column 1");
    }

    #[test]
    fn test_execute_delete_data_table_column() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_data_table(&gc, sheet_id, Rect::new(1, 1, 2, 11));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 0;
        let op = Operation::DeleteDataTableColumn {
            sheet_pos,
            index,
            flatten: false,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_delete_data_table_column(&mut transaction, op)
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(1, 1, 2, 11));
        assert_data_table_column_width(&gc, sheet_id, pos, 3, index, "region");

        // ensure the value_index is set correctly
        let data_table = gc.sheet(sheet_id).data_table(pos).unwrap();
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
        print_data_table(&gc, sheet_id, Rect::new(1, 1, 2, 11));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_data_table(&gc, sheet_id, Rect::new(1, 1, 2, 11));
        assert_data_table_column_width(&gc, sheet_id, pos, 3, index, "region");
    }

    #[test]
    fn test_execute_insert_data_table_row() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_data_table(&gc, sheet_id, Rect::new(1, 1, 2, 11));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 2;
        let op = Operation::InsertDataTableRow {
            sheet_pos,
            index,
            values: None,
            swallow: false,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_insert_data_table_row(&mut transaction, op)
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(1, 1, 2, 12));
        let blank = CellValue::Blank;
        let values = vec![blank.clone(), blank.clone(), blank.clone(), blank.clone()];
        assert_data_table_row_height(&gc, sheet_id, pos, 12, index, values);

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_data_table(&gc, sheet_id, Rect::new(1, 1, 2, 11));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_data_table(&gc, sheet_id, Rect::new(1, 1, 2, 12));
        let values = vec![blank.clone(), blank.clone(), blank.clone(), blank.clone()];
        assert_data_table_row_height(&gc, sheet_id, pos, 12, index, values);
    }

    #[test]
    fn test_execute_delete_data_table_row() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_data_table(&gc, sheet_id, Rect::new(1, 1, 4, 11));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 2;
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        let values = data_table.get_row(index as usize + 1).unwrap();
        let op = Operation::DeleteDataTableRow {
            sheet_pos,
            index,
            flatten: true,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_delete_data_table_row(&mut transaction, op)
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(1, 1, 4, 12));
        assert_data_table_row_height(&gc, sheet_id, pos, 10, index, values.clone());

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_data_table(&gc, sheet_id, Rect::new(1, 1, 4, 11));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_data_table(&gc, sheet_id, Rect::new(1, 1, 4, 12));
        assert_data_table_row_height(&gc, sheet_id, pos, 10, index, values);
    }
}
