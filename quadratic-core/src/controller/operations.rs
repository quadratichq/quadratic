use std::collections::HashSet;

use indexmap::IndexSet;

use crate::{grid::*, values::IsBlank, Array, CellValue};

use super::code_cell_update::update_code_cell_value;

use super::{
    formatting::CellFmtArray,
    operation::Operation,
    transaction_summary::{CellSheetsModified, TransactionSummary},
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
    ) -> Operation {
        let mut cells_deleted = vec![];

        let operation = match op {
            Operation::None => Operation::None,
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
                // return reverse operation
                Operation::SetCellValues {
                    region,
                    values: old_values,
                }
            }
            Operation::SetCellCode {
                cell_ref,
                code_cell_value,
            } => {
                sheets_with_changed_bounds.insert(cell_ref.sheet);
                let mut reverse_operations = vec![];
                update_code_cell_value(
                    self,
                    cell_ref,
                    code_cell_value,
                    &mut None,
                    &mut reverse_operations,
                    summary,
                );
                cells_to_compute.insert(cell_ref);
                reverse_operations[0].clone()
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

                // return reverse operation
                Operation::SetCellFormats {
                    region,
                    attr: old_attr,
                }
            }
            Operation::SetBorders { region, borders } => {
                summary.border_sheets_modified.push(region.sheet);
                let sheet = self.grid.sheet_mut_from_id(region.sheet);

                let old_borders = sheet.set_region_borders(&region, borders);
                Operation::SetBorders {
                    region,
                    borders: old_borders,
                }
            }
            Operation::AddSheet { sheet } => {
                // todo: need to handle the case where sheet.order overlaps another sheet order
                // this may happen after (1) delete a sheet; (2) MP update w/an added sheet; and (3) undo the deleted sheet
                let sheet_id = sheet.id;
                self.grid
                    .add_sheet(Some(sheet))
                    .expect("duplicate sheet name");
                summary.sheet_list_modified = true;

                // return reverse operation
                Operation::DeleteSheet { sheet_id }
            }
            Operation::DeleteSheet { sheet_id } => {
                let deleted_sheet = self.grid.remove_sheet(sheet_id);
                summary.sheet_list_modified = true;

                // return reverse operation
                Operation::AddSheet {
                    sheet: deleted_sheet,
                }
            }
            Operation::ReorderSheet { target, order } => {
                let sheet = self.grid.sheet_from_id(target);
                let original_order = sheet.order.clone();
                self.grid.move_sheet(target, order);

                // return reverse operation
                Operation::ReorderSheet {
                    target,
                    order: original_order,
                }
            }
            Operation::SetSheetName { sheet_id, name } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_name = sheet.name.clone();
                sheet.name = name;
                summary.sheet_list_modified = true;

                // return reverse operation
                Operation::SetSheetName {
                    sheet_id,
                    name: old_name,
                }
            }
            Operation::SetSheetColor { sheet_id, color } => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                let old_color = sheet.color.clone();
                sheet.color = color;
                summary.sheet_list_modified = true;

                // return reverse operation
                Operation::SetSheetColor {
                    sheet_id,
                    color: old_color,
                }
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
                    Operation::ResizeColumn {
                        sheet_id,
                        column,
                        new_size: old_size,
                    }
                } else {
                    Operation::None
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
                    Operation::ResizeRow {
                        sheet_id,
                        row,
                        new_size: old_size,
                    }
                } else {
                    Operation::None
                }
            }
        };
        operation
    }
}
