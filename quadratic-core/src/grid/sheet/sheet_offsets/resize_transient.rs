use wasm_bindgen::prelude::wasm_bindgen;

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
                });
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
                });
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

    /// Resizes a column and returns the old width.
    pub(super) fn resize_column_internal(&mut self, column: i64, size: f64) -> f64 {
        self.set_column_width(column, size)
    }
    /// Resizes a row and returns the old height.
    pub(super) fn resize_row_internal(&mut self, row: i64, size: f64) -> f64 {
        self.set_row_height(row, size)
    }

    /// Removes and returns the transient_resize.
    pub fn pop_local_transient_resize(&mut self) -> Option<TransientResize> {
        if let Some(transient_resize) = self.transient_resize {
            self.transient_resize = None;
            Some(transient_resize)
        } else {
            None
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq)]
#[wasm_bindgen]
pub struct TransientResize {
    pub row: Option<i64>,
    pub column: Option<i64>,
    pub old_size: f64,
    pub new_size: f64,
}

impl TransientResize {
    pub fn column(column: i64, old_size: f64, new_size: f64) -> Self {
        TransientResize {
            row: None,
            column: Some(column),
            old_size,
            new_size,
        }
    }

    pub fn row(row: i64, old_size: f64, new_size: f64) -> Self {
        TransientResize {
            row: Some(row),
            column: None,
            old_size,
            new_size,
        }
    }
}
