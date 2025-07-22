use crate::{
    SheetRect,
    a1::A1Selection,
    controller::{
        GridController,
        execution::TransactionSource,
        operations::{ai_operation::AIOperation, operation::Operation},
    },
    grid::file::sheet_schema::SheetSchema,
};

impl AIOperation {
    pub fn from_operation(
        source: TransactionSource,
        operation: &Operation,
        gc: &GridController,
    ) -> Option<Self> {
        match operation {
            Operation::SetCellValues { sheet_pos, values } => Some(Self::SetCellValues {
                source,
                selection: A1Selection::from_rect(SheetRect::new(
                    sheet_pos.x,
                    sheet_pos.y,
                    sheet_pos.x + values.w as i64,
                    sheet_pos.y + values.h as i64,
                    sheet_pos.sheet_id,
                ))
                .to_string(Some(sheet_pos.sheet_id), gc.a1_context()),
            }),

            // Data table operations
            Operation::SetDataTable {
                sheet_pos,
                data_table,
                ..
            } => Some(Self::SetDataTable {
                source,
                sheet_pos: *sheet_pos,
                deleted: data_table.is_none(),
            }),
            Operation::AddDataTable { sheet_pos, .. } => Some(Self::SetDataTable {
                source,
                sheet_pos: *sheet_pos,
                deleted: false,
            }),
            Operation::DeleteDataTable { sheet_pos } => Some(Self::DeleteDataTable {
                source,
                sheet_pos: *sheet_pos,
            }),
            Operation::FlattenDataTable { sheet_pos } => Some(Self::FlattenDataTable {
                source,
                sheet_pos: *sheet_pos,
            }),
            Operation::GridToDataTable { sheet_rect } => Some(Self::GridToDataTable {
                sheet_rect: *sheet_rect,
            }),

            // Simplified data table structure changes
            Operation::InsertDataTableColumns {
                sheet_pos, columns, ..
            } => Some(Self::DataTableColumnsChanged {
                sheet_pos: *sheet_pos,
                operation_type: "insert".to_string(),
                count: columns.len() as u32,
            }),
            Operation::DeleteDataTableColumns {
                sheet_pos, columns, ..
            } => Some(Self::DataTableColumnsChanged {
                sheet_pos: *sheet_pos,
                operation_type: "delete".to_string(),
                count: columns.len() as u32,
            }),
            Operation::InsertDataTableRows {
                sheet_pos, rows, ..
            } => Some(Self::DataTableRowsChanged {
                sheet_pos: *sheet_pos,
                operation_type: "insert".to_string(),
                count: rows.len() as u32,
            }),
            Operation::DeleteDataTableRows {
                sheet_pos, rows, ..
            } => Some(Self::DataTableRowsChanged {
                sheet_pos: *sheet_pos,
                operation_type: "delete".to_string(),
                count: rows.len() as u32,
            }),
            Operation::SortDataTable { sheet_pos, .. } => Some(Self::DataTableSorted {
                sheet_pos: *sheet_pos,
            }),
            Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header,
            } => Some(Self::DataTableHeaderToggled {
                sheet_pos: *sheet_pos,
                first_row_is_header: *first_row_is_header,
            }),

            // Code execution
            Operation::ComputeCode { sheet_pos } => Some(Self::ComputeCode {
                sheet_pos: *sheet_pos,
            }),

            // Formatting operations (simplified)
            Operation::SetCellFormatsA1 { selection, .. } => Some(Self::FormatsChanged {
                selection: selection.clone(),
                format_type: "cell_formats".to_string(),
            }),
            Operation::SetBordersA1 { selection, .. } => Some(Self::FormatsChanged {
                selection: selection.clone(),
                format_type: "borders".to_string(),
            }),

            // Sheet operations
            Operation::AddSheetSchema { schema } => Some(Self::AddSheet {
                sheet_id: match schema {
                    SheetSchema::V1_11(schema) => schema.id.to_string(),
                    SheetSchema::V1_10(schema) => schema.id.to_string(),
                    SheetSchema::V1_9(schema) => schema.id.to_string(),
                    SheetSchema::V1_8(schema) => schema.id.to_string(),
                    SheetSchema::V1_7_1(schema) => schema.id.to_string(),
                    SheetSchema::V1_7(schema) => schema.id.to_string(),
                    SheetSchema::V1_6(schema) => schema.id.to_string(),
                },
            }),
            Operation::DuplicateSheet {
                sheet_id,
                new_sheet_id,
            } => Some(Self::DuplicateSheet {
                sheet_id: *sheet_id,
                new_sheet_id: *new_sheet_id,
            }),
            Operation::DeleteSheet { sheet_id } => Some(Self::DeleteSheet {
                sheet_id: *sheet_id,
            }),
            Operation::SetSheetName { sheet_id, name } => Some(Self::SetSheetName {
                sheet_id: *sheet_id,
                name: name.clone(),
            }),
            Operation::SetSheetColor { sheet_id, color } => Some(Self::SetSheetColor {
                sheet_id: *sheet_id,
                color: color.clone(),
            }),
            Operation::ReorderSheet { target, order } => Some(Self::ReorderSheet {
                target: *target,
                order: order.clone(),
            }),

            // Grid structure changes
            Operation::ResizeColumn {
                sheet_id,
                column,
                new_size,
                ..
            } => Some(Self::ResizeColumn {
                sheet_id: *sheet_id,
                column: *column,
                new_size: *new_size,
            }),
            Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
                ..
            } => Some(Self::ResizeRow {
                sheet_id: *sheet_id,
                row: *row,
                new_size: *new_size,
            }),
            Operation::ResizeColumns {
                sheet_id,
                column_widths,
            } => Some(Self::ColumnsResized {
                sheet_id: *sheet_id,
                count: column_widths.len(),
            }),
            Operation::ResizeRows {
                sheet_id,
                row_heights,
            } => Some(Self::RowsResized {
                sheet_id: *sheet_id,
                count: row_heights.len(),
            }),
            Operation::DefaultRowSize { sheet_id, size } => Some(Self::DefaultRowSize {
                sheet_id: *sheet_id,
                size: *size,
            }),
            Operation::DefaultColumnSize { sheet_id, size } => Some(Self::DefaultColumnSize {
                sheet_id: *sheet_id,
                size: *size,
            }),

