// use core::fmt;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    CellValue, ClearOption, CopyFormats, SheetPos, SheetRect,
    a1::A1Selection,
    cell_values::CellValues,
    grid::{
        CodeCellLanguage, DataTable, DataTableKind, Sheet, SheetId,
        data_table::{
            DataTableTemplate, column_header::DataTableColumnHeader, sort::DataTableSort,
        },
        file::sheet_schema::SheetSchema,
        formats::{Formats, SheetFormatUpdates},
        formatting::CellFmtArray,
        js_types::{JsColumnWidth, JsRowHeight},
        sheet::{
            borders::{
                BordersUpdates,
                borders_old::{BorderStyleCellUpdates, SheetBorders},
            },
            conditional_format::ConditionalFormat,
            merge_cells::MergeCellsUpdate,
            validations::validation::Validation,
        },
    },
    selection::OldSelection,
    util::is_false,
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
    /// Adds, deletes or replaces a data table at a specific SheetPos.
    SetDataTable {
        sheet_pos: SheetPos,
        data_table: Option<DataTable>,
        index: usize,

        // If true, the old data table properties will not be preserved
        #[serde(skip_serializing_if = "is_false", default)]
        ignore_old_data_table: bool,
    },
    /// **Deprecated** (Sept 2025) and replaced with SetDataTable
    AddDataTable {
        sheet_pos: SheetPos,
        data_table: DataTable,
        cell_value: CellValue,

        // Used to insert a data table at a specific index (usually after an
        // undo action)
        #[serde(default)]
        index: Option<usize>,
    },
    DeleteDataTable {
        sheet_pos: SheetPos,
    },
    // **Deprecated** and replaced with SetChartCellSize
    SetChartSize {
        sheet_pos: SheetPos,
        pixel_width: f32,
        pixel_height: f32,
    },
    SetChartCellSize {
        sheet_pos: SheetPos,
        w: u32,
        h: u32,
    },
    SetDataTableAt {
        sheet_pos: SheetPos,
        values: CellValues,
    },
    MoveDataTable {
        old_sheet_pos: SheetPos,
        new_sheet_pos: SheetPos,
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
    // **Deprecated** and replaced with DataTableOptionMeta
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
    DataTableOptionMeta {
        sheet_pos: SheetPos,
        name: Option<String>,
        alternating_colors: Option<bool>,
        columns: Option<Vec<DataTableColumnHeader>>,
        show_name: Option<ClearOption<bool>>,
        show_columns: Option<ClearOption<bool>>,
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
        display_buffer: Option<Option<Vec<u64>>>,
    },
    DataTableFirstRowAsHeader {
        sheet_pos: SheetPos,
        first_row_is_header: bool,
    },
    InsertDataTableColumns {
        sheet_pos: SheetPos,

        // Vec<(column_index, column_header, values)>
        // the column index is the actual index, not the display index
        columns: Vec<(u32, Option<String>, Option<Vec<CellValue>>)>,

        /// swallow neighboring cells
        swallow: bool,

        /// select the table after the operation
        select_table: bool,

        #[serde(default)]
        copy_formats_from: Option<u32>,

        #[serde(default)]
        copy_formats: Option<CopyFormats>,
    },
    DeleteDataTableColumns {
        sheet_pos: SheetPos,

        // Vec<column_index>
        // the column index is the actual index, not the display index
        columns: Vec<u32>,

        /// Inserts the removed column into sheet at the same position.
        flatten: bool,

        /// select the table after the operation
        select_table: bool,
    },
    InsertDataTableRows {
        sheet_pos: SheetPos,

        // Vec<(row_index, values)>
        // the row index is the display index, not the actual index
        rows: Vec<(u32, Option<Vec<CellValue>>)>,

        /// swallow neighboring cells
        swallow: bool,

        /// select the table after the operation
        select_table: bool,

        #[serde(default)]
        copy_formats_from: Option<u32>,

        #[serde(default)]
        copy_formats: Option<CopyFormats>,
    },
    DeleteDataTableRows {
        sheet_pos: SheetPos,

        // Vec<row_index>
        // the row index is the display index, not the actual index
        rows: Vec<u32>,

        // Inserts the removed row into sheet at the same position.
        flatten: bool,

        // select the table after the operation
        select_table: bool,
    },
    /// Runs the code cell at a specific position.
    ComputeCode {
        sheet_pos: SheetPos,
    },
    /// Sets code and computes it in one operation (avoids double finalization).
    /// Used by autocomplete for code cells.
    SetComputeCode {
        sheet_pos: SheetPos,
        language: CodeCellLanguage,
        code: String,
        /// Optional template to copy presentation properties from
        /// (show_name, show_columns, alternating_colors, etc.)
        #[serde(skip_serializing_if = "Option::is_none", default)]
        template: Option<DataTableTemplate>,
    },

    /// Runs the code cell at an A1Selection.
    /// Currently just used for scheduled tasks.
    ComputeCodeSelection {
        selection: Option<A1Selection>,
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

    /// Used for adding a new sheet, with the app, should not used for
    /// operations that sync to multiplayer or offline, i.e. forward / reverse operations
    /// Use `AddSheetSchema` for forward / reverse operations
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

        #[serde(default)]
        sheet_name: Option<String>,
    },
    /// Sets a sheet's name.
    SetSheetName {
        sheet_id: SheetId,
        name: String,

        #[serde(default)]
        old_sheet_name: Option<String>,
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
    /// Replace a sheet with a new one.
    ReplaceSheet {
        sheet_id: SheetId,
        sheet: Box<Sheet>,
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

    /// Resizes multiple columns.
    ResizeColumns {
        sheet_id: SheetId,
        column_widths: Vec<JsColumnWidth>,
    },

    /// Resizes several rows.
    ResizeRows {
        sheet_id: SheetId,
        row_heights: Vec<JsRowHeight>,
        #[serde(default)]
        client_resized: bool,
    },

    /// Changes the default row size
    DefaultRowSize {
        sheet_id: SheetId,
        size: f64,
    },

    /// Changes the default column size
    DefaultColumnSize {
        sheet_id: SheetId,
        size: f64,
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

        /// Move entire column and ignore rows.
        #[serde(default)]
        columns: bool,

        /// Move entire rows and ignore columns.
        #[serde(default)]
        rows: bool,
    },

    /// Creates or updates a data validation rule.
    SetValidation {
        validation: Validation,
    },
    /// Either finds an existing validation that matches this validation
    /// (ignoring the id) and adds the selection to it, or creates a new one.
    CreateOrUpdateValidation {
        validation: Validation,
    },
    /// Deletes a data validation rule.
    RemoveValidation {
        sheet_id: SheetId,
        validation_id: Uuid,
    },
    RemoveValidationSelection {
        sheet_id: SheetId,
        selection: A1Selection,
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

        // this is used to properly redo an InsertColumn operation
        #[serde(default)]
        copy_formats: CopyFormats,

        #[serde(default)]
        ignore_tables: bool,
    },
    /// Deletes a row.
    DeleteRow {
        sheet_id: SheetId,
        row: i64,

        // this is used to properly redo an InsertRow operation
        #[serde(default)]
        copy_formats: CopyFormats,

        #[serde(default)]
        ignore_tables: bool,
    },
    /// Inserts a column.
    InsertColumn {
        sheet_id: SheetId,
        column: i64,
        copy_formats: CopyFormats,

        #[serde(default)]
        ignore_tables: bool,
    },
    /// Inserts a row.
    InsertRow {
        sheet_id: SheetId,
        row: i64,
        copy_formats: CopyFormats,

        #[serde(default)]
        ignore_tables: bool,
    },

    MoveColumns {
        sheet_id: SheetId,
        col_start: i64,
        col_end: i64,
        to: i64,
    },
    MoveRows {
        sheet_id: SheetId,
        row_start: i64,
        row_end: i64,
        to: i64,
    },
    DeleteColumns {
        sheet_id: SheetId,
        columns: Vec<i64>,

        // this is used to properly redo an InsertColumn operation
        #[serde(default)]
        copy_formats: CopyFormats,

        #[serde(default)]
        ignore_tables: bool,
    },
    DeleteRows {
        sheet_id: SheetId,
        rows: Vec<i64>,

        // this is used to properly redo an InsertRow operation
        #[serde(default)]
        copy_formats: CopyFormats,

        #[serde(default)]
        ignore_tables: bool,
    },

    SetMergeCells {
        sheet_id: SheetId,
        merge_cells_updates: MergeCellsUpdate,
    },

    /// Creates or updates a conditional format rule.
    SetConditionalFormat {
        conditional_format: ConditionalFormat,
    },
    /// Deletes a conditional format rule.
    RemoveConditionalFormat {
        sheet_id: SheetId,
        conditional_format_id: Uuid,
    },
}
