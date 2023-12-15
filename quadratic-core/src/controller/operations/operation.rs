use core::fmt;
use serde::{Deserialize, Serialize};

use crate::{
    grid::{formatting::CellFmtArray, CodeCellValue, Sheet, SheetBorders, SheetId},
    Array, SheetPos, SheetRect,
};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Operation {
    SetCellValues {
        sheet_rect: SheetRect,
        values: Array,
    },
    SetCodeCell {
        sheet_pos: SheetPos,
        code_cell_value: Option<CodeCellValue>,
    },
    SetSpill {
        spill_rect: SheetRect,
        code_cell_sheet_pos: Option<SheetPos>,
    },
    SetCellFormats {
        sheet_rect: SheetRect,
        attr: CellFmtArray,
    },
    AddSheet {
        sheet: Sheet,
    },
    DeleteSheet {
        sheet_id: SheetId,
    },
    SetBorders {
        sheet_rect: SheetRect,
        borders: SheetBorders,
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
    ResizeColumn {
        sheet_id: SheetId,
        column: i64,
        new_size: f64,
    },
    ResizeRow {
        sheet_id: SheetId,
        row: i64,
        new_size: f64,
    },
}

impl fmt::Display for Operation {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Operation::SetCellValues { values, .. } => {
                write!(fmt, "SetCellValues {{ value count: {} }}", values.size())
            }
            Operation::SetCodeCell {
                code_cell_value, ..
            } => write!(
                fmt,
                "SetCellCode {{ code_cell_value: {:?} }}",
                code_cell_value
            ),
            Operation::SetSpill {
                spill_rect,
                code_cell_sheet_pos,
            } => write!(
                fmt,
                "SetSpill {{ pos: {:?}, code_cell_sheet_pos: {:?} }}",
                spill_rect, code_cell_sheet_pos
            ),
            Operation::SetCellFormats { .. } => write!(fmt, "SetCellFormats {{ todo }}",),
            Operation::AddSheet { sheet } => write!(fmt, "AddSheet {{ sheet: {} }}", sheet.name),
            Operation::DeleteSheet { sheet_id } => {
                write!(fmt, "DeleteSheet {{ sheet_id: {} }}", sheet_id)
            }
            Operation::SetSheetName { sheet_id, name } => {
                write!(
                    fmt,
                    "SetSheetName {{ sheet_id: {}, name: {} }}",
                    sheet_id, name
                )
            }
            Operation::SetSheetColor { sheet_id, color } => write!(
                fmt,
                "SetSheetColor {{ sheet_id: {}, color: {:?} }}",
                sheet_id, color
            ),
            Operation::ReorderSheet { target, order } => write!(
                fmt,
                "ReorderSheet {{ target: {}, order: {} }}",
                target, order
            ),
            Operation::ResizeColumn {
                sheet_id,
                column,
                new_size,
            } => write!(
                fmt,
                "ResizeColumn {{ sheet_id: {}, column: {}, new_size: {} }}",
                sheet_id, column, new_size
            ),
            Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
            } => write!(
                fmt,
                "ResizeRow {{ sheet_id: {}, row: {}, new_size: {} }}",
                sheet_id, row, new_size
            ),
            Operation::SetBorders { .. } => write!(fmt, "SetBorders {{ todo }}"),
        }
    }
}
