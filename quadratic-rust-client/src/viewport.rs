//! Viewport buffer WASM bindings
//!
//! Provides TypeScript-accessible wrappers for the ViewportBuffer.
//!
//! - ViewportBufferWriter: Used by main thread to WRITE viewport state
//! - ViewportBuffer: Used by workers to READ viewport state

use js_sys::{Float32Array, Int32Array, SharedArrayBuffer, Uint8Array};
use wasm_bindgen::prelude::*;

use quadratic_core_shared::{
    SHEET_ID_SIZE, SliceFlag, SliceOffset, VIEWPORT_BUFFER_SIZE, VIEWPORT_SLICE_SIZE,
    ViewportBuffer as CoreViewportBuffer, VisibleBounds,
};

/// Get the required size for the viewport SharedArrayBuffer
#[wasm_bindgen(js_name = "getViewportBufferSize")]
pub fn get_viewport_buffer_size() -> u32 {
    VIEWPORT_BUFFER_SIZE
}

/// Create a new SharedArrayBuffer for viewport synchronization
#[wasm_bindgen(js_name = "createViewportBuffer")]
pub fn create_viewport_buffer() -> SharedArrayBuffer {
    SharedArrayBuffer::new(VIEWPORT_BUFFER_SIZE)
}

// ============================================================================
// ViewportBufferWriter - Main thread WRITES to this buffer
// ============================================================================

/// ViewportBufferWriter - WASM wrapper for writing viewport state to SharedArrayBuffer
///
/// Used by the main thread to write viewport state that workers will read.
/// Implements ping-pong double-buffering for lock-free communication.
#[wasm_bindgen]
pub struct ViewportBufferWriter {
    buffer: SharedArrayBuffer,
    int32_view: Int32Array,
    float32_view: Float32Array,
    uint8_view: Uint8Array,
    write_slice: u32,
}

#[wasm_bindgen]
impl ViewportBufferWriter {
    /// Create a new ViewportBufferWriter from a SharedArrayBuffer
    #[wasm_bindgen(constructor)]
    pub fn new(buffer: SharedArrayBuffer) -> Self {
        let int32_view = Int32Array::new(&buffer);
        let float32_view = Float32Array::new(&buffer);
        let uint8_view = Uint8Array::new(&buffer);

        Self {
            buffer,
            int32_view,
            float32_view,
            uint8_view,
            write_slice: 0,
        }
    }

    /// Get the underlying SharedArrayBuffer
    #[wasm_bindgen(js_name = "getBuffer")]
    pub fn get_buffer(&self) -> SharedArrayBuffer {
        self.buffer.clone()
    }

    /// Get the flag index (in i32 units) for a slice
    fn flag_index(slice: u32) -> u32 {
        (slice * VIEWPORT_SLICE_SIZE) / 4
    }

    /// Get the float offset (in f32 units) for a slice's data
    fn float_offset(slice: u32) -> u32 {
        slice * (VIEWPORT_SLICE_SIZE / 4) + 1
    }

    /// Get the byte offset for the sheetId field in a slice
    fn sheet_id_byte_offset(slice: u32) -> u32 {
        slice * VIEWPORT_SLICE_SIZE + SliceOffset::SheetId as u32
    }

    /// Write the sheetId string to a slice
    fn write_sheet_id(&self, slice: u32, sheet_id: &str) {
        let offset = Self::sheet_id_byte_offset(slice);
        let bytes = sheet_id.as_bytes();
        for i in 0..SHEET_ID_SIZE {
            let value = if i < bytes.len() { bytes[i] } else { 0 };
            self.uint8_view.set_index(offset + i as u32, value);
        }
    }

