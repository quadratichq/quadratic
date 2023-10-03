use super::SheetOffsets;

impl SheetOffsets {
    pub fn resize_column_transiently(&mut self, column: i64, size: Option<f64>) {
        let size = size.unwrap_or(crate::DEFAULT_COLUMN_WIDTH);
        let old_size = self.resize_column_internal(column, size);
        match &mut self.transient_resize {
            Some(resize) => {
                resize.new_size = size;
                self.resize_column_internal(column, size);
            }
            None => {
                self.transient_resize = Some(TransientResize {
                    column: Some(column),
                    row: None,
                    old_size,
                    new_size: size,
                })
            }
        }
    }
    pub fn resize_row_transiently(&mut self, row: i64, size: Option<f64>) {
        let size = size.unwrap_or(crate::DEFAULT_ROW_HEIGHT);
        let old_size = self.resize_row_internal(row, size);
        match &mut self.transient_resize {
            Some(resize) => {
                resize.new_size = size;
                self.resize_row_internal(row, size);
            }
            None => {
                self.transient_resize = Some(TransientResize {
                    column: None,
                    row: Some(row),
                    old_size,
                    new_size: size,
                })
            }
        }
    }

    pub fn cancel_resize(&mut self) {
        if let Some(resize) = self.transient_resize {
            if let Some(column) = resize.column {
                self.resize_column_transiently(column, Some(resize.old_size));
            } else if let Some(row) = resize.row {
                self.resize_row_transiently(row, Some(resize.old_size));
            }
        }
    }

    // pub async fn commit_resize(&mut self, cursor: Option<String>) -> TransactionSummary {
    //     let mut ops = vec![];

    //     if let Some(resize) = self.transient_resize.take() {
    //         if let Some(column) = resize.column {
    //             ops.push(Operation::ResizeColumn {
    //                 sheet_id: resize.sheet,
    //                 column,
    //                 new_size: resize.new_size,
    //             });
    //         } else if let Some(row) = resize.row {
    //             ops.push(Operation::ResizeRow {
    //                 sheet_id: resize.sheet,
    //                 row,
    //                 new_size: resize.new_size,
    //             });
    //         }
    //     }

    //     // Set row & column back to original size so that `transact_forward()`
    //     // knows what the old value was. This old value will never be visible to
    //     // calling code because we immediately call `transact_forward()`.
    //     self.cancel_resize();

    //     self.transact_forward(ops, cursor).await
    // }

    /// Resizes a column and returns the old width.
    pub(super) fn resize_column_internal(&mut self, column: i64, size: f64) -> f64 {
        self.set_column_width(column, size)
    }
    /// Resizes a row and returns the old height.
    pub(super) fn resize_row_internal(&mut self, row: i64, size: f64) -> f64 {
        self.set_row_height(row, size)
    }
}

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct TransientResize {
    row: Option<i64>,
    column: Option<i64>,
    old_size: f64,
    new_size: f64,
}
