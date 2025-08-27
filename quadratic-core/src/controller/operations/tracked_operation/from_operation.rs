use crate::{
    SheetPos, SheetRect,
    a1::A1Selection,
    controller::{
        GridController,
        operations::{operation::Operation, tracked_operation::TrackedOperation},
    },
    grid::{DataTable, file::sheet_schema::SheetSchema},
};

fn sheet_pos_to_selection(sheet_pos: SheetPos, gc: &GridController) -> String {
    A1Selection::from_pos(sheet_pos.into(), sheet_pos.sheet_id).to_string(None, gc.a1_context())
}

fn sheet_rect_to_selection(sheet_rect: SheetRect, gc: &GridController) -> String {
    A1Selection::from_rect(sheet_rect).to_string(None, gc.a1_context())
}

fn data_table_to_selection(
    data_table: Option<&DataTable>,
    sheet_pos: SheetPos,
    gc: &GridController,
) -> String {
    if let Some(data_table) = data_table {
        let output_rect = data_table.output_rect(sheet_pos.into(), false);
        sheet_rect_to_selection(output_rect.to_sheet_rect(sheet_pos.sheet_id), gc)
    } else {
        sheet_pos_to_selection(sheet_pos, gc)
    }
}

fn get_table_name(data_table: Option<&DataTable>) -> Option<String> {
    data_table.as_ref().map(|dt| dt.name.to_string())
}

