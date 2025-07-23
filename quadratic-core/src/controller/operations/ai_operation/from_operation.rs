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
                source,
                sheet_rect: *sheet_rect,
            }),

            // Simplified data table structure changes
            Operation::InsertDataTableColumns { sheet_pos, .. } => {
                Some(Self::DataTableColumnsChanged {
                    source,
                    sheet_pos: *sheet_pos,
                })
            }
            Operation::DeleteDataTableColumns { sheet_pos, .. } => {
                Some(Self::DataTableColumnsChanged {
                    source,
                    sheet_pos: *sheet_pos,
                })
            }
            Operation::InsertDataTableRows { sheet_pos, .. } => Some(Self::DataTableRowsChanged {
                source,
                sheet_pos: *sheet_pos,
            }),
            Operation::DeleteDataTableRows { sheet_pos, .. } => Some(Self::DataTableRowsChanged {
                source,
                sheet_pos: *sheet_pos,
            }),
            Operation::SortDataTable { sheet_pos, .. } => Some(Self::DataTableSorted {
                source,
                sheet_pos: *sheet_pos,
            }),
            Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header,
            } => Some(Self::DataTableHeaderToggled {
                source,
                sheet_pos: *sheet_pos,
                first_row_is_header: *first_row_is_header,
            }),

            // Code execution
            Operation::ComputeCode { sheet_pos } => Some(Self::ComputeCode {
                source,
                sheet_pos: *sheet_pos,
            }),

            // Formatting operations (simplified)
            Operation::SetCellFormatsA1 {
                sheet_id, formats, ..
            } => {
                if let Some(rect) = formats.to_bounding_rect() {
                    let selection = A1Selection::from_rect(rect.to_sheet_rect(*sheet_id));
                    Some(Self::FormatsChanged {
                        source,
                        sheet_id: sheet_id.to_string(),
                        selection: selection.to_string(Some(*sheet_id), gc.a1_context()),
                    })
                } else {
                    None
                }
            }
            Operation::SetBordersA1 { .. } => {
                None
                // return Some(Self::FormatsChanged {
                //     source,
                //     selection: selection.clone(),
                // });
            }

            Operation::AddSheet { sheet } => Some(Self::AddSheet {
                source,
                sheet_id: (*sheet).id.to_string(),
            }),

            // Sheet operations
            Operation::AddSheetSchema { schema } => Some(Self::AddSheet {
                source,
                sheet_id: match schema.as_ref() {
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
                source,
                sheet_id: sheet_id.to_string(),
                new_sheet_id: new_sheet_id.to_string(),
            }),
            Operation::DeleteSheet { sheet_id } => Some(Self::DeleteSheet {
                source,
                sheet_id: sheet_id.to_string(),
            }),
            Operation::SetSheetName { sheet_id, name } => Some(Self::SetSheetName {
                source,
                sheet_id: sheet_id.to_string(),
                name: name.clone(),
            }),
            Operation::SetSheetColor { sheet_id, color } => Some(Self::SetSheetColor {
                source,
                sheet_id: sheet_id.to_string(),
                color: color.clone(),
            }),
            Operation::ReorderSheet { target, order } => Some(Self::ReorderSheet {
                source,
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
                source,
                sheet_id: sheet_id.to_string(),
                column: *column,
                new_size: *new_size,
            }),
            Operation::ResizeRow {
                sheet_id,
                row,
                new_size,
                ..
            } => Some(Self::ResizeRow {
                source,
                sheet_id: sheet_id.to_string(),
                row: *row,
                new_size: *new_size,
            }),
            Operation::ResizeColumns {
                sheet_id,
                column_widths,
            } => Some(Self::ColumnsResized {
                source,
                sheet_id: sheet_id.to_string(),
                count: column_widths.len(),
            }),
            Operation::ResizeRows {
                sheet_id,
                row_heights,
            } => Some(Self::RowsResized {
                source,
                sheet_id: sheet_id.to_string(),
                count: row_heights.len(),
            }),
            Operation::DefaultRowSize { sheet_id, size } => Some(Self::DefaultRowSize {
                source,
                sheet_id: sheet_id.to_string(),
                size: *size,
            }),
            Operation::DefaultColumnSize { sheet_id, size } => Some(Self::DefaultColumnSize {
                source,
                sheet_id: sheet_id.to_string(),
                size: *size,
            }),

            // Cursor/selection changes
            Operation::SetCursorA1 { selection } => Some(Self::CursorChanged {
                source,
                selection: selection.to_string(Some(selection.sheet_id), gc.a1_context()),
            }),

            // Cell/range operations
            Operation::MoveCells {
                source: from,
                dest,
                columns,
                rows,
            } => Some(Self::MoveCells {
                source,
                from: *from,
                to: *dest,
                columns: *columns,
                rows: *rows,
            }),

            // Data validation (simplified)
            Operation::SetValidation { validation } => Some(Self::ValidationSet {
                source,
                validation: validation.clone(),
            }),
            Operation::RemoveValidation {
                sheet_id,
                validation_id,
            } => Some(Self::ValidationRemoved {
                source,
                sheet_id: sheet_id.to_string(),
                validation_id: *validation_id,
            }),

            // Column/row structure changes
            Operation::InsertColumn {
                sheet_id, column, ..
            } => Some(Self::ColumnInserted {
                source,
                sheet_id: sheet_id.to_string(),
                column: *column,
            }),
            Operation::DeleteColumn {
                sheet_id, column, ..
            } => Some(Self::ColumnDeleted {
                source,
                sheet_id: sheet_id.to_string(),
                column: *column,
            }),
            Operation::InsertRow { sheet_id, row, .. } => Some(Self::RowInserted {
                source,
                sheet_id: sheet_id.to_string(),
                row: *row,
            }),
            Operation::DeleteRow { sheet_id, row, .. } => Some(Self::RowDeleted {
                source,
                sheet_id: sheet_id.to_string(),
                row: *row,
            }),
            Operation::DeleteColumns {
                sheet_id, columns, ..
            } => Some(Self::ColumnsDeleted {
                source,
                sheet_id: sheet_id.to_string(),
                columns: columns.clone(),
            }),
            Operation::DeleteRows { sheet_id, rows, .. } => Some(Self::RowsDeleted {
                source,
                sheet_id: sheet_id.to_string(),
                rows: rows.clone(),
            }),
            Operation::MoveColumns {
                sheet_id,
                col_start,
                col_end,
                to,
            } => Some(Self::ColumnsMoved {
                source,
                sheet_id: sheet_id.to_string(),
                from_range: (*col_start, *col_end),
                to: *to,
            }),
            Operation::MoveRows {
                sheet_id,
                row_start,
                row_end,
                to,
            } => Some(Self::RowsMoved {
                source,
                sheet_id: sheet_id.to_string(),
                from_range: (*row_start, *row_end),
                to: *to,
            }),

            // Deprecated operations that we don't need to support
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
            | Operation::SetValidationWarning { .. } => None,
        }
    }
}
