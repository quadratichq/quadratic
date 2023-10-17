use core::fmt;
use serde::{Deserialize, Serialize};

use crate::{
    grid::{CellRef, CodeCellValue, ColumnId, RegionRef, RowId, Sheet, SheetId},
    Array,
};

use super::formatting::CellFmtArray;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Operation {
    None,
    SetCellValues {
        region: RegionRef,
        values: Array,
    },
    SetCellCode {
        cell_ref: CellRef,
        code_cell_value: Option<CodeCellValue>,
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
    ResizeColumn {
        sheet_id: SheetId,
        column: ColumnId,
        new_size: f64,
    },
    ResizeRow {
        sheet_id: SheetId,
        row: RowId,
        new_size: f64,
    },
}

impl fmt::Display for Operation {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Operation::None => write!(fmt, "None"),
            Operation::SetCellValues { values, .. } => {
                write!(fmt, "SetCellValues {{ value count: {} }}", values.size())
            }
            Operation::SetCellCode {
                code_cell_value, ..
            } => write!(
                fmt,
                "SetCellCode {{ code_cell_value: {:?} }}",
                code_cell_value
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
        }
    }
}
