use std::collections::HashSet;

use indexmap::IndexSet;

use crate::{grid::*, Array, CellValue, Pos};

use super::{
    formatting::CellFmtArray,
    operation::Operation,
    transaction_summary::{CellSheetsModified, TransactionSummary},
    update_code_cell_value::fetch_code_cell_difference,
    GridController,
};

impl GridController {
    /// Executes the given operation and returns the reverse operation.
    /// The only way to modify the internal state of the grid is through this function, with an operation.
    /// Operations must always return a reverse operation that can be used to undo the operation.
    pub fn execute_operation(
        &mut self,
        op: Operation,
        cells_updated: &mut IndexSet<RegionRef>,
        cells_to_compute: &mut IndexSet<CellRef>,
        summary: &mut TransactionSummary,
        sheets_with_changed_bounds: &mut HashSet<SheetId>,
        compute: bool,
        multiplayer_operations: &mut Vec<Operation>,
    ) -> Vec<Operation> {
        let mut reverse_operations = vec![];
        match op {
            Operation::SetCellValues { region, values } => {
                sheets_with_changed_bounds.insert(region.sheet);
                let sheet = self.grid.sheet_mut_from_id(region.sheet);

                let size = region.size().expect("msg: error getting size of region");
                let old_values = region
                    .iter()
                    .zip(values.clone().into_cell_values_vec())
                    .map(|(cell_ref, value)| {
                        let pos = sheet.cell_ref_to_pos(cell_ref)?;
                        let (old_value, ops) = sheet.set_cell_value(pos, value);
                        if let Some(ops) = ops {
                            multiplayer_operations.extend(ops);
                        }
                        if old_value
                            .as_ref()
                            .is_some_and(|cell_value| cell_value.is_html())
                        {
                            summary.html.insert(cell_ref.sheet);
                        }
                        old_value
                    })
                    .map(|old_value| old_value.unwrap_or(CellValue::Blank))
                    .collect();
                cells_updated.insert(region.clone());

                let old_values = Array::new_row_major(size, old_values)
                    .expect("error constructing array of old values for SetCells operation");

                CellSheetsModified::add_region(&mut summary.cell_sheets_modified, sheet, &region);
                // check if override any code cells
                let sheet = self.grid.sheet_from_id(region.sheet);
                let code_cells_to_delete = sheet
                    .code_cells
                    .iter()
                    .filter_map(|(cell_ref, _)| {
                        if region.contains(cell_ref) {
                            let pos = sheet.cell_ref_to_pos(*cell_ref)?;
                            Some((*cell_ref, pos))
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<(CellRef, Pos)>>();

                // remove the code cells
                let sheet_id = sheet.id;
                for (cell_ref, pos) in code_cells_to_delete {
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);
                    let (old_value, _) = sheet.set_code_cell_value(pos, None);
                    fetch_code_cell_difference(
                        self,
                        sheet_id,
                        pos,
                        old_value.clone(),
                        None,
                        summary,
                        cells_to_compute,
                        &mut reverse_operations,
                        multiplayer_operations,
                    );
                    reverse_operations.push(Operation::SetCellCode {
                        cell_ref,
                        code_cell_value: old_value,
                    });
                }

                // check for changes in spills
                for cell_ref in region.iter() {
                    let sheet = self.grid.sheet_from_id(cell_ref.sheet);
                    if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                        // if there is a value, check if it caused a spill
                        if sheet.get_cell_value(pos).is_some() {
                            self.check_spill(
                                cell_ref,
                                cells_to_compute,
                                summary,
                                &mut reverse_operations,
                                multiplayer_operations,
                            );
                        } else {
                            // otherwise check if it released a spill
                            self.update_code_cell_value_if_spill_error_released(
                                cell_ref,
                                cells_to_compute,
                                summary,
                                &mut reverse_operations,
                                multiplayer_operations,
                            );
                        }
                    }
                }

                multiplayer_operations.push(Operation::SetCellValues {
                    region: region.clone(),
                    values,
                });

                summary.generate_thumbnail =
                    summary.generate_thumbnail || self.thumbnail_dirty_region(&region);

                reverse_operations.push(Operation::SetCellValues {
                    region,
                    values: old_values,
                });
            }
            Operation::SetCellCode {
                cell_ref,
                code_cell_value,
            } => {
                let is_code_cell_empty = code_cell_value.is_none();
                let sheet_id = cell_ref.sheet;

                sheets_with_changed_bounds.insert(sheet_id);

                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_spill = sheet.get_spill(cell_ref);

                // TODO(ddimaria): resolve comment from @HactarCE
                // note: this is a non-trivial refactor, but a good one to make
                //
                // Use .cloned() later if the value needs to be cloned, not here.
                // fetch_code_cell_difference() should take &Option<CodeCellValue>
                // or possibly Option<CodeCellValue>.
                let old_code_cell_value = sheet.get_code_cell_from_ref(cell_ref).cloned();
                let pos = if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                    pos
                } else {
                    return vec![];
                };

                let final_code_cell_value;

                // for compute, we keep the original cell output to avoid flashing of output (since values will be overridden once computation is complete)
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                if compute {
                    if let Some(code_cell_value) = code_cell_value {
                        let updated_code_cell_value =
                            if let Some(old_code_cell_value) = &old_code_cell_value {
                                let mut updated_code_cell_value = code_cell_value.clone();
                                updated_code_cell_value.output = old_code_cell_value.output.clone();
                                updated_code_cell_value
                            } else {
                                code_cell_value
                            };
                        sheet.set_code_cell_value(pos, Some(updated_code_cell_value.clone()));
                        final_code_cell_value = Some(updated_code_cell_value);
                    } else {
                        sheet.set_code_cell_value(pos, code_cell_value);
                        fetch_code_cell_difference(
                            self,
                            sheet_id,
                            pos,
                            old_code_cell_value.clone(),
                            None,
                            summary,
                            cells_to_compute,
                            &mut reverse_operations,
                            multiplayer_operations,
                        );
                        let sheet = self.grid.sheet_mut_from_id(sheet_id);
                        sheet.set_code_cell_value(pos, None);
                        final_code_cell_value = None;
                    }
                    cells_to_compute.insert(cell_ref);
                } else {
                    // need to update summary (cells_to_compute will be ignored)
                    fetch_code_cell_difference(
                        self,
                        sheet_id,
                        pos,
                        old_code_cell_value.clone(),
                        code_cell_value.clone(),
                        summary,
                        cells_to_compute,
                        &mut reverse_operations,
                        multiplayer_operations,
                    );
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);
                    sheet.set_code_cell_value(pos, code_cell_value.clone());
                    final_code_cell_value = code_cell_value;
                }

                // TODO(ddimaria): resolve comment from @HactarCE:
                //
                // Can we use SheetPos instead of CellSheetsModified? I'd like
                // to avoid using String for sheet IDs as much as possible. If
                // it's needed for JS interop, then let's impl Serialize and
                // Deserialize on SheetId to make it serialize as a string.
                summary
                    .cell_sheets_modified
                    .insert(CellSheetsModified::new(sheet_id, pos));
                summary.code_cells_modified.insert(sheet_id);

                // check if a new code_cell causes a spill error in another code cell
                if old_code_cell_value.is_none() && !is_code_cell_empty {
                    if let Some(old_spill) = old_spill {
                        if old_spill != cell_ref {
                            self.set_spill_error(
                                old_spill,
                                cells_to_compute,
                                summary,
                                &mut reverse_operations,
                                multiplayer_operations,
                            );
                        }
                    }
                }

                // check if deleting a code cell releases a spill
                if is_code_cell_empty {
                    self.update_code_cell_value_if_spill_error_released(
                        cell_ref,
                        cells_to_compute,
                        summary,
                        &mut reverse_operations,
                        multiplayer_operations,
                    );
                }
                multiplayer_operations.push(Operation::SetCellCode {
                    cell_ref,
                    code_cell_value: final_code_cell_value,
                });
                reverse_operations.push(Operation::SetCellCode {
                    cell_ref,
                    code_cell_value: old_code_cell_value,
                });
            }
            Operation::SetCellFormats { region, attr } => {
                sheets_with_changed_bounds.insert(region.sheet);

                if let CellFmtArray::FillColor(_) = attr {
                    summary.fill_sheets_modified.push(region.sheet);
                }

                // todo: this is too slow -- perhaps call this again when we have a better way of setting multiple formats within an array
                // or when we get rid of CellRefs (which I think is the reason this is slow)
                // summary.generate_thumbnail =
                //     summary.generate_thumbnail || self.thumbnail_dirty_region(region.clone());

                let old_attr = match attr.clone() {
                    CellFmtArray::Align(align) => {
                        CellFmtArray::Align(self.set_cell_formats_for_type::<CellAlign>(
                            &region,
                            align,
                            Some(&mut summary.cell_sheets_modified),
                        ))
                    }

                    CellFmtArray::Wrap(wrap) => {
                        CellFmtArray::Wrap(self.set_cell_formats_for_type::<CellWrap>(
                            &region,
                            wrap,
                            Some(&mut summary.cell_sheets_modified),
                        ))
                    }
                    CellFmtArray::NumericFormat(num_fmt) => CellFmtArray::NumericFormat(
                        self.set_cell_formats_for_type::<NumericFormat>(
                            &region,
                            num_fmt,
                            Some(&mut summary.cell_sheets_modified),
                        ),
                    ),
                    CellFmtArray::NumericDecimals(num_decimals) => CellFmtArray::NumericDecimals(
                        self.set_cell_formats_for_type::<NumericDecimals>(
                            &region,
                            num_decimals,
                            Some(&mut summary.cell_sheets_modified),
                        ),
                    ),
                    CellFmtArray::NumericCommas(num_commas) => CellFmtArray::NumericCommas(
                        self.set_cell_formats_for_type::<NumericCommas>(
                            &region,
                            num_commas,
                            Some(&mut summary.cell_sheets_modified),
                        ),
                    ),
                    CellFmtArray::Bold(bold) => {
                        CellFmtArray::Bold(self.set_cell_formats_for_type::<Bold>(
                            &region,
                            bold,
                            Some(&mut summary.cell_sheets_modified),
                        ))
                    }
                    CellFmtArray::Italic(italic) => {
                        CellFmtArray::Italic(self.set_cell_formats_for_type::<Italic>(
                            &region,
                            italic,
                            Some(&mut summary.cell_sheets_modified),
                        ))
                    }
                    CellFmtArray::TextColor(text_color) => {
                        CellFmtArray::TextColor(self.set_cell_formats_for_type::<TextColor>(
                            &region,
                            text_color,
                            Some(&mut summary.cell_sheets_modified),
                        ))
                    }
                    CellFmtArray::FillColor(fill_color) => {
                        summary.fill_sheets_modified.push(region.sheet);
                        CellFmtArray::FillColor(
                            self.set_cell_formats_for_type::<FillColor>(&region, fill_color, None),
                        )
                    }
                    CellFmtArray::RenderSize(output_size) => {
                        summary.html.insert(region.sheet);
                        CellFmtArray::RenderSize(self.set_cell_formats_for_type::<RenderSize>(
                            &region,
                            output_size,
                            None,
                        ))
                    }
                };
                multiplayer_operations.push(Operation::SetCellFormats {
                    region: region.clone(),
                    attr,
                });

                reverse_operations.push(Operation::SetCellFormats {
                    region,
                    attr: old_attr,
                });
            }
            Operation::SetBorders { region, borders } => {
                sheets_with_changed_bounds.insert(region.sheet);
                summary.border_sheets_modified.push(region.sheet);
                summary.generate_thumbnail =
                    summary.generate_thumbnail || self.thumbnail_dirty_region(&region);

                let sheet = self.grid.sheet_mut_from_id(region.sheet);

                let old_borders = sheet.set_region_borders(&region, borders.clone());
                multiplayer_operations.push(Operation::SetBorders {
                    region: region.clone(),
                    borders,
                });
                reverse_operations.push(Operation::SetBorders {
                    region,
                    borders: old_borders,
                });
            }
            Operation::AddSheet { sheet } => {
                // todo: need to handle the case where sheet.order overlaps another sheet order
                // this may happen after (1) delete a sheet; (2) MP update w/an added sheet; and (3) undo the deleted sheet
                let sheet_id = sheet.id;
                self.grid
                    .add_sheet(Some(sheet.clone()))
                    .expect("duplicate sheet name");
                summary.sheet_list_modified = true;
                summary.html.insert(sheet_id);
                multiplayer_operations.push(Operation::AddSheet { sheet });
                reverse_operations.push(Operation::DeleteSheet { sheet_id });
            }
            Operation::DeleteSheet { sheet_id } => {
                let deleted_sheet = self.grid.remove_sheet(sheet_id);
                summary.sheet_list_modified = true;
                multiplayer_operations.push(Operation::DeleteSheet { sheet_id });
                reverse_operations.push(Operation::AddSheet {
                    sheet: deleted_sheet,
                });
            }
            Operation::ReorderSheet { target, order } => {
                let old_first = self.grid.first_sheet_id();
                let sheet = self.grid.sheet_from_id(target);
                let original_order = sheet.order.clone();
                self.grid.move_sheet(target, order.clone());
                summary.sheet_list_modified = true;

                if old_first != self.grid.first_sheet_id() {
                    summary.generate_thumbnail = true;
                }
                multiplayer_operations.push(Operation::ReorderSheet { target, order });
                reverse_operations.push(Operation::ReorderSheet {
                    target,
                    order: original_order,
                });
            }
            Operation::SetSheetName { sheet_id, name } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_name = sheet.name.clone();
                sheet.name = name.clone();
                summary.sheet_list_modified = true;
                multiplayer_operations.push(Operation::SetSheetName { sheet_id, name });
                reverse_operations.push(Operation::SetSheetName {
                    sheet_id,
                    name: old_name,
                });
            }
            Operation::SetSheetColor { sheet_id, color } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_color = sheet.color.clone();
                sheet.color = color.clone();
                summary.sheet_list_modified = true;
                multiplayer_operations.push(Operation::SetSheetColor { sheet_id, color });
                reverse_operations.push(Operation::SetSheetColor {
                    sheet_id,
                    color: old_color,
                });
            }

            Operation::ResizeColumn {
                sheet_id,
                column,
                new_size,
            } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                if let Some(x) = sheet.get_column_index(column) {
                    summary.offsets_modified.push(sheet.id);
                    let old_size = sheet.offsets.set_column_width(x, new_size);
                    summary.generate_thumbnail = summary.generate_thumbnail
                        || self.thumbnail_dirty_pos(sheet_id, Pos { x, y: 0 });
                    multiplayer_operations.push(Operation::ResizeColumn {
                        sheet_id,
                        column,
                        new_size,
                    });
                    reverse_operations.push(Operation::ResizeColumn {
                        sheet_id,
                        column,
                        new_size: old_size,
                    });
                }
            }

            Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
            } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                if let Some(y) = sheet.get_row_index(row) {
                    let old_size = sheet.offsets.set_row_height(y, new_size);
                    summary.offsets_modified.push(sheet.id);
                    summary.generate_thumbnail = summary.generate_thumbnail
                        || self.thumbnail_dirty_pos(sheet_id, Pos { x: 0, y });
                    multiplayer_operations.push(Operation::ResizeRow {
                        sheet_id,
                        row,
                        new_size,
                    });
                    reverse_operations.push(Operation::ResizeRow {
                        sheet_id,
                        row,
                        new_size: old_size,
                    });
                }
            }

            Operation::MapColumnId {
                sheet_id,
                column_id,
                index,
            } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                sheet.set_column_id(column_id, index);
                multiplayer_operations.push(Operation::MapColumnId {
                    sheet_id,
                    column_id,
                    index,
                });
            }

            Operation::MapRowId {
                sheet_id,
                row_id,
                index,
            } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                sheet.set_row_id(row_id, index);
                multiplayer_operations.push(Operation::MapRowId {
                    sheet_id,
                    row_id,
                    index,
                });
            }
        };
        reverse_operations
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn execute(gc: &mut GridController, operation: Operation) {
        let mut cells_updated = IndexSet::new();
        let mut cells_to_compute = IndexSet::new();
        let mut summary = TransactionSummary::default();
        let mut sheets_with_changed_bounds = HashSet::new();
        gc.execute_operation(
            operation,
            &mut cells_updated,
            &mut cells_to_compute,
            &mut summary,
            &mut sheets_with_changed_bounds,
            false,
            &mut vec![],
        );
    }

    #[test]
    fn test_execute_operation_set_sheet_color() {
        let mut gc = GridController::new();
        let sheet_id = gc.sheet_ids()[0];
        let color = Some("red".to_string());
        let operation = Operation::SetSheetColor {
            sheet_id,
            color: color.clone(),
        };

        assert_eq!(
            format!("{:?}", operation),
            format!(
                "SetSheetColor {{ sheet_id: SheetId {{ id: {} }}, color: Some(\"red\") }}",
                sheet_id
            )
        );

        execute(&mut gc, operation);
        assert_eq!(gc.grid.sheets()[0].color, color);
    }

    #[test]
    fn test_execute_operation_resize_column() {
        let mut gc = GridController::new();
        let sheet = &mut gc.grid_mut().sheets_mut()[0];
        let (column, _) = sheet.get_or_create_column(0);
        let column_id = column.id;
        let sheet_id = sheet.id;
        let new_size = 100.0;
        let operation = Operation::ResizeColumn {
            sheet_id,
            column: column_id,
            new_size,
        };

        assert_eq!(
            format!("{:?}", operation),
            format!(
                "ResizeColumn {{ sheet_id: SheetId {{ id: {} }}, column: ColumnId {{ id: {} }}, new_size: {:.1} }}",
                sheet_id, column_id, new_size
            )
        );

        execute(&mut gc, operation);
        let column_width = gc.grid.sheets()[0].offsets.column_width(0);
        assert_eq!(column_width, new_size);
    }

    #[test]
    fn test_execute_operation_resize_row() {
        let mut gc = GridController::new();
        let sheet = &mut gc.grid_mut().sheets_mut()[0];
        let (row, _) = sheet.get_or_create_row(0);
        let row_id = row;
        let sheet_id = sheet.id;
        let new_size = 100.0;
        let operation = Operation::ResizeRow {
            sheet_id,
            row: row_id,
            new_size,
        };

        assert_eq!(
            format!("{:?}", operation),
            format!(
                "ResizeRow {{ sheet_id: SheetId {{ id: {} }}, row: RowId {{ id: {} }}, new_size: {:.1} }}",
                sheet_id, row_id, new_size
            )
        );

        execute(&mut gc, operation);
        let row_height = gc.grid.sheets()[0].offsets.row_height(0);
        assert_eq!(row_height, new_size);
    }
}
