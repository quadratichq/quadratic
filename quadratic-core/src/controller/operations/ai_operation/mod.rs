//! This turns operations into AI operations that can be sent to the client and
//! shared with the AI.
//!
//! This can be used to keep an active chat up to date with changes to the file.
//! It also may be used by the AI to create interesting prompts that the user
//! may execute.

use serde::Serialize;
use ts_rs::TS;
use uuid::Uuid;

use crate::{
    SheetPos, SheetRect,
    grid::{SheetId, sheet::validations::validation::Validation},
};

mod from_operation;

#[derive(Serialize, Debug, PartialEq, TS)]
#[serde(tag = "type")]
pub enum AIOperation {
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
        sheet_id: String,
        selection: String,
    },

    /// Sheet operations
    AddSheet {
        sheet_id: String,
    },
    DeleteSheet {
        sheet_id: String,
    },
    DuplicateSheet {
        sheet_id: String,
        new_sheet_id: String,
    },
    SetSheetName {
        sheet_id: String,
        name: String,
    },
    SetSheetColor {
        sheet_id: String,
        color: Option<String>,
    },
    ReorderSheet {
        target: SheetId,
        order: String,
    },

    /// Grid structure changes
    ResizeColumn {
        sheet_id: String,
        column: i64,
        new_size: f64,
    },
    ResizeRow {
        sheet_id: String,
        row: i64,
        new_size: f64,
    },
    ColumnsResized {
        sheet_id: String,
        count: usize,
    },
    RowsResized {
        sheet_id: String,
        count: usize,
    },
    DefaultRowSize {
        sheet_id: String,
        size: f64,
    },
    DefaultColumnSize {
        sheet_id: String,
        size: f64,
    },

    /// Selection/cursor changes
    CursorChanged {
        selection: String,
    },

    /// Cell/range operations
    MoveCells {
        from: SheetRect,
        to: SheetPos,
        columns: bool,
        rows: bool,
    },

    /// Data validation
    ValidationSet {
        validation: Validation,
    },
    ValidationRemoved {
        sheet_id: String,
        validation_id: Uuid,
    },
    ValidationRemovedSelection {
        sheet_id: String,
        selection: String,
    },

    /// Column/row structure changes
    ColumnInserted {
        sheet_id: String,
        column: i64,
    },
    ColumnDeleted {
        sheet_id: String,
        column: i64,
    },
    RowInserted {
        sheet_id: String,
        row: i64,
    },
    RowDeleted {
        sheet_id: String,
        row: i64,
    },
    ColumnsDeleted {
        sheet_id: String,
        columns: Vec<i64>,
    },
    RowsDeleted {
        sheet_id: String,
        rows: Vec<i64>,
    },
    ColumnsMoved {
        sheet_id: String,
        from_range: (i64, i64),
        to: i64,
    },
    RowsMoved {
        sheet_id: String,
        from_range: (i64, i64),
        to: i64,
    },

    ComputeCode {
        selection: String,
    },
}
