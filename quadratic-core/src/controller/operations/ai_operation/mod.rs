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
    controller::execution::TransactionSource,
    grid::{SheetId, sheet::validations::validation::Validation},
};

mod from_operation;

#[derive(Serialize, Debug, PartialEq, TS)]
pub enum AIOperation {
    /// Sets cell values in a range
    SetCellValues {
        source: TransactionSource,
        selection: String,
    },

    /// Data table operations - simplified since table info is in context
    SetDataTable {
        source: TransactionSource,
        sheet_pos: SheetPos,
        deleted: bool,
    },
    DeleteDataTable {
        source: TransactionSource,
        sheet_pos: SheetPos,
    },
    FlattenDataTable {
        source: TransactionSource,
        sheet_pos: SheetPos,
    },
    GridToDataTable {
        source: TransactionSource,
        sheet_rect: SheetRect,
    },

    /// Table structure changes (AI only needs to know the operation type and position)
    DataTableColumnsChanged {
        source: TransactionSource,
        sheet_pos: SheetPos,
    },
    DataTableRowsChanged {
        source: TransactionSource,
        sheet_pos: SheetPos,
    },
    DataTableSorted {
        source: TransactionSource,
        sheet_pos: SheetPos,
    },
    DataTableHeaderToggled {
        source: TransactionSource,
        sheet_pos: SheetPos,
        first_row_is_header: bool,
    },

    /// Code execution
    ComputeCode {
        source: TransactionSource,
        sheet_pos: SheetPos,
    },

    /// Formatting operations (simplified - just position info)
    FormatsChanged {
        source: TransactionSource,
        sheet_id: String,
        selection: String,
    },

    /// Sheet operations
    AddSheet {
        source: TransactionSource,
        sheet_id: String,
    },
    DeleteSheet {
        source: TransactionSource,
        sheet_id: String,
    },
    DuplicateSheet {
        source: TransactionSource,
        sheet_id: String,
        new_sheet_id: String,
    },
    SetSheetName {
        source: TransactionSource,
        sheet_id: String,
        name: String,
    },
    SetSheetColor {
        source: TransactionSource,
        sheet_id: String,
        color: Option<String>,
    },
    ReorderSheet {
        source: TransactionSource,
        target: SheetId,
        order: String,
    },

    /// Grid structure changes
    ResizeColumn {
        source: TransactionSource,
        sheet_id: String,
        column: i64,
        new_size: f64,
    },
    ResizeRow {
        source: TransactionSource,
        sheet_id: String,
        row: i64,
        new_size: f64,
    },
    ColumnsResized {
        source: TransactionSource,
        sheet_id: String,
        count: usize,
    },
    RowsResized {
        source: TransactionSource,
        sheet_id: String,
        count: usize,
    },
    DefaultRowSize {
        source: TransactionSource,
        sheet_id: String,
        size: f64,
    },
    DefaultColumnSize {
        source: TransactionSource,
        sheet_id: String,
        size: f64,
    },

    /// Selection/cursor changes
    CursorChanged {
        source: TransactionSource,
        selection: String,
    },

    /// Cell/range operations
    MoveCells {
        source: TransactionSource,
        from: SheetRect,
        to: SheetPos,
        columns: bool,
        rows: bool,
    },

    /// Data validation
    ValidationSet {
        source: TransactionSource,
        validation: Validation,
    },
    ValidationRemoved {
        source: TransactionSource,
        sheet_id: String,
        validation_id: Uuid,
    },

    /// Column/row structure changes
    ColumnInserted {
        source: TransactionSource,
        sheet_id: String,
        column: i64,
    },
    ColumnDeleted {
        source: TransactionSource,
        sheet_id: String,
        column: i64,
    },
    RowInserted {
        source: TransactionSource,
        sheet_id: String,
        row: i64,
    },
    RowDeleted {
        source: TransactionSource,
        sheet_id: String,
        row: i64,
    },
    ColumnsDeleted {
        source: TransactionSource,
        sheet_id: String,
        columns: Vec<i64>,
    },
    RowsDeleted {
        source: TransactionSource,
        sheet_id: String,
        rows: Vec<i64>,
    },
    ColumnsMoved {
        source: TransactionSource,
        sheet_id: String,
        from_range: (i64, i64),
        to: i64,
    },
    RowsMoved {
        source: TransactionSource,
        sheet_id: String,
        from_range: (i64, i64),
        to: i64,
    },
}
