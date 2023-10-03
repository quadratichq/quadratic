use super::SheetOffsets;
use crate::ScreenRect;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct Placement {
    pub index: i32,
    pub position: f64,
    pub size: i32,
}

#[wasm_bindgen]
impl SheetOffsets {
    /// Returns a rectangle with the screen coordinates for a cell
    #[wasm_bindgen(js_name = "getCellOffsets")]
    pub fn js_get_cell_offsets(&self, column: i32, row: i32) -> ScreenRect {
        self.cell_offsets(column as i64, row as i64)
    }

    /// gets the column width. Returns a f32
    #[wasm_bindgen(js_name = "getColumnWidth")]
    pub fn js_column_width(&self, sheet_id: String, x: i32) -> f32 {
        self.column_width(x as i64) as f32
    }

    /// gets the row height from a row index
    #[wasm_bindgen(js_name = "getRowHeight")]
    pub fn js_row_height(&self, y: i32) -> f32 {
        self.row_height(y as i64) as f32
    }

    /// gets the screen coordinate and size for a row. Returns a [`Placement`]
    #[wasm_bindgen(js_name = "getColumnPlacement")]
    pub fn js_column_placement(&self, column: i32) -> Placement {
        let (position, size) = self.column_position_size(column as i64);
        Placement {
            index: column,
            position,
            size: size as i32,
        }
    }
    /// gets the screen coordinate and size for a pixel y-coordinate. Returns a [`Placement`]
    #[wasm_bindgen(js_name = "getRowPlacement")]
    pub fn js_row_placement(&self, row: i32) -> Placement {
        let (position, size) = self.row_position_size(row as i64);
        Placement {
            index: row,
            position,
            size: size as i32,
        }
    }

    /// gets the screen coordinate and size for a pixel x-coordinate. Returns a [`Placement`]
    #[wasm_bindgen(js_name = "getXPlacement")]
    pub fn js_x_placement(&self, x: f64) -> Placement {
        let index = self.column_from_x(x);
        Placement {
            index: index.0 as i32,
            position: index.1,
            size: self.column_width(index.0) as i32,
        }
    }
    /// gets the screen coordinate and size for a pixel y-coordinate. Returns a [`Placement`]
    #[wasm_bindgen(js_name = "getYPlacement")]
    pub fn js_y_placement(&self, y: f64) -> Placement {
        let index = self.row_from_y(y);
        Placement {
            index: index.0 as i32,
            position: index.1,
            size: self.row_height(index.0) as i32,
        }
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
}
