use crate::{grid::*, Array, CellValue, Pos, Rect};
use serde::{Deserialize, Serialize};

use super::{formatting::CellFmtArray, GridController};

impl GridController {
    pub fn transact_forward(&mut self, transaction: Transaction) -> TransactionSummary {
        let (reverse_transaction, summary) = self.transact(transaction);
        self.redo_stack.clear();
        self.undo_stack.push(reverse_transaction);
        summary
    }
    pub fn has_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }
    pub fn has_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }
    pub fn undo(&mut self, cursor: Option<String>) -> Option<TransactionSummary> {
        if self.undo_stack.is_empty() {
            return None;
        }
        let transaction = self.undo_stack.pop()?;
        let cursor_old = transaction.cursor.clone();
        let (mut reverse_transaction, mut summary) = self.transact(transaction);
        reverse_transaction.cursor = cursor;
        self.redo_stack.push(reverse_transaction);
        summary.cursor = cursor_old;
        Some(summary)
    }
    pub fn redo(&mut self, cursor: Option<String>) -> Option<TransactionSummary> {
        if self.redo_stack.is_empty() {
            return None;
        }
        let transaction = self.redo_stack.pop()?;
        let cursor_old = transaction.cursor.clone();
        let (mut reverse_transaction, mut summary) = self.transact(transaction);
        reverse_transaction.cursor = cursor;
        self.undo_stack.push(reverse_transaction);
        summary.cursor = cursor_old;
        Some(summary)
    }

    pub fn transact(&mut self, transaction: Transaction) -> (Transaction, TransactionSummary) {
        let mut rev_ops = vec![];
        let mut sheets_with_changed_bounds = vec![];
        let mut summary = TransactionSummary::default();
        for op in transaction.ops {
            if let Some(new_dirty_sheet) = op.sheet_with_changed_bounds() {
                if !sheets_with_changed_bounds.contains(&new_dirty_sheet) {
                    sheets_with_changed_bounds.push(new_dirty_sheet)
                }
            }
            match op {
                Operation::SetCellValues { region, values } => {
                    summary
                        .cell_regions_modified
                        .extend(self.grid.region_rects(&region));

                    let sheet = self.grid.sheet_mut_from_id(region.sheet);

                    let Some(size) = region.size() else { continue };
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
                    rev_ops.push(Operation::SetCellValues {
                        region,
                        values: old_values,
                    });
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
                        CellFmtArray::NumericDecimals(num_decimals) => {
                            CellFmtArray::NumericDecimals(
                                self.set_cell_formats_for_type::<NumericDecimals>(
                                    &region,
                                    num_decimals,
                                ),
                            )
                        }
                        CellFmtArray::Bold(bold) => CellFmtArray::Bold(
                            self.set_cell_formats_for_type::<Bold>(&region, bold),
                        ),
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
                    rev_ops.push(Operation::SetCellFormats {
                        region,
                        attr: old_attr,
                    })
                }

                Operation::AddSheet { sheet } => {
                    // todo: need to handle the case where sheet.order overlaps another sheet order
                    // this may happen after (1) delete a sheet; (2) MP update w/an added sheet; and (3) undo the deleted sheet

                    let sheet_id = sheet.id.clone();
                    self.grid
                        .add_sheet(Some(sheet))
                        .expect("duplicate sheet name");
                    summary.sheet_list_modified = true;
                    rev_ops.push(Operation::DeleteSheet { sheet_id });
                }
                Operation::DeleteSheet { sheet_id } => {
                    let deleted_sheet = self.grid.remove_sheet(sheet_id);
                    if let Some(sheet) = deleted_sheet {
                        summary.sheet_list_modified = true;
                        rev_ops.push(Operation::AddSheet { sheet });
                    }
                }

                Operation::ReorderSheet { target, order } => {
                    let sheet = self.grid.sheet_from_id(target);
                    let original_order = sheet.order.clone();
                    self.grid.move_sheet(target, order);
                    rev_ops.push(Operation::ReorderSheet {
                        target,
                        order: original_order,
                    });
                }

                Operation::SetSheetName { sheet_id, name } => {
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);
                    let old_name = sheet.name.clone();
                    sheet.name = name;
                    rev_ops.push(Operation::SetSheetName {
                        sheet_id,
                        name: old_name,
                    });
                    summary.sheet_list_modified = true;
                }

                Operation::SetSheetColor { sheet_id, color } => {
                    let sheet = self.grid.sheet_mut_from_id(sheet_id);
                    let old_color = sheet.color.clone();
                    sheet.color = color;
                    rev_ops.push(Operation::SetSheetColor {
                        sheet_id,
                        color: old_color,
                    });
                    summary.sheet_list_modified = true;
                }
            }
        }
        for dirty_sheet in sheets_with_changed_bounds {
            self.grid
                .sheet_mut_from_id(dirty_sheet)
                .recalculate_bounds();
        }
        rev_ops.reverse();

        let reverse_transaction = Transaction {
            ops: rev_ops,
            cursor: transaction.cursor,
        };

        (reverse_transaction, summary)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Transaction {
    pub ops: Vec<Operation>,
    pub cursor: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Operation {
    SetCellValues {
        region: RegionRef,
        values: Array,
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
impl Operation {
    pub fn sheet_with_changed_bounds(&self) -> Option<SheetId> {
        match self {
            Operation::SetCellValues { region, .. } => Some(region.sheet),
            Operation::SetCellFormats { region, .. } => Some(region.sheet),

            Operation::AddSheet { .. } => None,
            Operation::DeleteSheet { .. } => None,

            Operation::SetSheetColor { .. } => None,
            Operation::SetSheetName { .. } => None,

            Operation::ReorderSheet { .. } => None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct TransactionSummary {
    /// Cell and text formatting regions modified.
    pub cell_regions_modified: Vec<(SheetId, Rect)>,
    /// Sheets where any fills have been modified.
    pub fill_sheets_modified: Vec<SheetId>,
    /// Sheets where any borders have been modified.
    pub border_sheets_modified: Vec<SheetId>,

    /// Locations of code cells that were modified. They may no longer exist.
    pub code_cells_modified: Vec<(SheetId, Pos)>,

    /// Sheet metadata or order was modified.
    pub sheet_list_modified: bool,

    /// Cursor location for undo/redo operation
    pub cursor: Option<String>,
}
