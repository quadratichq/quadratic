use crate::{
    a1::A1Selection,
    cellvalue::Import,
    controller::{
        active_transactions::pending_transaction::PendingTransaction,
        operations::operation::Operation, GridController,
    },
    grid::{DataTable, DataTableKind},
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
            self.send_updated_bounds(sheet_rect.sheet_id);
            transaction.add_dirty_hashes_from_sheet_rect(*sheet_rect);

            if transaction.is_user() {
                let sheet = self.try_sheet_result(sheet_rect.sheet_id)?;
                // TODO(ddimaria): this could be false, check the history of the source fn
                let rows = sheet.get_rows_with_wrap_in_rect(&(*sheet_rect).into(), true);

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
                self.check_all_spills(transaction, sheet_rect.sheet_id);
            }

            transaction.reverse_operations.extend(reverse_operations);
        }

        transaction.generate_thumbnail |= self.thumbnail_dirty_sheet_rect(*sheet_rect);
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
            self.finalize_code_run(transaction, pos.to_sheet_pos(sheet_id), None, None);
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
            self.finalize_code_run(transaction, sheet_pos, data_table, Some(index));
        }
    }

    pub(super) fn execute_set_data_table_at(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SetDataTableAt {
            sheet_pos,
            ref values,
        } = op
        {
            let sheet_id = sheet_pos.sheet_id;
            let mut pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(pos)?;
            let data_table = sheet.data_table_result(data_table_pos)?;

            if data_table.readonly {
                dbgjs!(format!("Data table {} is readonly", data_table.name));
                return Ok(());
            }

            // if there is a display buffer, use it to find the source row index
            if data_table.display_buffer.is_some() {
                let index_to_find = pos.y - data_table_pos.y;
                let row_index = data_table.transmute_index(index_to_find as u64);
                pos.y = row_index as i64 + data_table_pos.y;
            }

            pos.y -= data_table.y_adjustment();

            let rect = Rect::from_numbers(pos.x, pos.y, values.w as i64, values.h as i64);
            let old_values = sheet.get_code_cell_values(rect);

            // send the new value
            sheet.set_code_cell_values(pos, values.to_owned());

            let data_table_rect = SheetRect::from_numbers(
                sheet_pos.x,
                sheet_pos.y,
                values.w as i64,
                values.h as i64,
                sheet_id,
            );

            self.send_to_wasm(transaction, &data_table_rect)?;

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SetDataTableAt {
                sheet_pos,
                values: old_values,
            }];

            self.data_table_operations(
                transaction,
                &data_table_rect,
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

            let forward_operations = vec![op];
            let reverse_operations = vec![
                Operation::GridToDataTable { sheet_rect },
                Operation::SwitchDataTableKind {
                    sheet_pos,
                    kind: data_table.kind,
                },
            ];

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

    pub(super) fn execute_code_data_table_to_data_table(
        &mut self,
        transaction: &mut PendingTransaction,
        op: Operation,
    ) -> Result<()> {
        if let Operation::SwitchDataTableKind {
            sheet_pos,
            ref kind,
        } = op
        {
            let sheet_id = sheet_pos.sheet_id;
            let pos = Pos::from(sheet_pos);
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(pos)?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            let old_data_table_kind = data_table.kind.to_owned();
            let sheet_rect = data_table.output_sheet_rect(sheet_pos, false, true);

            data_table.kind = match old_data_table_kind {
                DataTableKind::CodeRun(_) => match kind {
                    DataTableKind::CodeRun(_) => kind.to_owned(),
                    DataTableKind::Import(import) => DataTableKind::Import(import.to_owned()),
                },
                DataTableKind::Import(_) => match kind {
                    DataTableKind::CodeRun(code_run) => DataTableKind::CodeRun(code_run.to_owned()),
                    DataTableKind::Import(_) => kind.to_owned(),
                },
            };

            // let the client know that the code cell changed to remove the styles
            if (cfg!(target_family = "wasm") || cfg!(test)) && !transaction.is_server() {
                transaction.add_code_cell(sheet_id, data_table_pos);
            }

            self.send_to_wasm(transaction, &sheet_rect)?;
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SwitchDataTableKind {
                sheet_pos,
                kind: old_data_table_kind,
            }];

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

            let import = Import::new(self.grid.next_data_table_name());
            let data_table =
                DataTable::from((import.to_owned(), old_values.to_owned(), &self.grid));
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

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::FlattenDataTable { sheet_pos }];

            self.data_table_operations(
                transaction,
                &sheet_rect,
                forward_operations,
                reverse_operations,
            );

            // Sets the cursor to the entire table, including the new header
            if transaction.is_user() {
                let mut sheet_rect = sheet_rect.to_owned();
                sheet_rect.max.y += 1;
                transaction.add_update_selection(A1Selection::from_rect(sheet_rect));
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
            ref name,
            ref alternating_colors,
            ref columns,
            ref show_ui,
            ref show_name,
            ref show_columns,
        } = op
        {
            // do grid mutations first to keep the borrow checker happy
            let sheet_id = sheet_pos.sheet_id;
            let pos = Pos::from(sheet_pos);
            let old_name = self.grid.data_table(sheet_id, pos)?.name.to_display();

            if let Some(name) = name {
                self.grid
                    .update_data_table_name(sheet_pos, &old_name, name, false)?;
            }

            let old_data_table = self.grid.data_table(sheet_id, pos)?;
            let old_columns = old_data_table.column_headers.to_owned();

            // update column names that have changed in code cells
            if let (Some(columns), Some(old_columns)) = (columns, old_columns.to_owned()) {
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

            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;

            if let Some(columns) = columns {
                data_table.column_headers = Some(columns.to_owned());
                data_table.normalize_column_header_names();
            }

            let old_alternating_colors = alternating_colors.map(|alternating_colors| {
                let old_alternating_colors = data_table.alternating_colors.to_owned();
                data_table.alternating_colors = alternating_colors;
                transaction.add_fill_cells(sheet_id);
                old_alternating_colors
            });

            let old_columns = columns.as_ref().and_then(|columns| {
                let old_columns = data_table.column_headers.to_owned();
                data_table.column_headers = Some(columns.to_owned());
                data_table.normalize_column_header_names();

                old_columns
            });

            let has_fills = data_table.formats.has_fills();
            let has_borders = !data_table.borders.is_default();

            let old_show_ui = show_ui.as_ref().map(|show_ui| {
                let old_show_ui = data_table.show_ui.to_owned();
                data_table.show_ui = show_ui.to_owned();
                if has_fills {
                    transaction.add_fill_cells(sheet_id);
                }
                if has_borders {
                    transaction.add_borders(sheet_id);
                }

                old_show_ui
            });

            let old_show_name = show_name.as_ref().map(|show_name| {
                let old_show_name = data_table.show_name.to_owned();
                data_table.show_name = show_name.to_owned();
                if has_fills {
                    transaction.add_fill_cells(sheet_id);
                }
                if has_borders {
                    transaction.add_borders(sheet_id);
                }

                old_show_name
            });

            let old_show_columns = show_columns.as_ref().map(|show_columns| {
                let old_show_columns = data_table.show_columns.to_owned();
                data_table.show_columns = show_columns.to_owned();
                if has_fills {
                    transaction.add_fill_cells(sheet_id);
                }
                if has_borders {
                    transaction.add_borders(sheet_id);
                }

                old_show_columns
            });

            let data_table_rect = data_table
                .output_rect(sheet_pos.into(), true, true)
                .to_sheet_rect(sheet_id);

            self.send_to_wasm(transaction, &data_table_rect)?;
            transaction.add_code_cell(sheet_id, data_table_pos);

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
                &data_table_rect,
                forward_operations,
                reverse_operations,
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
                .output_rect(sheet_pos.into(), true, true)
                .to_sheet_rect(sheet_id);

            let old_value = data_table.sort.to_owned();
            data_table.sort = sort;
            data_table.sort_all()?;

            self.send_to_wasm(transaction, &data_table_sheet_rect)?;
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::SortDataTable {
                sheet_pos,
                sort: old_value,
            }];

            self.data_table_operations(
                transaction,
                &data_table_sheet_rect,
                forward_operations,
                reverse_operations,
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
            column_header,
            values,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            data_table.insert_column(index as usize, column_header, values)?;

            let data_table_rect = data_table
                .output_rect(sheet_pos.into(), true, true)
                .to_sheet_rect(sheet_id);

            if data_table.formats.has_fills() {
                transaction.add_fill_cells(sheet_id);
            }
            if !data_table.borders.is_default() {
                transaction.add_borders(sheet_id);
            }

            self.send_to_wasm(transaction, &data_table_rect)?;
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DeleteDataTableColumn { sheet_pos, index }];

            self.data_table_operations(
                transaction,
                &data_table_rect,
                forward_operations,
                reverse_operations,
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
        if let Operation::DeleteDataTableColumn { sheet_pos, index } = op.to_owned() {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            let old_column_header = data_table
                .get_column_header(index as usize)
                .map(|header| header.name.to_owned().to_string());
            let old_values = data_table.get_column(index as usize)?;

            data_table.delete_column(index as usize)?;

            let data_table_rect = data_table
                .output_rect(sheet_pos.into(), true, true)
                .to_sheet_rect(sheet_id);

            if data_table.formats.has_fills() {
                transaction.add_fill_cells(sheet_id);
            }
            if !data_table.borders.is_default() {
                transaction.add_borders(sheet_id);
            }
            self.send_to_wasm(transaction, &data_table_rect)?;
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::InsertDataTableColumn {
                sheet_pos,
                index,
                column_header: old_column_header,
                values: Some(old_values),
            }];

            self.data_table_operations(
                transaction,
                &data_table_rect,
                forward_operations,
                reverse_operations,
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
            values,
        } = op.to_owned()
        {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            data_table.insert_row(index as usize, values)?;

            let data_table_rect = data_table
                .output_rect(sheet_pos.into(), true, true)
                .to_sheet_rect(sheet_id);

            if data_table.formats.has_fills() {
                transaction.add_fill_cells(sheet_id);
            }
            if !data_table.borders.is_default() {
                transaction.add_borders(sheet_id);
            }
            self.send_to_wasm(transaction, &data_table_rect)?;
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DeleteDataTableRow { sheet_pos, index }];

            self.data_table_operations(
                transaction,
                &data_table_rect,
                forward_operations,
                reverse_operations,
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
        if let Operation::DeleteDataTableRow { sheet_pos, index } = op.to_owned() {
            let sheet_id = sheet_pos.sheet_id;
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table_pos = sheet.first_data_table_within(sheet_pos.into())?;
            let data_table = sheet.data_table_mut(data_table_pos)?;
            let old_values = data_table.get_row(index as usize)?;
            data_table.delete_row(index as usize)?;

            let data_table_rect = data_table
                .output_rect(sheet_pos.into(), true, true)
                .to_sheet_rect(sheet_id);

            if data_table.formats.has_fills() {
                transaction.add_fill_cells(sheet_id);
            }
            if !data_table.borders.is_default() {
                transaction.add_borders(sheet_id);
            }
            self.send_to_wasm(transaction, &data_table_rect)?;
            transaction.add_code_cell(sheet_id, data_table_pos);

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::InsertDataTableRow {
                sheet_pos,
                index,
                values: Some(old_values),
            }];

            self.data_table_operations(
                transaction,
                &data_table_rect,
                forward_operations,
                reverse_operations,
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
            let data_table_rect = data_table
                .output_rect(sheet_pos.into(), true, true)
                .to_sheet_rect(sheet_id);

            data_table.toggle_first_row_as_header(first_row_is_header);

            if data_table.formats.has_fills() {
                transaction.add_fill_cells(sheet_id);
            }
            if !data_table.borders.is_default() {
                transaction.add_borders(sheet_id);
            }
            self.send_to_wasm(transaction, &data_table_rect)?;
            transaction.add_code_cell(sheet_id, sheet_pos.into());

            let forward_operations = vec![op];
            let reverse_operations = vec![Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header: !first_row_is_header,
            }];

            self.data_table_operations(
                transaction,
                &data_table_rect,
                forward_operations,
                reverse_operations,
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
            let sheet = self.try_sheet_mut_result(sheet_id)?;
            let data_table = sheet.data_table_mut(sheet_pos.into())?;
            let forward_operations = vec![op];
            let reverse_formats = data_table.formats.apply_updates(&formats);

            if transaction.is_user_undo_redo() {
                let reverse_operations = Operation::DataTableFormats {
                    sheet_pos,
                    formats: reverse_formats,
                };
                transaction.forward_operations.extend(forward_operations);
                transaction.reverse_operations.push(reverse_operations);
            }

            let data_table_rect = data_table.output_sheet_rect(sheet_pos, false, true);
            if data_table.formats.has_fills() {
                transaction.add_fill_cells(sheet_id);
            }
            self.send_to_wasm(transaction, &data_table_rect)?;

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
            let data_table = sheet.data_table_mut(sheet_pos.into())?;
            let forward_operations = vec![op];
            let reverse_borders = data_table.borders.set_borders_a1(&borders);
            transaction.sheet_borders.insert(sheet_id);

            if transaction.is_user_undo_redo() {
                let reverse_operations = Operation::DataTableBorders {
                    sheet_pos,
                    borders: reverse_borders,
                };
                transaction.forward_operations.extend(forward_operations);
                transaction.reverse_operations.push(reverse_operations);
            }

            return Ok(());
        };

        bail!("Expected Operation::DataTableBorders in execute_data_table_borders");
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
        assert_eq!(transaction.reverse_operations.len(), 2);

        assert!(gc.sheet(sheet_id).first_data_table_within(pos).is_err());

        assert_flattened_simple_csv(gc, sheet_id, pos, file_name);

        print_table(gc, sheet_id, Rect::new(0, 0, 2, 2));

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
        assert_cell_value_row(gc, sheet_id, 0, 3, 0, first_row);

        let last_row = vec!["Concord", "NH", "United States", "42605"];
        assert_cell_value_row(gc, sheet_id, 0, 3, 10, last_row);

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
        assert_data_table_cell_value_row(gc, sheet_id, 0, 3, 1, first_row);

        let second_row = vec!["Marlborough", "MA", "United States", "38334"];
        assert_data_table_cell_value_row(gc, sheet_id, 0, 3, 2, second_row);

        let third_row = vec!["Northbridge", "MA", "United States", "14061"];
        assert_data_table_cell_value_row(gc, sheet_id, 0, 3, 3, third_row);

        let last_row = vec!["Westborough", "MA", "United States", "29313"];
        assert_data_table_cell_value_row(gc, sheet_id, 0, 3, 10, last_row);
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
        let x = 1;
        let y = 1;
        let change_val_pos = Pos::new(x, y);
        let sheet_pos = SheetPos::from((change_val_pos, sheet_id));

        let values = CellValue::Number(1.into()).into();
        let op = Operation::SetDataTableAt { sheet_pos, values };
        let mut transaction = PendingTransaction::default();

        // the initial value from the csv
        assert_data_table_cell_value(&gc, sheet_id, x, y, "MA");

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        gc.execute_set_data_table_at(&mut transaction, op.clone())
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        // expect the value to be "1"
        assert_data_table_cell_value(&gc, sheet_id, x, y, "1");

        // undo, the value should be "MA" again
        execute_reverse_operations(&mut gc, &transaction);
        assert_data_table_cell_value(&gc, sheet_id, x, y, "MA");

        // redo, the value should be "1" again
        execute_forward_operations(&mut gc, &mut transaction);
        assert_data_table_cell_value(&gc, sheet_id, x, y, "1");

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

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        gc.execute_set_data_table_at(&mut transaction, op).unwrap();
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
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
        sheet.data_tables.insert_full(pos, data_table);
        let code_cell_value = CodeCellValue {
            language: CodeCellLanguage::Javascript,
            code: "return [1,2,3]".into(),
        };
        sheet.set_cell_value(pos, CellValue::Code(code_cell_value.clone()));
        let data_table_pos = sheet.first_data_table_within(pos).unwrap();
        let sheet_pos = SheetPos::from((pos, sheet_id));
        let expected = vec!["1", "2", "3"];

        // initial value
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 0, expected.clone());
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

        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 0, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table(data_table_pos).unwrap();
        assert_eq!(data_table.kind, kind);

        // undo, the value should be a code run data table again
        execute_reverse_operations(&mut gc, &transaction);
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 0, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table(data_table_pos).unwrap();
        assert_eq!(data_table.kind, DataTableKind::CodeRun(code_run));

        // redo, the value should be a data table
        execute_forward_operations(&mut gc, &mut transaction);
        assert_data_table_cell_value_row(&gc, sheet_id, 0, 2, 0, expected.clone());
        let data_table = &gc.sheet(sheet_id).data_table(data_table_pos).unwrap();
        assert_eq!(data_table.kind, kind);
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
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_insert_data_table_column(&mut transaction, op)
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_data_table_column_width(&gc, sheet_id, pos, 5, index, "Column 1");

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

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 0;
        let op = Operation::DeleteDataTableColumn { sheet_pos, index };
        let mut transaction = PendingTransaction::default();
        gc.execute_delete_data_table_column(&mut transaction, op)
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_data_table_column_width(&gc, sheet_id, pos, 3, index, "region");

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_data_table_column_width(&gc, sheet_id, pos, 3, index, "region");
    }

    #[test]
    fn test_execute_insert_data_table_row() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 2;
        let op = Operation::InsertDataTableRow {
            sheet_pos,
            index,
            values: None,
        };
        let mut transaction = PendingTransaction::default();
        gc.execute_insert_data_table_row(&mut transaction, op)
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 11));
        let blank = CellValue::Blank;
        let values = vec![blank.clone(), blank.clone(), blank.clone(), blank.clone()];
        assert_data_table_row_height(&gc, sheet_id, pos, 12, index, values);

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 11));
        let values = vec![blank.clone(), blank.clone(), blank.clone(), blank.clone()];
        assert_data_table_row_height(&gc, sheet_id, pos, 12, index, values);
    }

    #[test]
    fn test_execute_delete_data_table_row() {
        let (mut gc, sheet_id, pos, _) = simple_csv();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));

        let sheet_pos = SheetPos::from((pos, sheet_id));
        let index = 2;
        let data_table = gc.sheet_mut(sheet_id).data_table_mut(pos).unwrap();
        let values = data_table.get_row(index as usize + 1).unwrap();
        let op = Operation::DeleteDataTableRow { sheet_pos, index };
        let mut transaction = PendingTransaction::default();
        gc.execute_delete_data_table_row(&mut transaction, op)
            .unwrap();

        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 11));
        assert_data_table_row_height(&gc, sheet_id, pos, 10, index, values.clone());

        // undo, the value should be a data table again
        execute_reverse_operations(&mut gc, &transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 10));
        assert_simple_csv(&gc, sheet_id, pos, "simple.csv");

        // redo, the value should be on the grid
        execute_forward_operations(&mut gc, &mut transaction);
        print_data_table(&gc, sheet_id, Rect::new(0, 0, 3, 11));
        assert_data_table_row_height(&gc, sheet_id, pos, 10, index, values);
    }
}
