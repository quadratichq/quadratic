use core::fmt;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    cell_values::CellValues,
    grid::{
        file::sheet_schema::SheetSchema,
        formats::Formats,
        formatting::CellFmtArray,
        js_types::JsRowHeight,
        sheet::{borders::BorderStyleCellUpdates, validations::validation::Validation},
        CodeRun, CodeRunOld, Sheet, SheetBorders, SheetId,
    },
    selection::Selection,
    SheetPos, SheetRect,
};

/// Determine whether to copy the formats during an Insert operation from the
/// column/row before or after (or none).
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub enum CopyFormats {
    Before,
    After,
    None,
}

/// It might be better to Box the SheetSchema to avoid the large enum variant.
/// But that requires versioning, which isn't worth the change in serialization.
/// The difference in bytes per operation is around 500 bytes, so not the end of
/// the world. Something to fix down the road.
#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Operation {
    SetCellValues {
        sheet_pos: SheetPos,
        values: CellValues,
    },

    // Deprecated in favor of SetCodeRunVersion (this works for < v1.7)
    SetCodeRun {
        sheet_pos: SheetPos,
        code_run: Option<CodeRunOld>,
        index: usize,
    },
    SetCodeRunVersion {
        sheet_pos: SheetPos,
        code_run: Option<CodeRun>,
        index: usize,

        // this is a simple versioning for breaking changes to CodeRun
        version: u16,
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

    // Deprecated. Use SetBordersSelection instead.
    SetBorders {
        sheet_rect: SheetRect,
        borders: SheetBorders,
    },

    SetBordersSelection {
        selection: Selection,
        borders: BorderStyleCellUpdates,
    },

    // Sheet metadata operations

    // Deprecated. Use AddSheetSchema instead.
    AddSheet {
        sheet: Sheet,
    },

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

        // `client_resized` is used to indicate whether the client needs to be
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

    ResizeRows {
        sheet_id: SheetId,
        row_heights: Vec<JsRowHeight>,
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

    SetValidation {
        validation: Validation,
    },
    RemoveValidation {
        sheet_id: SheetId,
        validation_id: Uuid,
    },
    SetValidationWarning {
        sheet_pos: SheetPos,
        validation_id: Option<Uuid>,
    },

    DeleteColumn {
        sheet_id: SheetId,
        column: i64,
    },
    DeleteRow {
        sheet_id: SheetId,
        row: i64,
    },
    InsertColumn {
        sheet_id: SheetId,
        column: i64,
        copy_formats: CopyFormats,
    },
    InsertRow {
        sheet_id: SheetId,
        row: i64,
        copy_formats: CopyFormats,
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
            Operation::SetCodeRunVersion {
                sheet_pos,
                code_run: run,
                index,
                version,
            } => write!(
                fmt,
                "SetCellRun {{ sheet_pos: {} code_cell_value: {:?} index: {} version: {} }}",
                sheet_pos, run, index, version
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
            Operation::ResizeRows {
                sheet_id,
                row_heights,
            } => write!(
                fmt,
                "ResizeRow {{ sheet_id: {}, row_heights: {:?} }}",
                sheet_id, row_heights
            ),
            Operation::SetBorders { .. } => write!(fmt, "SetBorders {{ todo }}"),
            Operation::SetBordersSelection { selection, borders } => write!(
                fmt,
                "SetBordersSelection {{ selection: {:?}, borders: {:?} }}",
                selection, borders
            ),
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
            Operation::SetValidation { validation } => {
                write!(fmt, "SetValidation {{ validation: {:?} }}", validation)
            }
            Operation::RemoveValidation {
                sheet_id,
                validation_id,
            } => {
                write!(
                    fmt,
                    "RemoveValidation {{ sheet_id: {}, validation_id: {} }}",
                    sheet_id, validation_id
                )
            }
            Operation::SetValidationWarning {
                sheet_pos,
                validation_id,
            } => {
                write!(
                    fmt,
                    "SetValidationWarning {{ sheet_pos: {:?}, validation_id: {:?} }}",
                    sheet_pos, validation_id
                )
            }
            Operation::DeleteColumn { sheet_id, column } => {
                write!(
                    fmt,
                    "DeleteColumn {{ sheet_id: {}, column: {} }}",
                    sheet_id, column
                )
            }
            Operation::DeleteRow { sheet_id, row } => {
                write!(fmt, "DeleteRow {{ sheet_id: {}, row: {} }}", sheet_id, row)
            }
            Operation::InsertColumn {
                sheet_id,
                column,
                copy_formats,
            } => {
                write!(
                    fmt,
                    "InsertColumn {{ sheet_id: {sheet_id}, column: {column}, copy_formats: {copy_formats:?} }}"
                )
            }
            Operation::InsertRow {
                sheet_id,
                row,
                copy_formats,
            } => {
                write!(
                    fmt,
                    "InsertRow {{ sheet_id: {sheet_id}, row: {row}, copy_formats: {copy_formats:?} }}"
                )
            }
        }
    }
}
