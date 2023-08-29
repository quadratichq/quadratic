use crate::grid::SheetId;

use super::{transactions::*, GridController};

impl GridController {
    pub fn resize_column_transiently(&mut self, sheet_id: SheetId, column: i64, size: Option<f64>) {
        let old_size = self.resize_column_internal(sheet_id, column, size);
        match &mut self.transient_column_resize {
            Some(resize) => {
                resize.new_size = size;
                self.resize_column_internal(sheet_id, column, size);
            }
            None => {
                self.transient_column_resize = Some(TransientResize {
                    sheet: sheet_id,
                    coordinate: column,
                    old_size,
                    new_size: size,
                })
            }
        }
    }
    pub fn resize_row_transiently(&mut self, sheet_id: SheetId, row: i64, size: Option<f64>) {
        let old_size = self.resize_row_internal(sheet_id, row, size);
        match &mut self.transient_row_resize {
            Some(resize) => {
                resize.new_size = size;
                self.resize_row_internal(sheet_id, row, size);
            }
            None => {
                self.transient_row_resize = Some(TransientResize {
                    sheet: sheet_id,
                    coordinate: row,
                    old_size,
                    new_size: size,
                })
            }
        }
    }

    pub fn cancel_resize(&mut self) {
        if let Some(resize) = self.transient_column_resize {
            self.resize_column_transiently(resize.sheet, resize.coordinate, resize.old_size);
            self.transient_column_resize = None;
        }
        if let Some(resize) = self.transient_row_resize {
            self.resize_row_transiently(resize.sheet, resize.coordinate, resize.old_size);
            self.transient_row_resize = None;
        }
    }

    pub fn commit_resize(&mut self, cursor: Option<String>) -> TransactionSummary {
        let mut ops = vec![];

        if let Some(resize) = self.transient_column_resize.take() {
            ops.push(Operation::ResizeColumn {
                sheet_id: resize.sheet,
                column: resize.coordinate,
                new_size: resize.new_size,
            });
        }

        if let Some(resize) = self.transient_row_resize.take() {
            ops.push(Operation::ResizeRow {
                sheet_id: resize.sheet,
                row: resize.coordinate,
                new_size: resize.new_size,
            });
        }

        // Set row & column back to original size so that `transact_forward()`
        // knows what the old value was. This old value will never be visible to
        // calling code because we immediately call `transact_forward()`.
        self.cancel_resize();

        self.transact_forward(Transaction { ops, cursor })
    }

    /// Resizes a column and returns the old size. `None` indicates the default
    /// width.
    pub(super) fn resize_column_internal(
        &mut self,
        sheet_id: SheetId,
        column: i64,
        size: Option<f64>,
    ) -> Option<f64> {
        todo!()
    }
    /// Resizes a row and returns the old size. `None` indicates the default
    /// height.
    pub(super) fn resize_row_internal(
        &mut self,
        sheet_id: SheetId,
        column: i64,
        size: Option<f64>,
    ) -> Option<f64> {
        todo!()
    }
}

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct TransientResize {
    sheet: SheetId,
    coordinate: i64,
    old_size: Option<f64>,
    new_size: Option<f64>,
}