    /// Write all viewport state values at once
    #[wasm_bindgen(js_name = "writeAll")]
    pub fn write_all(
        &mut self,
        position_x: f32,
        position_y: f32,
        scale: f32,
        dpr: f32,
        width: f32,
        height: f32,
        dirty: bool,
        sheet_id: &str,
    ) {
        let slice = self.write_slice;
        let flag_idx = Self::flag_index(slice);
        let float_offset = Self::float_offset(slice);

        // Check if current slice is locked - if so, try the other slice
        let mut target_slice = slice;
        let mut target_flag_idx = flag_idx;
        let mut target_float_offset = float_offset;

        let current_flag = self.int32_view.get_index(flag_idx);
        if current_flag == SliceFlag::Locked as i32 {
            let other_slice = if slice == 0 { 1 } else { 0 };
            let other_flag_idx = Self::flag_index(other_slice);
            let other_flag = self.int32_view.get_index(other_flag_idx);

            if other_flag != SliceFlag::Locked as i32 {
                target_slice = other_slice;
                target_flag_idx = other_flag_idx;
                target_float_offset = Self::float_offset(other_slice);
            }
        }

        // Mark slice as being written (uninitialized)
        self.int32_view
            .set_index(target_flag_idx, SliceFlag::Uninitialized as i32);

        // Write all data
        self.float32_view.set_index(target_float_offset, position_x);
        self.float32_view
            .set_index(target_float_offset + 1, position_y);
        self.float32_view.set_index(target_float_offset + 2, scale);
        self.float32_view.set_index(target_float_offset + 3, dpr);
        self.float32_view.set_index(target_float_offset + 4, width);
        self.float32_view.set_index(target_float_offset + 5, height);
        self.float32_view
            .set_index(target_float_offset + 6, if dirty { 1.0 } else { 0.0 });
        self.float32_view.set_index(target_float_offset + 7, 0.0); // reserved

        // Write sheet_id
        self.write_sheet_id(target_slice, sheet_id);

        // Mark slice as ready
        self.int32_view
            .set_index(target_flag_idx, SliceFlag::Ready as i32);

        // Toggle for next write
        self.write_slice = if target_slice == 0 { 1 } else { 0 };
    }

    /// Mark the viewport as dirty in both slices
    #[wasm_bindgen(js_name = "markDirty")]
    pub fn mark_dirty(&self) {
        self.float32_view.set_index(Self::float_offset(0) + 6, 1.0);
        self.float32_view.set_index(Self::float_offset(1) + 6, 1.0);
    }

    /// Mark the viewport as clean in both slices
    #[wasm_bindgen(js_name = "markClean")]
    pub fn mark_clean(&self) {
        self.float32_view.set_index(Self::float_offset(0) + 6, 0.0);
        self.float32_view.set_index(Self::float_offset(1) + 6, 0.0);
    }

    /// Reset both slices to uninitialized state
    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.int32_view
            .set_index(Self::flag_index(0), SliceFlag::Uninitialized as i32);
        self.int32_view
            .set_index(Self::flag_index(1), SliceFlag::Uninitialized as i32);
        self.write_slice = 0;
    }
}

// ============================================================================
// ViewportBuffer - Workers READ from this buffer
// ============================================================================

/// ViewportBuffer - WASM wrapper for reading viewport state from SharedArrayBuffer
///
/// This wraps the core ViewportBuffer to expose it to TypeScript.
#[wasm_bindgen]
pub struct ViewportBuffer {
    inner: CoreViewportBuffer,
}

#[wasm_bindgen]
impl ViewportBuffer {
    /// Create a new ViewportBuffer from a SharedArrayBuffer
    #[wasm_bindgen(constructor)]
    pub fn new(buffer: SharedArrayBuffer) -> Self {
        Self {
            inner: CoreViewportBuffer::from_buffer(buffer),
        }
    }

    /// Sync from the SharedArrayBuffer - call this each frame
    /// Returns true if the viewport has changed since last sync
    #[wasm_bindgen]
    pub fn sync(&mut self) -> bool {
        self.inner.sync()
    }

    /// Get the X position in world coordinates
    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f32 {
        self.inner.x()
    }

    /// Get the Y position in world coordinates
    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f32 {
        self.inner.y()
    }

    /// Get the current scale (zoom level)
    #[wasm_bindgen(getter)]
    pub fn scale(&self) -> f32 {
        self.inner.scale()
    }

    /// Get the device pixel ratio
    #[wasm_bindgen(getter)]
    pub fn dpr(&self) -> f32 {
        self.inner.dpr()
    }