impl TrackedOperation {
    pub fn from_operation(operation: &Operation, gc: &GridController) -> Option<Self> {
        match operation {
            Operation::SetCellValues { sheet_pos, values } => Some(Self::SetCellValues {
                selection: sheet_rect_to_selection(
                    SheetRect::new(
                        sheet_pos.x,
                        sheet_pos.y,
                        sheet_pos.x - 1 + values.w as i64,
                        sheet_pos.y - 1 + values.h as i64,
                        sheet_pos.sheet_id,
                    ),
                    gc,
                ),
            }),

            // Data table operations
            Operation::SetDataTable {
                sheet_pos,
                data_table,
                ..
            } => Some(Self::SetDataTable {
                selection: data_table_to_selection(data_table.as_ref(), *sheet_pos, gc),
                name: get_table_name(data_table.as_ref()),
                deleted: data_table.is_none(),
            }),
            Operation::AddDataTable {
                sheet_pos,
                data_table,
                ..
            } => Some(Self::SetDataTable {
                selection: data_table_to_selection(Some(data_table), *sheet_pos, gc),
                name: get_table_name(Some(data_table)),
                deleted: false,
            }),
            Operation::DeleteDataTable { sheet_pos } => Some(Self::DeleteDataTable {
                selection: sheet_pos_to_selection(*sheet_pos, gc),
            }),
            Operation::FlattenDataTable { sheet_pos } => Some(Self::FlattenDataTable {
                selection: sheet_pos_to_selection(*sheet_pos, gc),
            }),
            Operation::GridToDataTable { sheet_rect } => Some(Self::GridToDataTable {
                selection: sheet_rect_to_selection(*sheet_rect, gc),
            }),

            // Simplified data table structure changes
            Operation::InsertDataTableColumns { sheet_pos, .. } => {
                Some(Self::DataTableColumnsChanged {
                    selection: sheet_pos_to_selection(*sheet_pos, gc),
                })
            }
            Operation::DeleteDataTableColumns { sheet_pos, .. } => {
                Some(Self::DataTableColumnsChanged {
                    selection: sheet_pos_to_selection(*sheet_pos, gc),
                })
            }
            Operation::InsertDataTableRows { sheet_pos, .. } => Some(Self::DataTableRowsChanged {
                selection: sheet_pos_to_selection(*sheet_pos, gc),
            }),
            Operation::DeleteDataTableRows { sheet_pos, .. } => Some(Self::DataTableRowsChanged {
                selection: sheet_pos_to_selection(*sheet_pos, gc),
            }),
            Operation::SortDataTable { sheet_pos, .. } => Some(Self::DataTableSorted {
                selection: sheet_pos_to_selection(*sheet_pos, gc),
            }),
            Operation::DataTableFirstRowAsHeader {
                sheet_pos,
                first_row_is_header,
            } => Some(Self::DataTableHeaderToggled {
                selection: sheet_pos_to_selection(*sheet_pos, gc),
                first_row_is_header: *first_row_is_header,
            }),

            // Formatting operations (simplified)
            Operation::SetCellFormatsA1 {
                sheet_id, formats, ..
            } => {
                if let Some(rect) = formats.to_bounding_rect() {
                    let selection = A1Selection::from_rect(rect.to_sheet_rect(*sheet_id));
                    Some(Self::FormatsChanged {
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
                //
                //     selection: selection.clone(),
                // });
            }

            Operation::AddSheet { sheet } => Some(Self::AddSheet {
                sheet_id: sheet.id.to_string(),
            }),

            // Sheet operations
            Operation::AddSheetSchema { schema } => Some(Self::AddSheet {
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
                sheet_id: sheet_id.to_string(),
                new_sheet_id: new_sheet_id.to_string(),
            }),
            Operation::DeleteSheet { sheet_id } => Some(Self::DeleteSheet {
                sheet_id: sheet_id.to_string(),
            }),
            Operation::SetSheetName { sheet_id, name } => Some(Self::SetSheetName {
                sheet_id: sheet_id.to_string(),
                name: name.clone(),
            }),
            Operation::SetSheetColor { sheet_id, color } => Some(Self::SetSheetColor {
                sheet_id: sheet_id.to_string(),
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
                sheet_id: sheet_id.to_string(),
                row: *row,
                new_size: *new_size,
            }),
            Operation::ResizeColumns {
                sheet_id,
                column_widths,
            } => Some(Self::ColumnsResized {
                sheet_id: sheet_id.to_string(),
                count: column_widths.len(),
            }),
            Operation::ResizeRows {
                sheet_id,
                row_heights,
            } => Some(Self::RowsResized {
                sheet_id: sheet_id.to_string(),
                count: row_heights.len(),
            }),
            Operation::DefaultRowSize { sheet_id, size } => Some(Self::DefaultRowSize {
                sheet_id: sheet_id.to_string(),
                size: *size,
            }),
            Operation::DefaultColumnSize { sheet_id, size } => Some(Self::DefaultColumnSize {
                sheet_id: sheet_id.to_string(),
                size: *size,
            }),

            // Cursor/selection changes
            Operation::SetCursorA1 { selection } => Some(Self::CursorChanged {
                selection: selection.to_string(Some(selection.sheet_id), gc.a1_context()),
            }),

            // Cell/range operations
            Operation::MoveCells {
                source: from,
                dest,
                columns,
                rows,
            } => Some(Self::MoveCells {
                from: *from,
                to: *dest,
                columns: *columns,
                rows: *rows,
            }),

            // Data validation (simplified)
            Operation::SetValidation { validation } => Some(Self::ValidationSet {
                validation: validation.clone(),
            }),
            Operation::CreateOrUpdateValidation { validation } => Some(Self::ValidationSet {
                validation: validation.clone(),
            }),
            Operation::RemoveValidation {
                sheet_id,
                validation_id,
            } => Some(Self::ValidationRemoved {
                sheet_id: sheet_id.to_string(),
                validation_id: *validation_id,
            }),
            Operation::RemoveValidationSelection {
                sheet_id,
                selection,
            } => Some(Self::ValidationRemovedSelection {
                sheet_id: sheet_id.to_string(),
                selection: selection.to_string(Some(*sheet_id), gc.a1_context()),
            }),

            // Column/row structure changes
            Operation::InsertColumn {
                sheet_id, column, ..
            } => Some(Self::ColumnInserted {
                sheet_id: sheet_id.to_string(),
                column: *column,
            }),
            Operation::DeleteColumn {
                sheet_id, column, ..
            } => Some(Self::ColumnDeleted {
                sheet_id: sheet_id.to_string(),
                column: *column,
            }),
            Operation::InsertRow { sheet_id, row, .. } => Some(Self::RowInserted {
                sheet_id: sheet_id.to_string(),
                row: *row,
            }),
            Operation::DeleteRow { sheet_id, row, .. } => Some(Self::RowDeleted {
                sheet_id: sheet_id.to_string(),
                row: *row,
            }),
            Operation::DeleteColumns {
                sheet_id, columns, ..
            } => Some(Self::ColumnsDeleted {
                sheet_id: sheet_id.to_string(),
                columns: columns.clone(),
            }),
            Operation::DeleteRows { sheet_id, rows, .. } => Some(Self::RowsDeleted {
                sheet_id: sheet_id.to_string(),
                rows: rows.clone(),
            }),
            Operation::MoveColumns {
                sheet_id,
                col_start,
                col_end,
                to,
            } => Some(Self::ColumnsMoved {
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
                sheet_id: sheet_id.to_string(),
                from_range: (*row_start, *row_end),
                to: *to,
            }),

            Operation::ComputeCode { sheet_pos, .. } => Some(Self::ComputeCode {
                selection: sheet_pos_to_selection(*sheet_pos, gc),
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
