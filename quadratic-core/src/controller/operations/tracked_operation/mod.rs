//! This turns Operations into TrackedOperations that can be sent to the client and
//! shared with the AI.
//!
//! This can be used to keep an active chat up to date with changes to the file.
//! It also may be used by the AI to create interesting prompts that the user
//! may execute.

use serde::Serialize;
use uuid::Uuid;

mod from_operation;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(tag = "type")]
pub enum TrackedOperation {
    /// Sets cell values in a range
    SetCellValues {
        selection: String,
    },

    /// Data table operations - simplified since table info is in context
    SetDataTable {
        selection: String,
        name: Option<String>,
        deleted: bool,
    },
    DeleteDataTable {
        selection: String,
    },
    FlattenDataTable {
        selection: String,
    },
    GridToDataTable {
        selection: String,
    },
    MoveDataTable {
        from: String,
        to: String,
    },
    SwitchDataTableKind {
        selection: String,
        kind: String,
    },

    /// Table structure changes (AI only needs to know the operation type and position)
    DataTableColumnsChanged {
        selection: String,
    },
    DataTableRowsChanged {
        selection: String,
    },
    DataTableSorted {
        selection: String,
    },
    DataTableHeaderToggled {
        selection: String,
        first_row_is_header: bool,
    },

    /// Formatting operations (simplified - just position info)
    FormatsChanged {
        sheet_name: String,
        selection: String,
    },

    /// Sheet operations
    AddSheet {
        sheet_name: String,
    },
    DeleteSheet {
        sheet_name: String,
    },
    DuplicateSheet {
        sheet_name: String,
        duplicated_sheet_name: String,
    },
    SetSheetName {
        old_sheet_name: String,
        new_sheet_name: String,
    },
    SetSheetColor {
        sheet_name: String,
        color: Option<String>,
    },
    ReorderSheet {
        sheet_name: String,
        order: String,
    },
    ReplaceSheet {
        sheet_name: String,
    },

    /// Grid structure changes
    ResizeColumn {
        sheet_name: String,
        column: i64,
        new_size: f64,
    },
    ResizeRow {
        sheet_name: String,
        row: i64,
        new_size: f64,
    },
    ColumnsResized {
        sheet_name: String,
        count: usize,
    },
    RowsResized {
        sheet_name: String,
        count: usize,
    },
    DefaultRowSize {
        sheet_name: String,
        size: f64,
    },
    DefaultColumnSize {
        sheet_name: String,
        size: f64,
    },

    /// Selection/cursor changes
    CursorChanged {
        selection: String,
    },

    /// Cell/range operations
    MoveCells {
        from: String,
        to: String,
        columns: bool,
        rows: bool,
    },

    /// Data validation
    ValidationSet {
        selection: String,
    },
    ValidationRemoved {
        sheet_name: String,
        validation_id: Uuid,
    },
    ValidationRemovedSelection {
        sheet_name: String,
        selection: String,
    },

    /// Conditional formatting
    ConditionalFormatSet {
        selection: String,
    },
    ConditionalFormatRemoved {
        sheet_name: String,
        conditional_format_id: Uuid,
    },

    /// Column/row structure changes
    ColumnInserted {
        sheet_name: String,
        column: i64,
    },
    ColumnDeleted {
        sheet_name: String,
        column: i64,
    },
    RowInserted {
        sheet_name: String,
        row: i64,
    },
    RowDeleted {
        sheet_name: String,
        row: i64,
    },
    ColumnsDeleted {
        sheet_name: String,
        columns: Vec<i64>,
    },
    RowsDeleted {
        sheet_name: String,
        rows: Vec<i64>,
    },
    ColumnsMoved {
        sheet_name: String,
        from_range: (i64, i64),
        to: i64,
    },
    RowsMoved {
        sheet_name: String,
        from_range: (i64, i64),
        to: i64,
    },

    ComputeCode {
        selection: String,
    },

    SetMergeCells {
        sheet_name: String,
    },
}
