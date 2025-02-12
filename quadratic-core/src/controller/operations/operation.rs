use core::fmt;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    a1::A1Selection,
    cell_values::CellValues,
    grid::{
        data_table::{column_header::DataTableColumnHeader, sort::DataTableSort},
        file::sheet_schema::SheetSchema,
        formats::{Formats, SheetFormatUpdates},
        formatting::CellFmtArray,
        js_types::JsRowHeight,
        sheet::{
            borders::{
                borders_old::{BorderStyleCellUpdates, SheetBorders},
                BordersUpdates,
            },
            validations::validation::Validation,
        },
        CodeRunOld, DataTable, DataTableKind, Sheet, SheetId,
    },
    selection::OldSelection,
    CellValue, CopyFormats, SheetPos, SheetRect,
};

/// Description of changes to make to a file.
///
/// Multiple operations can be included in a single
/// [`crate::controller::Transaction`].
///
/// We must maintain compatibility with past versions of `Operation` (since
/// users may want to sync offline changes from a previous version), so be very
/// careful when making serialization-breaking changes.
#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Operation {
    /// Sets cell values for some or all cells in a rectangle.
    SetCellValues {
        sheet_pos: SheetPos,
        values: CellValues,
    },

    /// **Deprecated** Nov 2024 in favor of `SetCodeRunVersion`.
    ///
    /// This works for < v1.7.
    SetDataTable {
        sheet_pos: SheetPos,
        data_table: Option<DataTable>,
        index: usize,
    },
    AddDataTable {
        sheet_pos: SheetPos,
        data_table: DataTable,
        cell_value: CellValue,
    },
    DeleteDataTable {
        sheet_pos: SheetPos,
    },
    SetChartSize {
        sheet_pos: SheetPos,
        pixel_width: f32,
        pixel_height: f32,
    },
    SetDataTableAt {
        sheet_pos: SheetPos,
        values: CellValues,
    },
    FlattenDataTable {
        sheet_pos: SheetPos,
    },
    SwitchDataTableKind {
        sheet_pos: SheetPos,
        kind: DataTableKind,
    },
    GridToDataTable {
        sheet_rect: SheetRect,
    },
    DataTableMeta {
        sheet_pos: SheetPos,
        name: Option<String>,
        alternating_colors: Option<bool>,
        columns: Option<Vec<DataTableColumnHeader>>,
        show_ui: Option<bool>,
        show_name: Option<bool>,
        show_columns: Option<bool>,
        readonly: Option<bool>,
    },
    DataTableFormats {
        sheet_pos: SheetPos,
        formats: SheetFormatUpdates,
    },
    DataTableBorders {
        sheet_pos: SheetPos,
        borders: BordersUpdates,
    },
    SortDataTable {
        sheet_pos: SheetPos,
        sort: Option<Vec<DataTableSort>>,
    },
    DataTableFirstRowAsHeader {
        sheet_pos: SheetPos,
        first_row_is_header: bool,
    },
    InsertDataTableColumn {
        sheet_pos: SheetPos,
        index: u32,
        column_header: Option<String>,
        values: Option<Vec<CellValue>>,

        /// swallow neighboring cells
        swallow: bool,
    },
    DeleteDataTableColumn {
        sheet_pos: SheetPos,
        index: u32,

        /// Inserts the removed column into sheet at the same position.
        flatten: bool,
    },
    InsertDataTableRow {
        sheet_pos: SheetPos,
        index: u32,
        values: Option<Vec<CellValue>>,

        /// swallow neighboring cells
        swallow: bool,
    },
    DeleteDataTableRow {
        sheet_pos: SheetPos,
        index: u32,

        /// Inserts the removed row into sheet at the same position.
        flatten: bool,
    },
    SetCodeRun {
        sheet_pos: SheetPos,
        code_run: Option<CodeRunOld>,
        index: usize,
    },
    /// Sets a code run.
    SetCodeRunVersion {
        sheet_pos: SheetPos,
        code_run: Option<CodeRunOld>,
        index: usize,

        /// Simple version for tracking breaking changes to [`CodeRun`].
        version: u16,
    },
    /// Runs the code cell at a specific position.
    ComputeCode {
        sheet_pos: SheetPos,
    },

    /// **Deprecated** Nov 2024 in favor of `SetCellFormatsA1`.
    SetCellFormats {
        sheet_rect: SheetRect,
        attr: CellFmtArray,
    },
    /// **Deprecated** Nov 2024 in favor of `SetCellFormatsA1`.
    SetCellFormatsSelection {
        selection: OldSelection,
        formats: Formats,
    },
    /// Updates cell formats for all cells in a selection.
    SetCellFormatsA1 {
        sheet_id: SheetId,
        formats: SheetFormatUpdates,
    },

    /// **Deprecated** Nov 2024 in favor of `SetBordersA1`.
    SetBorders {
        sheet_rect: SheetRect,
        borders: SheetBorders,
    },
    /// **Deprecated** Nov 2024 in favor of `SetBordersA1`.
    SetBordersSelection {
        selection: OldSelection,
        borders: BorderStyleCellUpdates,
    },
    /// Updates borders for all cells in a selection.
    SetBordersA1 {
        sheet_id: SheetId,
        borders: BordersUpdates,
    },

    /// **Deprecated** Nov 2024 in favor of `AddSheetSchema`.
    AddSheet {
        sheet: Box<Sheet>,
    }, // very big!
    /// Adds a sheet.
    AddSheetSchema {
        schema: Box<SheetSchema>,
    }, // very big!
    /// Duplicates an existing sheet.
    DuplicateSheet {
        sheet_id: SheetId,
        new_sheet_id: SheetId,
    },
    /// Deletes an existing sheet.
    DeleteSheet {
        sheet_id: SheetId,
    },
    /// Sets a sheet's name.
    SetSheetName {
        sheet_id: SheetId,
        name: String,
    },
    /// Sets a sheet's color.
    SetSheetColor {
        sheet_id: SheetId,
        color: Option<String>,
    },
    /// Reorders a sheet.
    ReorderSheet {
        target: SheetId,
        order: String,
    },

    /// Resizes a single column.
    ResizeColumn {
        sheet_id: SheetId,
        column: i64,
        new_size: f64,

        /// Whether the client needs to be notified of the resize. For manual
        /// resizing, the original client is updated as the user drags the
        /// column/row so they don't need to be notified again.
        #[serde(default)]
        client_resized: bool,
    },
    /// Resizes a single row.
    ResizeRow {
        sheet_id: SheetId,
        row: i64,
        new_size: f64,

        /// See note in `ResizeColumn.client_resized`.
        #[serde(default)]
        client_resized: bool,
    },

    /// Resizes several rows.
    ResizeRows {
        sheet_id: SheetId,
        row_heights: Vec<JsRowHeight>,
    },

    /// **Deprecated** Nov 2024 in favor of `SetCursorA1`.
    SetCursor {
        sheet_rect: SheetRect,
    },
    /// **Deprecated** Nov 2024 in favor of `SetCursorA1`.
    SetCursorSelection {
        selection: OldSelection,
    },
    /// Sets the cursor selection. This is used when pasting data.
    SetCursorA1 {
        selection: A1Selection,
    },

    /// Moves all cells in a rectangle.
    MoveCells {
        source: SheetRect,
        dest: SheetPos,
    },

    /// Creates or updates a data validation rule.
    SetValidation {
        validation: Validation,
    },
    /// Deletes a data validation rule.
    RemoveValidation {
        sheet_id: SheetId,
        validation_id: Uuid,
    },
    /// Creates, updates, or deletes a data validation warning.
    SetValidationWarning {
        sheet_pos: SheetPos,
        validation_id: Option<Uuid>,
    },

    /// Deletes a column.
    DeleteColumn {
        sheet_id: SheetId,
        column: i64,
    },
    /// Deletes a row.
    DeleteRow {
        sheet_id: SheetId,
        row: i64,
    },
    /// Inserts a column.
    InsertColumn {
        sheet_id: SheetId,
        column: i64,
        copy_formats: CopyFormats,
    },
    /// Inserts a row.
    InsertRow {
        sheet_id: SheetId,
        row: i64,
        copy_formats: CopyFormats,
    },
}

