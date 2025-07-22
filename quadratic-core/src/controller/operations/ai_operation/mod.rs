//! This turns operations into AI operations that can be sent to the client and
//! shared with the AI.
//!
//! This can be used to keep an active chat up to date with changes to the file.
//! It also may be used by the AI to create interesting prompts that the user
//! may execute.

use serde::Serialize;
use ts_rs::TS;
use uuid::Uuid;

use crate::{SheetPos, SheetRect, controller::execution::TransactionSource, grid::SheetId};

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
        sheet_rect: SheetRect,
    },

    /// Table structure changes (AI only needs to know the operation type and position)
    DataTableColumnsChanged {
        sheet_pos: SheetPos,
        operation_type: String, // "insert" or "delete"
        count: u32,
    },
    DataTableRowsChanged {
        sheet_pos: SheetPos,
        operation_type: String, // "insert" or "delete"
        count: u32,
    },
    DataTableSorted {
        sheet_pos: SheetPos,
    },
    DataTableHeaderToggled {
        sheet_pos: SheetPos,
        first_row_is_header: bool,
    },

    /// Code execution
    ComputeCode {
        sheet_pos: SheetPos,
    },

    /// Formatting operations (simplified - just position info)
    FormatsChanged {
        selection: String,
        format_type: String, // "cell_formats" or "borders"
    },

    /// Sheet operations
    AddSheet {
        sheet_id: String,
    },
    DeleteSheet {
        sheet_id: SheetId,
    },
    DuplicateSheet {
        sheet_id: SheetId,
        new_sheet_id: SheetId,
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

    /// Grid structure changes
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
    ColumnsResized {
        sheet_id: SheetId,
        count: usize,
    },
    RowsResized {
        sheet_id: SheetId,
        count: usize,
    },
    DefaultRowSize {
        sheet_id: SheetId,
        size: f64,
    },
    DefaultColumnSize {
        sheet_id: SheetId,
        size: f64,
    },

    /// Selection/cursor changes
    CursorChanged {
        selection: String,
    },

    /// Cell/range operations
    MoveCells {
        source: SheetRect,
        dest: SheetPos,
        move_type: String, // "cells", "columns", or "rows"
    },

    /// Data validation
    ValidationSet {
        sheet_pos: SheetPos,
    },
    ValidationRemoved {
        sheet_id: SheetId,
        validation_id: Uuid,
    },

    /// Column/row structure changes
    ColumnInserted {
        sheet_id: SheetId,
        column: i64,
    },
    ColumnDeleted {
        sheet_id: SheetId,
        column: i64,
    },
    RowInserted {
        sheet_id: SheetId,
        row: i64,
    },
    RowDeleted {
        sheet_id: SheetId,
        row: i64,
    },
    ColumnsDeleted {
        sheet_id: SheetId,
        columns: Vec<i64>,
    },
    RowsDeleted {
        sheet_id: SheetId,
        rows: Vec<i64>,
    },
    ColumnsMoved {
        sheet_id: SheetId,
        from_range: (i64, i64),
        to: i64,
    },
    RowsMoved {
        sheet_id: SheetId,
        from_range: (i64, i64),
        to: i64,
    },
}
