use crate::grid::{ColumnId, RowId, SheetId};

use super::{operations::Operation, transactions::*, GridController};

impl GridController {
    pub fn resize_column_transiently(&mut self, sheet_id: SheetId, column: i64, size: Option<f64>) {
        let size = size.unwrap_or(crate::DEFAULT_COLUMN_WIDTH);
        let old_size = self.resize_column_internal(sheet_id, column, size);
        match &mut self.transient_resize {
            Some(resize) => {
                resize.new_size = size;
                self.resize_column_internal(sheet_id, column, size);
            }
            None => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                self.transient_resize = Some(TransientResize {
                    sheet: sheet_id,
                    column: Some(sheet.get_or_create_column(column).0.id),
                    row: None,
                    old_size,
                    new_size: size,
                })
            }
        }
    }
    pub fn resize_row_transiently(&mut self, sheet_id: SheetId, row: i64, size: Option<f64>) {
        let size = size.unwrap_or(crate::DEFAULT_ROW_HEIGHT);
        let old_size = self.resize_row_internal(sheet_id, row, size);
        match &mut self.transient_resize {
            Some(resize) => {
                resize.new_size = size;
                self.resize_row_internal(sheet_id, row, size);
            }
            None => {
                let sheet = self.grid.sheet_mut_from_id(sheet_id);
                self.transient_resize = Some(TransientResize {
                    sheet: sheet_id,
                    column: None,
                    row: Some(sheet.get_or_create_row(row).id),
                    old_size,
                    new_size: size,
                })
            }
        }
    }

    pub fn cancel_resize(&mut self) {
        if let Some(resize) = self.transient_resize {
            let sheet = self.sheet(resize.sheet);
            if let Some(column) = resize.column.and_then(|id| sheet.get_column_index(id)) {
                self.resize_column_transiently(resize.sheet, column, Some(resize.old_size));
            } else if let Some(row) = resize.row.and_then(|id| sheet.get_row_index(id)) {
                self.resize_row_transiently(resize.sheet, row, Some(resize.old_size));
            }
        }
    }

    pub fn commit_resize(&mut self, cursor: Option<String>) -> TransactionSummary {
        let mut ops = vec![];

        if let Some(resize) = self.transient_resize.take() {
            if let Some(column) = resize.column {
                ops.push(Operation::ResizeColumn {
                    sheet_id: resize.sheet,
                    column,
                    new_size: resize.new_size,
                });
            } else if let Some(row) = resize.row {
                ops.push(Operation::ResizeRow {
                    sheet_id: resize.sheet,
                    row,
                    new_size: resize.new_size,
                });
            }
        }

        // Set row & column back to original size so that `transact_forward()`
        // knows what the old value was. This old value will never be visible to
        // calling code because we immediately call `transact_forward()`.
        self.cancel_resize();

        self.transact_forward(ops, cursor)
    }

    /// Resizes a column and returns the old width.
    pub(super) fn resize_column_internal(
        &mut self,
        sheet_id: SheetId,
        column: i64,
        size: f64,
    ) -> f64 {
        self.grid
            .sheet_mut_from_id(sheet_id)
            .set_column_width(column, size)
    }
    /// Resizes a row and returns the old height.
    pub(super) fn resize_row_internal(&mut self, sheet_id: SheetId, row: i64, size: f64) -> f64 {
        self.grid
            .sheet_mut_from_id(sheet_id)
            .set_row_height(row, size)
    }
}

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct TransientResize {
    sheet: SheetId,
    row: Option<RowId>,
    column: Option<ColumnId>,
    old_size: f64,
    new_size: f64,
}