// TODO: either remove this or add a comment explaining why it's better than the
// debug impl.
impl fmt::Display for Operation {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Operation::SetCellValues { values, .. } => {
                write!(fmt, "SetCellValues {{ value count: {} }}", values.size())
            }
            Operation::ComputeCode { sheet_pos } => {
                write!(fmt, "ComputeCode {{ sheet_pos: {} }}", sheet_pos)
            }
            Operation::SetDataTable {
                sheet_pos,
                data_table: run,
                index,
            } => write!(
                fmt,
                "SetDataTable {{ sheet_pos: {} data_table: {:?}, index: {} }}",
                sheet_pos, run, index
            ),
            Operation::AddDataTable {
                sheet_pos,
                data_table,
                cell_value,
            } => write!(
                fmt,
                "AddDataTable {{ sheet_pos: {} data_table: {:?} cell_value: {:?} }}",
                sheet_pos, data_table, cell_value
            ),
            Operation::DeleteDataTable { sheet_pos } => {
                write!(fmt, "DeleteDataTable {{ sheet_pos: {} }}", sheet_pos)
            }
            Operation::SetCodeRun {
                sheet_pos,
                code_run: run,
                index,
            } => write!(
                fmt,
                "SetCellRun {{ sheet_pos: {} code_cell_value: {:?}, index: {} }}",
                sheet_pos, run, index
            ),
            Operation::SetDataTableAt { sheet_pos, values } => write!(
                fmt,
                "SetDataTableAt {{ sheet_pos: {} values: {:?} }}",
                sheet_pos, values
            ),
            Operation::FlattenDataTable { sheet_pos } => {
                write!(fmt, "FlattenDataTable {{ sheet_pos: {} }}", sheet_pos)
            }
            Operation::SwitchDataTableKind { sheet_pos, kind } => {
                write!(
                    fmt,
                    "SwitchDataTableKind {{ sheet_pos: {}, kind: {} }}",
                    sheet_pos, kind
                )
            }
            Operation::GridToDataTable { sheet_rect } => {
                write!(fmt, "GridToDataTable {{ sheet_rect: {} }}", sheet_rect)
            }
            Operation::DataTableMeta {
                sheet_pos,
                name,
                alternating_colors,
                columns,
                show_ui,
                show_name,
                show_columns,
                readonly,
            } => {
                write!(
                    fmt,
                    "DataTableMeta {{ sheet_pos: {} name: {:?} alternating_colors: {:?} columns: {:?} show_ui: {:?} show_name: {:?} show_columns: {:?} readonly: {:?} }}",
                    sheet_pos, name, alternating_colors, columns, show_ui, show_name, show_columns, readonly
                )
            }
            Operation::DataTableFormats { sheet_pos, formats } => {
                write!(
                    fmt,
                    "DataTableFormat {{ sheet_pos: {}, formats: {:?} }}",
                    sheet_pos, formats
                )
            }
            Operation::DataTableBorders { sheet_pos, borders } => {
                write!(
                    fmt,
                    "DataTableBorders {{ sheet_pos: {}, borders: {:?} }}",
                    sheet_pos, borders
                )
            }
            Operation::SortDataTable { sheet_pos, sort } => {
                write!(
                    fmt,
                    "SortDataTable {{ sheet_pos: {}, sort: {:?} }}",
                    sheet_pos, sort
                )
            }
            Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header,
            } => {
                write!(
                    fmt,
                    "DataTableFirstRowAsHeader {{ sheet_pos: {}, first_row_is_header {} }}",
                    sheet_pos, first_row_is_header
                )
            }
            Operation::InsertDataTableColumn {
                sheet_pos,
                index,
                column_header: name,
                values,
                swallow,
            } => {
                write!(
                    fmt,
                    "InsertDataTableColumn {{ sheet_pos: {}, index: {}, name: {:?}, values: {:?}, swallow: {} }}",
                    sheet_pos, index, name, values,swallow
                )
            }
            Operation::DeleteDataTableColumn {
                sheet_pos,
                index,
                flatten,
            } => {
                write!(
                    fmt,
                    "DeleteDataTableColumn {{ sheet_pos: {}, index: {}, flatten: {} }}",
                    sheet_pos, index, flatten
                )
            }
            Operation::InsertDataTableRow {
                sheet_pos,
                index,
                values,
                swallow,
            } => {
                write!(
                    fmt,
                    "InsertDataTableRow {{ sheet_pos: {}, index: {}, values: {:?}, swallow: {} }}",
                    sheet_pos, index, values, swallow
                )
            }
            Operation::DeleteDataTableRow {
                sheet_pos,
                index,
                flatten,
            } => {
                write!(
                    fmt,
                    "DeleteDataTableRow {{ sheet_pos: {}, index: {}, flatten: {} }}",
                    sheet_pos, index, flatten
                )
            }
            Operation::SetCellFormats { .. } => write!(fmt, "SetCellFormats - deprecated",),
            Operation::SetCodeRunVersion {
                sheet_pos,
                code_run: run,
                index,
                version,
            } => write!(
                fmt,
                "SetCellRun {{ sheet_pos: {} code_cell_value: {:?}, index: {} version: {} }}",
                sheet_pos, run, index, version
            ),
            Operation::SetCellFormatsSelection { selection, formats } => {
                write!(
                    fmt,
                    "SetCellFormatsSelection {{ selection: {:?}, formats: {:?} }}",
                    selection, formats
                )
            }
            Operation::SetCellFormatsA1 { sheet_id, formats } => {
                write!(
                    fmt,
                    "SetCellFormatsA1 {{ sheet_id: {}, formats: {:?} }}",
                    sheet_id, formats
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
                "ReorderSheet {{ target: {}, order: {:?} }}",
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
            Operation::SetBorders { .. } => write!(fmt, "SetBorders {{ [deprecated] }}"),
            Operation::SetBordersSelection { selection, borders } => write!(
                fmt,
                "SetBordersSelection {{ selection: {:?}, borders: {:?} }}",
                selection, borders
            ),
            Operation::SetBordersA1 { sheet_id, borders } => write!(
                fmt,
                "SetBordersA1 {{ sheet_id: {:?}, borders: {:?} }}",
                sheet_id, borders
            ),
            Operation::SetCursor { sheet_rect } => {
                write!(fmt, "SetCursor {{ sheet_rect: {} }}", sheet_rect)
            }
            Operation::SetCursorSelection { selection } => {
                write!(fmt, "SetCursorSelection {{ selection: {:?} }}", selection)
            }
            Operation::SetCursorA1 { selection } => {
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
            Operation::SetChartSize {
                sheet_pos,
                pixel_width,
                pixel_height,
            } => write!(
                fmt,
                "SetChartSize {{ sheet_pos: {}, pixel_width: {}, pixel_height: {} }}",
                sheet_pos, pixel_width, pixel_height
            ),
        }
    }
}
