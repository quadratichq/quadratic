//! ViewportBuffer - reads viewport state from SharedArrayBuffer with ping-pong double-buffering
//!
//! This module provides a way to read viewport state that is controlled
//! by the main thread and synced via SharedArrayBuffer using atomic locking
//! to ensure consistent reads.

#[cfg(feature = "js")]
use js_sys::{Float32Array, Int32Array, SharedArrayBuffer, Uint8Array};

#[cfg(feature = "js")]
use std::sync::atomic::{AtomicI32, Ordering};

use crate::{CELL_SHEET_HEIGHT, CELL_SHEET_WIDTH, Pos, SheetId};

/// Size of the sheet_id field in bytes (UUID string)
pub const SHEET_ID_SIZE: usize = 36;

/// Size of a single viewport slice in bytes
pub const VIEWPORT_SLICE_SIZE: u32 = 72; // 1 i32 + 8 f32 + 36 bytes = 72 bytes

/// Size of the viewport buffer in bytes (two slices)
pub const VIEWPORT_BUFFER_SIZE: u32 = 144; // 72 * 2

/// Flag values for slice state
#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SliceFlag {
    Uninitialized = 0,
    Ready = 1,
    Locked = 2,
}

/// Byte offsets within a ViewportSlice
#[repr(usize)]
pub enum SliceOffset {
    Flag = 0,
    PositionX = 4,
    PositionY = 8,
    Scale = 12,
    Dpr = 16,
    Width = 20,
    Height = 24,
    Dirty = 28,
    Reserved = 32,
    SheetId = 36, // 36 bytes for UUID string
}

/// Represents the visible area in world coordinates
#[derive(Debug, Clone, Copy)]
pub struct VisibleBounds {
    pub left: f32,
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub width: f32,
    pub height: f32,
}

/// ViewportBuffer - reads viewport state from SharedArrayBuffer with ping-pong buffering
///
/// The viewport state is controlled by the main thread and synced via SharedArrayBuffer.
/// Uses atomic locking to ensure consistent reads across all fields.
#[derive(Clone)]
#[cfg(feature = "js")]
pub struct ViewportBuffer {
    /// The SharedArrayBuffer containing viewport state
    buffer: SharedArrayBuffer,

    /// Int32Array view for atomic flag operations
    int32_view: Int32Array,

    /// Float32Array view for reading data
    float32_view: Float32Array,

    /// Uint8Array view for reading sheet_id bytes
    uint8_view: Uint8Array,

    /// Cached values for performance
    position_x: f32,
    position_y: f32,
    scale: f32,
    dpr: f32,
    width: f32,
    height: f32,

    /// Cached sheet_id as string (36-byte UUID)
    sheet_id: String,

    /// Whether the viewport has been marked dirty since last frame
    pub dirty: bool,

    /// Minimum allowed scale
    min_scale: f32,

    /// Maximum allowed scale
    max_scale: f32,
}

#[cfg(feature = "js")]
impl PartialEq for ViewportBuffer {
    fn eq(&self, _: &Self) -> bool {
        true
    }
}

#[cfg(feature = "js")]
impl std::fmt::Debug for ViewportBuffer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ViewportBuffer")
            .field("position", &(self.position_x, self.position_y))
            .field("scale", &self.scale)
            .field("dpr", &self.dpr)
            .field("size", &(self.width, self.height))
            .field("sheet_id", &self.sheet_id)
            .field("dirty", &self.dirty)
            .finish()
    }
}

#[cfg(feature = "js")]
unsafe impl Send for ViewportBuffer {}

#[cfg(feature = "js")]
impl ViewportBuffer {
    /// Create a new ViewportBuffer from a SharedArrayBuffer
    pub fn from_buffer(buffer: SharedArrayBuffer) -> Self {
        let int32_view = Int32Array::new(&buffer);
        let float32_view = Float32Array::new(&buffer);
        let uint8_view = Uint8Array::new(&buffer);

        let mut viewport = Self {
            buffer,
            int32_view,
            float32_view,
            uint8_view,
            position_x: 0.0,
            position_y: 0.0,
            scale: 1.0,
            dpr: 1.0,
            width: 0.0,
            height: 0.0,
            sheet_id: String::new(),
            dirty: true,
            min_scale: 0.01,
            max_scale: f32::MAX,
        };

        // Try to read initial values
        viewport.sync();
        viewport
    }

    /// Get the flag index (in i32 units) for a slice
    fn flag_index(slice: u32) -> u32 {
        (slice * VIEWPORT_SLICE_SIZE) / 4
    }

    /// Get the float offset (in f32 units) for a slice's data
    fn float_offset(slice: u32) -> u32 {
        // The flag takes up 1 i32 (4 bytes), so floats start at byte 4 of the slice
        slice * (VIEWPORT_SLICE_SIZE / 4) + 1
    }