    /// Get the effective rendering scale (scale * dpr)
    #[wasm_bindgen(getter, js_name = "effectiveScale")]
    pub fn effective_scale(&self) -> f32 {
        self.inner.effective_scale()
    }

    /// Get the viewport width in screen pixels
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> f32 {
        self.inner.width()
    }

    /// Get the viewport height in screen pixels
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> f32 {
        self.inner.height()
    }

    /// Get the current sheet_id as a string (36-byte UUID)
    #[wasm_bindgen(getter, js_name = "sheetId")]
    pub fn sheet_id(&self) -> String {
        self.inner.sheet_id_str().to_string()
    }

    /// Check if the viewport is dirty (has been updated since last render)
    #[wasm_bindgen(getter)]
    pub fn dirty(&self) -> bool {
        self.inner.dirty
    }

    /// Mark the viewport as clean (after rendering)
    #[wasm_bindgen(js_name = "markClean")]
    pub fn mark_clean(&mut self) {
        self.inner.mark_clean()
    }

    /// Convert screen coordinates (device pixels) to world coordinates
    /// Returns [worldX, worldY]
    #[wasm_bindgen(js_name = "screenToWorld")]
    pub fn screen_to_world(&self, screen_x: f32, screen_y: f32) -> Box<[f32]> {
        let (world_x, world_y) = self.inner.screen_to_world(screen_x, screen_y);
        Box::new([world_x, world_y])
    }

    /// Convert world coordinates to screen coordinates (device pixels)
    /// Returns [screenX, screenY]
    #[wasm_bindgen(js_name = "worldToScreen")]
    pub fn world_to_screen(&self, world_x: f32, world_y: f32) -> Box<[f32]> {
        let (screen_x, screen_y) = self.inner.world_to_screen(world_x, world_y);
        Box::new([screen_x, screen_y])
    }

    /// Get the visible bounds in world coordinates
    /// Returns { left, top, right, bottom, width, height }
    #[wasm_bindgen(js_name = "getVisibleBounds")]
    pub fn get_visible_bounds(&self) -> JsVisibleBounds {
        let bounds = self.inner.visible_bounds();
        JsVisibleBounds::from(bounds)
    }

    /// Get the visible hash bounds for the current viewport
    /// Returns { topLeftX, topLeftY, bottomRightX, bottomRightY }
    #[wasm_bindgen(js_name = "getHashBounds")]
    pub fn get_hash_bounds(&self) -> JsHashBounds {
        let (top_left, bottom_right) = self.inner.hash_bounds();
        JsHashBounds {
            top_left_x: top_left.x,
            top_left_y: top_left.y,
            bottom_right_x: bottom_right.x,
            bottom_right_y: bottom_right.y,
        }
    }
}

/// Visible bounds in world coordinates (returned by getVisibleBounds)
#[wasm_bindgen]
pub struct JsVisibleBounds {
    #[wasm_bindgen(readonly)]
    pub left: f32,
    #[wasm_bindgen(readonly)]
    pub top: f32,
    #[wasm_bindgen(readonly)]
    pub right: f32,
    #[wasm_bindgen(readonly)]
    pub bottom: f32,
    #[wasm_bindgen(readonly)]
    pub width: f32,
    #[wasm_bindgen(readonly)]
    pub height: f32,
}

impl From<VisibleBounds> for JsVisibleBounds {
    fn from(bounds: VisibleBounds) -> Self {
        Self {
            left: bounds.left,
            top: bounds.top,
            right: bounds.right,
            bottom: bounds.bottom,
            width: bounds.width,
            height: bounds.height,
        }
    }
}

/// Hash bounds (cell sheet coordinates) returned by getHashBounds
#[wasm_bindgen]
pub struct JsHashBounds {
    #[wasm_bindgen(readonly, js_name = "topLeftX")]
    pub top_left_x: i64,
    #[wasm_bindgen(readonly, js_name = "topLeftY")]
    pub top_left_y: i64,
    #[wasm_bindgen(readonly, js_name = "bottomRightX")]
    pub bottom_right_x: i64,
    #[wasm_bindgen(readonly, js_name = "bottomRightY")]
    pub bottom_right_y: i64,
}
