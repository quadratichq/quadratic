//! CellsFillsHash - spatial hash for fill rectangles

use quadratic_core_shared::{RenderFill, SheetOffsets};
use quadratic_renderer_core::{FillBuffer, HASH_HEIGHT, HASH_WIDTH};

use crate::utils::color::parse_color_string;

/// A spatial hash containing fills for a hash region
pub struct CellsFillsHash {
    /// Hash coordinates
    pub hash_x: i64,
    pub hash_y: i64,

    /// Fills in this hash region
    fills: Vec<RenderFill>,

    /// Cached fill buffer for rendering
    cached_buffer: FillBuffer,

    /// World bounds
    pub world_x: f32,
    pub world_y: f32,
    pub world_width: f32,
    pub world_height: f32,

    /// Whether this hash needs rebuild
    dirty: bool,
}

impl CellsFillsHash {
    pub fn new(hash_x: i64, hash_y: i64, offsets: &SheetOffsets) -> Self {
        // Calculate the cell range for this hash (1-indexed)
        let start_col = hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH - 1;
        let start_row = hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT - 1;

        // Get world bounds from offsets
        let (x_start, _) = offsets.column_position_size(start_col);
        let (x_end, width_end) = offsets.column_position_size(end_col);
        let (y_start, _) = offsets.row_position_size(start_row);
        let (y_end, height_end) = offsets.row_position_size(end_row);

        Self {
            hash_x,
            hash_y,
            fills: Vec::new(),
            cached_buffer: FillBuffer::new(),
            world_x: x_start as f32,
            world_y: y_start as f32,
            world_width: (x_end + width_end - x_start) as f32,
            world_height: (y_end + height_end - y_start) as f32,
            dirty: false,
        }
    }

    /// Set fills for this hash
    pub fn set_fills(&mut self, fills: Vec<RenderFill>) {
        self.fills = fills;
        self.dirty = true;
    }

    /// Clear all fills
    pub fn clear(&mut self) {
        self.fills.clear();
        self.cached_buffer = FillBuffer::new();
        self.dirty = false;
    }

    pub fn is_empty(&self) -> bool {
        self.fills.is_empty()
    }

    pub fn fill_count(&self) -> usize {
        self.fills.len()
    }

    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Rebuild cached buffer if dirty
    pub fn rebuild_if_dirty(&mut self, offsets: &SheetOffsets) {
        if !self.dirty {
            return;
        }

        self.cached_buffer = FillBuffer::new();
        self.cached_buffer.reserve(self.fills.len());

        for fill in &self.fills {
            let (x, _) = offsets.column_position_size(fill.x);
            let (y, _) = offsets.row_position_size(fill.y);

            let (x_end, w_end) = offsets.column_position_size(fill.x + fill.w as i64 - 1);
            let (y_end, h_end) = offsets.row_position_size(fill.y + fill.h as i64 - 1);

            let width = (x_end + w_end - x) as f32;
            let height = (y_end + h_end - y) as f32;

            let color = parse_color_string(&fill.color);
            self.cached_buffer
                .add_rect(x as f32, y as f32, width, height, color);
        }

        self.dirty = false;
    }

    /// Get the cached buffer
    pub fn buffer(&self) -> &FillBuffer {
        &self.cached_buffer
    }

    /// Take the cached buffer (for transfer)
    pub fn take_buffer(&mut self) -> FillBuffer {
        std::mem::take(&mut self.cached_buffer)
    }
}