    /// Try to lock a slice for reading using compare-exchange.
    /// Returns true if lock was acquired.
    fn try_lock_slice(&self, slice: u32) -> bool {
        let flag_index = Self::flag_index(slice);
        let current_flag = self.int32_view.get_index(flag_index);

        // Only try to lock if the flag indicates the slice is ready (1)
        if current_flag != SliceFlag::Ready as i32 {
            return false;
        }

        // Attempt atomic compare-exchange: 1 -> 2
        AtomicI32::new(current_flag)
            .compare_exchange(
                SliceFlag::Ready as i32,
                SliceFlag::Locked as i32,
                Ordering::Acquire,
                Ordering::Relaxed,
            )
            .is_ok()
    }

    /// Unlock a slice by setting its flag back to Ready.
    fn unlock_slice(&self, slice: u32) {
        let flag_index = Self::flag_index(slice);
        let current_flag = self.int32_view.get_index(flag_index);

        let _ = AtomicI32::new(current_flag).compare_exchange(
            SliceFlag::Locked as i32,
            SliceFlag::Ready as i32,
            Ordering::Release,
            Ordering::Relaxed,
        );
    }

    /// Read viewport data from a specific slice
    fn read_slice(&self, slice: u32) -> (f32, f32, f32, f32, f32, f32, f32, String) {
        let offset = Self::float_offset(slice);

        let position_x = self.float32_view.get_index(offset);
        let position_y = self.float32_view.get_index(offset + 1);
        let scale = self.float32_view.get_index(offset + 2);
        let dpr = self.float32_view.get_index(offset + 3);
        let width = self.float32_view.get_index(offset + 4);
        let height = self.float32_view.get_index(offset + 5);
        let dirty = self.float32_view.get_index(offset + 6);

        // Read sheet_id bytes (starts at byte offset 36 within the slice)
        let sheet_id_byte_offset = (slice * VIEWPORT_SLICE_SIZE) + SliceOffset::SheetId as u32;
        let mut sheet_id_bytes = [0u8; SHEET_ID_SIZE];
        for i in 0..SHEET_ID_SIZE {
            sheet_id_bytes[i] = self.uint8_view.get_index(sheet_id_byte_offset + i as u32);
        }
        let sheet_id = String::from_utf8_lossy(&sheet_id_bytes).to_string();

        (
            position_x, position_y, scale, dpr, width, height, dirty, sheet_id,
        )
    }

    /// Sync from the SharedArrayBuffer - call this each frame
    ///
    /// Returns true if the viewport has changed since last sync
    pub fn sync(&mut self) -> bool {
        // Try to lock and read from slice A (0) first, then slice B (1)
        let data = if self.try_lock_slice(0) {
            let data = self.read_slice(0);
            self.unlock_slice(0);
            Some(data)
        } else if self.try_lock_slice(1) {
            let data = self.read_slice(1);
            self.unlock_slice(1);
            Some(data)
        } else {
            // Neither slice is ready, keep current values
            None
        };

        if let Some((
            new_x,
            new_y,
            new_scale,
            new_dpr,
            new_width,
            new_height,
            dirty_value,
            new_sheet_id,
        )) = data
        {
            let changed = (self.position_x - new_x).abs() > f32::EPSILON
                || (self.position_y - new_y).abs() > f32::EPSILON
                || (self.scale - new_scale).abs() > f32::EPSILON
                || (self.dpr - new_dpr).abs() > f32::EPSILON
                || (self.width - new_width).abs() > f32::EPSILON
                || (self.height - new_height).abs() > f32::EPSILON
                || self.sheet_id != new_sheet_id
                || dirty_value != 0.0;

            self.position_x = new_x;
            self.position_y = new_y;
            self.scale = new_scale.max(self.min_scale).min(self.max_scale);
            self.dpr = new_dpr.max(1.0);
            self.width = new_width;
            self.height = new_height;
            self.sheet_id = new_sheet_id;
            self.dirty = dirty_value != 0.0;

            changed
        } else {
            false
        }
    }

    /// Get the SharedArrayBuffer
    pub fn buffer(&self) -> &SharedArrayBuffer {
        &self.buffer
    }

    /// Get the device pixel ratio
    pub fn dpr(&self) -> f32 {
        self.dpr
    }

    /// Get the current scale (zoom level)
    pub fn scale(&self) -> f32 {
        self.scale
    }

    /// Get the effective rendering scale (scale * dpr)
    pub fn effective_scale(&self) -> f32 {
        self.scale * self.dpr
    }

    /// Get the X position
    pub fn x(&self) -> f32 {
        self.position_x
    }

    /// Get the Y position
    pub fn y(&self) -> f32 {
        self.position_y
    }

    /// Get the viewport width in screen pixels
    pub fn width(&self) -> f32 {
        self.width
    }

    /// Get the viewport height in screen pixels
    pub fn height(&self) -> f32 {
        self.height
    }

    /// Get the current sheet_id as a string (36-byte UUID)
    pub fn sheet_id_str(&self) -> &str {
        &self.sheet_id
    }

    /// Get the current sheet_id parsed as SheetId
    pub fn sheet_id(&self) -> Option<SheetId> {
        use std::str::FromStr;
        SheetId::from_str(&self.sheet_id).ok()
    }

