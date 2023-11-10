use std::collections::HashSet;

use indexmap::IndexSet;

use crate::{grid::*, values::IsBlank, Array, CellValue};

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
        cells_to_compute: &mut IndexSet<CellRef>,
        summary: &mut TransactionSummary,
        sheets_with_changed_bounds: &mut HashSet<SheetId>,
        compute: bool,
    ) -> Vec<Operation> {
        let mut reverse_operations = vec![];
        let mut cells_deleted = vec![];

        match op {
            Operation::SetCellValues { region, values } => {
                sheets_with_changed_bounds.insert(region.sheet);
                let sheet = self.grid.sheet_mut_from_id(region.sheet);

                let size = region.size().expect("msg: error getting size of region");
                let old_values = region
                    .iter()
                    .zip(values.into_cell_values_vec())
                    .map(|(cell_ref, value)| {
                        let pos = sheet.cell_ref_to_pos(cell_ref)?;
                        if value.is_blank() {
                            cells_deleted.push(pos);
                        } else {
                            cells_to_compute.insert(cell_ref);
                        }
                        summary
                            .cell_sheets_modified
                            .insert(CellSheetsModified::new(sheet.id, pos));
                        let response = sheet.set_cell_value(pos, value)?;
                        Some(response.old_value)
                    })
                    .map(|old_value| old_value.unwrap_or(CellValue::Blank))
                    .collect();

                let old_values = Array::new_row_major(size, old_values)
                    .expect("error constructing array of old values for SetCells operation");

                self.check_spills(
                    region.clone(),
                    cells_to_compute,
                    summary,
                    &mut reverse_operations,
                );

                reverse_operations.push(Operation::SetCellValues {
                    region,
                    values: old_values,
                });
            }
            Operation::SetCellCode {
                cell_ref,
                code_cell_value,
            } => {
                sheets_with_changed_bounds.insert(cell_ref.sheet);

                let sheet = self.grid.sheet_mut_from_id(cell_ref.sheet);
                let old_code_cell_value = sheet.get_code_cell_from_ref(cell_ref).cloned();
                let pos = if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                    pos
                } else {
                    return reverse_operations;
                };

                // for compute, we keep the original cell output to avoid flashing of output (since values will be overridden once computation is complete)
                if compute {
                    if let Some(code_cell_value) = code_cell_value {
                        let updated_code_cell_value =
                            if let Some(old_code_cell_value) = old_code_cell_value.as_ref() {
                                let mut updated_code_cell_value = code_cell_value.clone();
                                updated_code_cell_value.output = old_code_cell_value.output.clone();
                                updated_code_cell_value
                            } else {
                                code_cell_value
                            };
                        sheet.set_code_cell_value(pos, Some(updated_code_cell_value));
                    } else {
                        sheet.set_code_cell_value(pos, code_cell_value);
                    }
                    cells_to_compute.insert(cell_ref);
                } else {
                    // need to update summary (cells_to_compute will be ignored)
                    fetch_code_cell_difference(
                        sheet,
                        pos,
                        old_code_cell_value.clone(),
                        code_cell_value.clone(),
                        summary,
                        cells_to_compute,
                    );
                    sheet.set_code_cell_value(pos, code_cell_value);
                }
                summary
                    .cell_sheets_modified
                    .insert(CellSheetsModified::new(sheet.id, pos));
                summary.code_cells_modified.insert(cell_ref.sheet);
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

                let old_attr = match attr {
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
                };
                reverse_operations.push(Operation::SetCellFormats {
                    region,
                    attr: old_attr,
                });
            }
            Operation::SetBorders { region, borders } => {
                sheets_with_changed_bounds.insert(region.sheet);
                summary.border_sheets_modified.push(region.sheet);
                let sheet = self.grid.sheet_mut_from_id(region.sheet);

                let old_borders = sheet.set_region_borders(&region, borders);
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
                    .add_sheet(Some(sheet))
                    .expect("duplicate sheet name");
                summary.sheet_list_modified = true;

                reverse_operations.push(Operation::DeleteSheet { sheet_id });
            }
            Operation::DeleteSheet { sheet_id } => {
                let deleted_sheet = self.grid.remove_sheet(sheet_id);
                summary.sheet_list_modified = true;

                reverse_operations.push(Operation::AddSheet {
                    sheet: deleted_sheet,
                });
            }
            Operation::ReorderSheet { target, order } => {
                let sheet = self.grid.sheet_from_id(target);
                let original_order = sheet.order.clone();
                self.grid.move_sheet(target, order);
                summary.sheet_list_modified = true;

                reverse_operations.push(Operation::ReorderSheet {
                    target,
                    order: original_order,
                });
            }
            Operation::SetSheetName { sheet_id, name } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_name = sheet.name.clone();
                sheet.name = name;
                summary.sheet_list_modified = true;

                reverse_operations.push(Operation::SetSheetName {
                    sheet_id,
                    name: old_name,
                });
            }
            Operation::SetSheetColor { sheet_id, color } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_color = sheet.color.clone();
                sheet.color = color;
                summary.sheet_list_modified = true;

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
                    reverse_operations.push(Operation::ResizeRow {
                        sheet_id,
                        row,
                        new_size: old_size,
                    });
                }
            }
        };
        reverse_operations
    }
}