            // Cursor/selection changes
            Operation::SetCursorA1 { selection } => Some(Self::CursorChanged {
                selection: selection.to_string(),
            }),

            // Cell/range operations
            Operation::MoveCells {
                source,
                dest,
                columns,
                rows,
            } => {
                let move_type = if *columns {
                    "columns"
                } else if *rows {
                    "rows"
                } else {
                    "cells"
                };
                Some(Self::MoveCells {
                    source: *source,
                    dest: *dest,
                    move_type: move_type.to_string(),
                })
            }

            // Data validation (simplified)
            Operation::SetValidation { validation } => Some(Self::ValidationSet {
                sheet_pos: validation.selection.sheet_pos,
            }),
            Operation::RemoveValidation {
                sheet_id,
                validation_id,
            } => Some(Self::ValidationRemoved {
                sheet_id: *sheet_id,
                validation_id: *validation_id,
            }),

            // Column/row structure changes
            Operation::InsertColumn {
                sheet_id, column, ..
            } => Some(Self::ColumnInserted {
                sheet_id: *sheet_id,
                column: *column,
            }),
            Operation::DeleteColumn {
                sheet_id, column, ..
            } => Some(Self::ColumnDeleted {
                sheet_id: *sheet_id,
                column: *column,
            }),
            Operation::InsertRow { sheet_id, row, .. } => Some(Self::RowInserted {
                sheet_id: *sheet_id,
                row: *row,
            }),
            Operation::DeleteRow { sheet_id, row, .. } => Some(Self::RowDeleted {
                sheet_id: *sheet_id,
                row: *row,
            }),
            Operation::DeleteColumns {
                sheet_id, columns, ..
            } => Some(Self::ColumnsDeleted {
                sheet_id: *sheet_id,
                columns: columns.clone(),
            }),
            Operation::DeleteRows { sheet_id, rows, .. } => Some(Self::RowsDeleted {
                sheet_id: *sheet_id,
                rows: rows.clone(),
            }),
            Operation::MoveColumns {
                sheet_id,
                col_start,
                col_end,
                to,
            } => Some(Self::ColumnsMoved {
                sheet_id: *sheet_id,
                from_range: (*col_start, *col_end),
                to: *to,
            }),
            Operation::MoveRows {
                sheet_id,
                row_start,
                row_end,
                to,
            } => Some(Self::RowsMoved {
                sheet_id: *sheet_id,
                from_range: (*row_start, *row_end),
                to: *to,
            }),

            // Operations that are not useful for AI or are deprecated
            Operation::SetChartSize { .. }
            | Operation::SetChartCellSize { .. }
            | Operation::SetDataTableAt { .. }
            | Operation::SwitchDataTableKind { .. }
            | Operation::DataTableMeta { .. }
            | Operation::DataTableOptionMeta { .. }
            | Operation::DataTableFormats { .. }
            | Operation::DataTableBorders { .. }
            | Operation::SetCellFormats { .. }
            | Operation::SetCellFormatsSelection { .. }
            | Operation::SetBorders { .. }
            | Operation::SetBordersSelection { .. }
            | Operation::SetCursor { .. }
            | Operation::SetCursorSelection { .. }
            | Operation::SetValidationWarning { .. }
            | Operation::AddSheet { .. } => None,
        }
    }
}
