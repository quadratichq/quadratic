use super::SheetOffsets;
use crate::{Rect, ScreenRect};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg_attr(feature = "js", wasm_bindgen, derive(ts_rs::TS))]
pub struct Placement {
    pub index: i32,
    pub position: f64,
    pub size: f32,
}

#[derive(Serialize, Deserialize, ts_rs::TS)]
pub struct ColumnRow {
    pub column: i32,
    pub row: i32,
}

#[wasm_bindgen]
impl SheetOffsets {
    /// Returns a rectangle with the screen coordinates for a cell
    #[wasm_bindgen(js_name = "getCellOffsets")]
    pub fn js_get_cell_offsets(&self, column: i32, row: i32) -> ScreenRect {
        self.cell_offsets(column as i64, row as i64)
    }

    // Returns a rectangle with the screen coordinates for a rectangle of cells
    #[wasm_bindgen(js_name = "getRectCellOffsets")]
    pub fn js_get_rect_cell_offsets(
        &self,
        column: i32,
        row: i32,
        width: i32,
        height: i32,
    ) -> String {
        let rect = Rect::from_numbers(column as i64, row as i64, width as i64, height as i64);
        let screen_rect = self.screen_rect_cell_offsets(rect);
        serde_json::to_string(&screen_rect).unwrap_or("".to_string())
    }

    /// gets the column width. Returns a f32
    #[wasm_bindgen(js_name = "getColumnWidth")]
    pub fn js_column_width(&self, x: i32) -> f32 {
        self.column_width(x as i64) as f32
    }

    /// Sets the column width. Returns the old width.
    #[wasm_bindgen(js_name = "setColumnWidth")]
    pub fn js_set_column_width(&mut self, x: i32, width: f64) -> f64 {
        self.set_column_width(x as i64, width)
    }

    /// Resets the row height. Returns the old height.
    #[wasm_bindgen(js_name = "setRowHeight")]
    pub fn js_set_row_height(&mut self, y: i32, height: f64) -> f64 {
        self.set_row_height(y as i64, height)
    }

    /// gets the row height from a row index
    #[wasm_bindgen(js_name = "getRowHeight")]
    pub fn js_row_height(&self, y: i32) -> f32 {
        self.row_height(y as i64) as f32
    }

    /// Gets the default column width and row height
    #[wasm_bindgen(js_name = "getDefaults")]
    pub fn js_get_defaults(&self) -> String {
        let (width, height) = self.defaults();
        serde_json::json!({
            "columnWidth": width,
            "rowHeight": height
        })
        .to_string()
    }

    /// Gets the minimum and maximum column width bounds
    #[wasm_bindgen(js_name = "getColumnWidthBounds")]
    pub fn js_get_column_width_bounds() -> String {
        let (min, max) = Self::column_width_bounds();
        serde_json::json!({
            "min": min,
            "max": max
        })
        .to_string()
    }

    /// Gets the minimum and maximum row height bounds
    #[wasm_bindgen(js_name = "getRowHeightBounds")]
    pub fn js_get_row_height_bounds() -> String {
        let (min, max) = Self::row_height_bounds();
        serde_json::json!({
            "min": min,
            "max": max
        })
        .to_string()
    }

    /// Gets total width for a range of columns (inclusive)
    #[wasm_bindgen(js_name = "getTotalColumnsWidth")]
    pub fn js_get_total_columns_width(&self, from_column: i32, to_column: i32) -> f64 {
        self.total_columns_width(from_column as i64, to_column as i64)
    }

    /// Gets total height for a range of rows (inclusive)
    #[wasm_bindgen(js_name = "getTotalRowsHeight")]
    pub fn js_get_total_rows_height(&self, from_row: i32, to_row: i32) -> f64 {
        self.total_rows_height(from_row as i64, to_row as i64)
    }

    /// gets the screen coordinate and size for a row. Returns a [`Placement`]
    #[wasm_bindgen(js_name = "getColumnPlacement")]
    pub fn js_column_placement(&self, column: i32) -> Placement {
        let (position, size) = self.column_position_size(column as i64);
        Placement {
            index: column,
            position,
            size: size as f32,
        }
    }
    /// gets the screen coordinate and size for a pixel y-coordinate. Returns a [`Placement`]
    #[wasm_bindgen(js_name = "getRowPlacement")]
    pub fn js_row_placement(&self, row: i32) -> Placement {
        let (position, size) = self.row_position_size(row as i64);
        Placement {
            index: row,
            position,
            size: size as f32,
        }
    }

    /// gets the screen coordinate and size for a pixel x-coordinate. Returns a [`Placement`]
    #[wasm_bindgen(js_name = "getXPlacement")]
    pub fn js_x_placement(&mut self, x: f64) -> Placement {
        let index = self.column_from_x(x);
        Placement {
            index: index.0 as i32,
            position: index.1,
            size: self.column_width(index.0) as f32,
        }
    }
    /// gets the screen coordinate and size for a pixel y-coordinate. Returns a [`Placement`]
    #[wasm_bindgen(js_name = "getYPlacement")]
    pub fn js_y_placement(&mut self, y: f64) -> Placement {
        let index = self.row_from_y(y);
        Placement {
            index: index.0 as i32,
            position: index.1,
            size: self.row_height(index.0) as f32,
        }
    }

    #[wasm_bindgen(js_name = "getColumnFromScreen")]
    pub fn js_column_from_screen(&mut self, x: f64) -> i32 {
        self.column_from_x(x).0 as i32
    }

    #[wasm_bindgen(js_name = "getRowFromScreen")]
    pub fn js_row_from_screen(&mut self, y: f64) -> i32 {
        self.row_from_y(y).0 as i32
    }

    /// gets the column and row based on the pixels' coordinates. Returns a (column, row) index
    #[wasm_bindgen(js_name = "getColumnRowFromScreen")]
    pub fn js_get_column_row_from_screen(&mut self, x: f64, y: f64) -> String {
        let column_row = ColumnRow {
            column: self.js_x_placement(x).index,
            row: self.js_y_placement(y).index,
        };
        serde_json::to_string(&column_row).unwrap_or("".to_string())
    }

    /// Resizes a column transiently; the operation must be committed using
    /// `commitResize()` or canceled using `cancelResize()`. If `size` is `null`
    /// then the column width is reset.
    #[wasm_bindgen(js_name = "resizeColumnTransiently")]
    pub fn js_resize_column_transiently(&mut self, column: i32, size: Option<f64>) {
        self.resize_column_transiently(column as i64, size);
    }

    /// Resizes a row transiently; the operation must be committed using
    /// `commitResize()` or canceled using `cancelResize()`. If `size` is `null`
    /// then the row height is reset.
    #[wasm_bindgen(js_name = "resizeRowTransiently")]
    pub fn js_resize_row_transiently(&mut self, row: i32, size: Option<f64>) {
        self.resize_row_transiently(row as i64, size);
    }
    /// Cancels a resize operation.
    #[wasm_bindgen(js_name = "cancelResize")]
    pub fn js_cancel_resize(&mut self) {
        self.cancel_resize();
    }

    /// Returns and removes the transient resize for the current offset.
    /// Use this on the local SheetOffsets to get the resize to apply to the Grid's SheetOffsets.
    ///
    /// Returns a [`TransientResize` || undefined]
    #[wasm_bindgen(js_name = "getResizeToApply")]
    pub fn js_get_resize_to_apply(&mut self) -> Option<String> {
        let transient_resize = self.pop_local_transient_resize()?;
        serde_json::to_string(&transient_resize).ok()
    }
}