    /// Convert screen coordinates (device pixels) to world coordinates
    pub fn screen_to_world(&self, screen_x: f32, screen_y: f32) -> (f32, f32) {
        let effective_scale = self.scale * self.dpr;
        (
            self.position_x + screen_x / effective_scale,
            self.position_y + screen_y / effective_scale,
        )
    }

    /// Convert world coordinates to screen coordinates (device pixels)
    pub fn world_to_screen(&self, world_x: f32, world_y: f32) -> (f32, f32) {
        let effective_scale = self.scale * self.dpr;
        (
            (world_x - self.position_x) * effective_scale,
            (world_y - self.position_y) * effective_scale,
        )
    }

    /// Get the visible bounds in world coordinates
    pub fn visible_bounds(&self) -> VisibleBounds {
        let (left, top) = self.screen_to_world(0.0, 0.0);
        let (right, bottom) = self.screen_to_world(self.width, self.height);

        VisibleBounds {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top,
        }
    }

    /// Get the visible hash bounds for the current viewport.
    /// Returns (top_left_pos, bottom_right_pos) using Pos for hash coordinates.
    pub fn hash_bounds(&self) -> (Pos, Pos) {
        let bounds = self.visible_bounds();

        let top_left = Pos {
            x: (bounds.left / CELL_SHEET_WIDTH as f32).floor() as i64,
            y: (bounds.top / CELL_SHEET_HEIGHT as f32).floor() as i64,
        };
        let bottom_right = Pos {
            x: (bounds.right / CELL_SHEET_WIDTH as f32).ceil() as i64,
            y: (bounds.bottom / CELL_SHEET_HEIGHT as f32).ceil() as i64,
        };

        (top_left, bottom_right)
    }

    /// Get the viewport data in the format expected by the old core-shared ViewportBuffer.
    /// Returns (top_left, bottom_right, sheet_id) for compatibility.
    pub fn get_viewport(&self) -> Option<(Pos, Pos, SheetId)> {
        let sheet_id = self.sheet_id()?;
        let (top_left, bottom_right) = self.hash_bounds();
        Some((top_left, bottom_right, sheet_id))
    }

    /// Mark the viewport as clean (after rendering)
    pub fn mark_clean(&mut self) {
        self.dirty = false;

        // Write clean flag to both slices
        self.float32_view.set_index(Self::float_offset(0) + 6, 0.0);
        self.float32_view.set_index(Self::float_offset(1) + 6, 0.0);
    }
}

// ============================================================================
// Test-only ViewportBuffer (no SharedArrayBuffer needed)
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
#[cfg(not(feature = "js"))]
pub struct ViewportBuffer {
    position_x: f32,
    position_y: f32,
    scale: f32,
    dpr: f32,
    width: f32,
    height: f32,
    sheet_id: SheetId,
}

#[cfg(not(feature = "js"))]
impl Default for ViewportBuffer {
    fn default() -> Self {
        ViewportBuffer {
            position_x: 0.0,
            position_y: 0.0,
            scale: 1.0,
            dpr: 1.0,
            width: 1000.0,
            height: 1000.0,
            sheet_id: SheetId::TEST,
        }
    }
}

#[cfg(not(feature = "js"))]
impl ViewportBuffer {
    pub fn x(&self) -> f32 {
        self.position_x
    }

    pub fn y(&self) -> f32 {
        self.position_y
    }

    pub fn scale(&self) -> f32 {
        self.scale
    }

    pub fn dpr(&self) -> f32 {
        self.dpr
    }

    pub fn width(&self) -> f32 {
        self.width
    }

    pub fn height(&self) -> f32 {
        self.height
    }

    pub fn sheet_id(&self) -> Option<SheetId> {
        Some(self.sheet_id)
    }

    pub fn visible_bounds(&self) -> VisibleBounds {
        VisibleBounds {
            left: self.position_x,
            top: self.position_y,
            right: self.position_x + self.width / self.scale,
            bottom: self.position_y + self.height / self.scale,
            width: self.width / self.scale,
            height: self.height / self.scale,
        }
    }

    pub fn hash_bounds(&self) -> (Pos, Pos) {
        let bounds = self.visible_bounds();
        let top_left = Pos {
            x: (bounds.left / CELL_SHEET_WIDTH as f32).floor() as i64,
            y: (bounds.top / CELL_SHEET_HEIGHT as f32).floor() as i64,
        };
        let bottom_right = Pos {
            x: (bounds.right / CELL_SHEET_WIDTH as f32).ceil() as i64,
            y: (bounds.bottom / CELL_SHEET_HEIGHT as f32).ceil() as i64,
        };
        (top_left, bottom_right)
    }

    pub fn get_viewport(&self) -> Option<(Pos, Pos, SheetId)> {
        // Return a test viewport covering hash coordinates -10 to 10
        Some((Pos { x: -10, y: -10 }, Pos { x: 10, y: 10 }, SheetId::TEST))
    }
}
