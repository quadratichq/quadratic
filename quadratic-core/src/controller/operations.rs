use crate::{grid::*, Array, CellValue};
use serde::{Deserialize, Serialize};

use super::{
    compute::{SheetPos, SheetRect},
    formatting::CellFmtArray,
    transactions::TransactionSummary,
    GridController,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Operation {
    SetCellValues {
        region: RegionRef,
        values: Array,
    },
    SetCellDependencies {
        cell: SheetPos,
        dependencies: Option<Vec<SheetRect>>,
    },
    SetCellFormats {
        region: RegionRef,
        attr: CellFmtArray,
    },
    AddSheet {
        sheet: Sheet,
    },
    DeleteSheet {
        sheet_id: SheetId,
    },
    SetSheetName {
        sheet_id: SheetId,
        name: String,
    },
    SetSheetColor {
        sheet_id: SheetId,
        color: Option<String>,
    },
    ReorderSheet {
        target: SheetId,
        order: String,
    },
}

impl GridController {
    /// Executes the given operation and returns the reverse operation.
    pub fn execute_operation(
        &mut self,
        op: Operation,
        summary: &mut TransactionSummary,
    ) -> Operation {
        match op {
            Operation::SetCellValues { region, values } => {
                summary
                    .cell_regions_modified
                    .extend(self.grid.region_rects(&region));

                let sheet = self.grid.sheet_mut_from_id(region.sheet);

                let size = region.size().expect("msg: error getting size of region");

                let old_values = region
                    .iter()
                    .zip(values.into_cell_values_vec())
                    .map(|(cell_ref, value)| {
                        let pos = sheet.cell_ref_to_pos(cell_ref)?;
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
            Operation::SetCellDependencies { cell, dependencies } => {
                let old_deps = self.grid.set_dependencies(cell, dependencies);

                // return reverse operation
                Operation::SetCellDependencies {
                    cell,
                    dependencies: old_deps,
                }
            }
            Operation::SetCellFormats { region, attr } => {
                match attr {
                    CellFmtArray::FillColor(_) => {
                        summary.fill_sheets_modified.push(region.sheet);
                    }
                    _ => {
                        summary
                            .cell_regions_modified
                            .extend(self.grid.region_rects(&region));
                    }
                }
                let old_attr = match attr {
                    CellFmtArray::Align(align) => CellFmtArray::Align(
                        self.set_cell_formats_for_type::<CellAlign>(&region, align),
                    ),
                    CellFmtArray::Wrap(wrap) => CellFmtArray::Wrap(
                        self.set_cell_formats_for_type::<CellWrap>(&region, wrap),
                    ),
                    CellFmtArray::NumericFormat(num_fmt) => CellFmtArray::NumericFormat(
                        self.set_cell_formats_for_type::<NumericFormat>(&region, num_fmt),
                    ),
                    CellFmtArray::NumericDecimals(num_decimals) => CellFmtArray::NumericDecimals(
                        self.set_cell_formats_for_type::<NumericDecimals>(&region, num_decimals),
                    ),
                    CellFmtArray::Bold(bold) => {
                        CellFmtArray::Bold(self.set_cell_formats_for_type::<Bold>(&region, bold))
                    }
                    CellFmtArray::Italic(italic) => CellFmtArray::Italic(
                        self.set_cell_formats_for_type::<Italic>(&region, italic),
                    ),
                    CellFmtArray::TextColor(text_color) => CellFmtArray::TextColor(
                        self.set_cell_formats_for_type::<TextColor>(&region, text_color),
                    ),
                    CellFmtArray::FillColor(fill_color) => CellFmtArray::FillColor(
                        self.set_cell_formats_for_type::<FillColor>(&region, fill_color),
                    ),
                };

                // return reverse operation
                Operation::SetCellFormats {
                    region,
                    attr: old_attr,
                }
            }
            Operation::AddSheet { sheet } => {
                // todo: need to handle the case where sheet.order overlaps another sheet order
                // this may happen after (1) delete a sheet; (2) MP update w/an added sheet; and (3) undo the deleted sheet
                let sheet_id = sheet.id.clone();
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
        }
    }
}
