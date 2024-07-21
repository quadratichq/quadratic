use core::fmt;
use serde::{Deserialize, Serialize};

use crate::{
    cell_values::CellValues,
    grid::{
        file::sheet_schema::SheetSchema, formats::Formats, formatting::CellFmtArray, CodeRun,
        Sheet, SheetBorders, SheetId,
    },
    selection::Selection,
    SheetPos, SheetRect,
};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Operation {
    SetCellValues {
        sheet_pos: SheetPos,
        values: CellValues,
    },
    SetCodeRun {
        sheet_pos: SheetPos,
        code_run: Option<CodeRun>,
        index: usize,
    },
    ComputeCode {
        sheet_pos: SheetPos,
    },

    // Deprecated. Use SetCellFormatsSelection instead.
    SetCellFormats {
        sheet_rect: SheetRect,
        attr: CellFmtArray,
    },

    SetCellFormatsSelection {
        selection: Selection,
        formats: Formats,
    },

    SetBorders {
        sheet_rect: SheetRect,
        borders: SheetBorders,
    },

    // Sheet metadata operations

    // This operation is deprecated in favor of AddSheetSchema. It is kept here
    // to ensure Offline operations continue to work. It should be removed in
    // the future.
    AddSheet {
        sheet: Sheet,
    },

    // This replaces the deprecated AddSheet operation. It uses the schema
    // instead of the actual Sheet to ensure compatibility with future Sheet
    // changes. We will continue to add new schema versions as needed.
    AddSheetSchema {
        schema: SheetSchema,
    },

    DuplicateSheet {
        sheet_id: SheetId,
        new_sheet_id: SheetId,
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

    // Sheet offsets operations
    ResizeColumn {
        sheet_id: SheetId,
        column: i64,
        new_size: f64,

        // `client_resized`` is used to indicate whether the client needs to be
        // notified of the resize. For manual resizing, the original client is
        // updated as the user drags the column/row so they don't need to be
        // notified again.
        #[serde(default)]
        client_resized: bool,
    },
    ResizeRow {
        sheet_id: SheetId,
        row: i64,
        new_size: f64,

        // See note in ResizeColumn.
        #[serde(default)]
        client_resized: bool,
    },

    // Deprecated in favor of SetCursorSelection. This operation remains to
    // support offline operations for now.
    SetCursor {
        sheet_rect: SheetRect,
    },

    // used for User transactions to set cursor (eg, Paste)
    SetCursorSelection {
        selection: Selection,
    },

    MoveCells {
        source: SheetRect,
        dest: SheetPos,
    },
}

impl fmt::Display for Operation {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Operation::SetCellValues { values, .. } => {
                write!(fmt, "SetCellValues {{ value count: {} }}", values.size())
            }
            Operation::ComputeCode { sheet_pos } => {
                write!(fmt, "ComputeCode {{ sheet_pos: {} }}", sheet_pos)
            }
            Operation::SetCodeRun {
                sheet_pos,
                code_run: run,
                index,
            } => write!(
                fmt,
                "SetCellRun {{ sheet_pos: {} code_cell_value: {:?} index: {} }}",
                sheet_pos, run, index
            ),
            Operation::SetCellFormats { .. } => write!(fmt, "SetCellFormats {{ todo }}",),
            Operation::SetCellFormatsSelection { selection, formats } => {
                write!(
                    fmt,
                    "SetCellFormatsSelection {{ selection: {:?} formats: {:?} }}",
                    selection, formats
                )
            }
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
                client_resized,
            } => write!(
                fmt,
                "ResizeColumn {{ sheet_id: {}, column: {}, new_size: {}, client_resized: {} }}",
                sheet_id, column, new_size, client_resized
            ),
            Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
                client_resized,
            } => write!(
                fmt,
                "ResizeRow {{ sheet_id: {}, row: {}, new_size: {}, client_resized: {} }}",
                sheet_id, row, new_size, client_resized
            ),
            Operation::SetBorders { .. } => write!(fmt, "SetBorders {{ todo }}"),
            Operation::SetCursor { sheet_rect } => {
                write!(fmt, "SetCursor {{ sheet_rect: {} }}", sheet_rect)
            }
            Operation::SetCursorSelection { selection } => {
                write!(fmt, "SetCursorSelection {{ selection: {:?} }}", selection)
            }
            Operation::DuplicateSheet {
                sheet_id,
                new_sheet_id,
            } => {
                write!(
                    fmt,
                    "DuplicateSheet {{ sheet_id: {} new_sheet_id: {} }}",
                    sheet_id, new_sheet_id
                )
            }
            Operation::MoveCells { source, dest } => {
                write!(fmt, "MoveCells {{ source: {} dest: {} }}", source, dest)
            }
            Operation::AddSheetSchema { schema } => {
                write!(fmt, "AddSheetSchema {{ schema: {:?} }}", schema)
            }
        }
    }
}
