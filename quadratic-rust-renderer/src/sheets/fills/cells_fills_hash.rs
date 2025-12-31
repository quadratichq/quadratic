//! CellsFillsHash - spatial hash for efficient fill rendering
//!
//! Groups fills into 15×30 cell regions for:
//! - Hash-level visibility culling
//! - Incremental updates (only rebuild dirty hashes)
//! - Batched rectangle caching per hash
//! - Lazy loading: only load hashes within viewport + padding

use quadratic_core_shared::{RenderFill, SheetOffsets};

use crate::renderers::render_context::RenderContext;
use crate::renderers::Rects;

use super::parse_color_string;

/// Hash dimensions (matches client: CellsTypes.ts and core: renderer_constants.rs)
pub const HASH_WIDTH: i64 = 15; // columns per hash
pub const HASH_HEIGHT: i64 = 30; // rows per hash

/// A spatial hash containing fills for a 15×30 cell region
pub struct CellsFillsHash {
    /// Hash coordinates (not pixel coordinates)
    pub hash_x: i64,
    pub hash_y: i64,

    /// Fills in this hash region
    fills: Vec<RenderFill>,

    /// Cached rectangle batch for rendering
    cached_rects: Rects,

    /// Bounds in world coordinates (for visibility culling)
    pub world_x: f32,
    pub world_y: f32,
    pub world_width: f32,
    pub world_height: f32,

    /// Whether this hash needs to rebuild its rect cache
    dirty: bool,
}

impl CellsFillsHash {
    /// Create a new hash for the given hash coordinates
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

        let world_x = x_start as f32;
        let world_y = y_start as f32;
        let world_width = (x_end + width_end - x_start) as f32;
        let world_height = (y_end + height_end - y_start) as f32;

        Self {
            hash_x,
            hash_y,
            fills: Vec::new(),
            cached_rects: Rects::new(),
            world_x,
            world_y,
            world_width,
            world_height,
            dirty: false,
        }
    }

    /// Update world bounds from sheet offsets (call when offsets change)
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        let start_col = self.hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH - 1;
        let start_row = self.hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT - 1;

        let (x_start, _) = offsets.column_position_size(start_col);
        let (x_end, width_end) = offsets.column_position_size(end_col);
        let (y_start, _) = offsets.row_position_size(start_row);
        let (y_end, height_end) = offsets.row_position_size(end_row);

        self.world_x = x_start as f32;
        self.world_y = y_start as f32;
        self.world_width = (x_end + width_end - x_start) as f32;
        self.world_height = (y_end + height_end - y_start) as f32;

        // Mark dirty since bounds changed (fill positions need recalculation)
        self.dirty = true;
    }

    /// Set fills for this hash, replacing any existing fills
    pub fn set_fills(&mut self, fills: Vec<RenderFill>) {
        self.fills = fills;
        self.dirty = true;
    }

    /// Clear all fills
    pub fn clear(&mut self) {
        self.fills.clear();
        self.cached_rects.clear();
        self.dirty = false;
    }

    /// Check if this hash has any fills
    pub fn is_empty(&self) -> bool {
        self.fills.is_empty()
    }

    /// Get the number of fills in this hash
    pub fn fill_count(&self) -> usize {
        self.fills.len()
    }

    /// Mark this hash as dirty (needs rebuild)
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Check if this hash is dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Check if this hash intersects the given viewport bounds
    pub fn intersects_viewport(&self, min_x: f32, max_x: f32, min_y: f32, max_y: f32) -> bool {
        let hash_right = self.world_x + self.world_width;
        let hash_bottom = self.world_y + self.world_height;

        !(hash_right < min_x || self.world_x > max_x || hash_bottom < min_y || self.world_y > max_y)
    }

    /// Rebuild cached rectangles from fills if dirty
    pub fn rebuild_if_dirty(&mut self, offsets: &SheetOffsets) {
        if !self.dirty {
            return;
        }

        self.cached_rects.clear();
        self.cached_rects.reserve(self.fills.len());

        for fill in &self.fills {
            // Get screen rectangle from cell coordinates
            let (x, _) = offsets.column_position_size(fill.x);
            let (y, _) = offsets.row_position_size(fill.y);

            // Calculate width and height by getting the end position
            let (x_end, w_end) = offsets.column_position_size(fill.x + fill.w as i64 - 1);
            let (y_end, h_end) = offsets.row_position_size(fill.y + fill.h as i64 - 1);

            let width = (x_end + w_end - x) as f32;
            let height = (y_end + h_end - y) as f32;

            let color = parse_color_string(&fill.color);
            self.cached_rects.add(x as f32, y as f32, width, height, color);
        }

        self.dirty = false;
    }

    /// Render the cached rectangles
    pub fn render(&self, ctx: &mut impl RenderContext, matrix: &[f32; 16]) {
        if !self.cached_rects.is_empty() {
            self.cached_rects.render(ctx, matrix);
        }
    }

    /// Get the cached rects for external rendering (e.g., WebGPU)
    pub fn cached_rects(&self) -> &Rects {
        &self.cached_rects
    }
}

/// Get hash coordinates for a cell position (1-indexed columns/rows)
pub fn get_fill_hash_coords(col: i64, row: i64) -> (i64, i64) {
    // Adjust for 1-indexed: col 1-15 → hash 0, col 16-30 → hash 1, etc.
    (
        (col - 1).div_euclid(HASH_WIDTH),
        (row - 1).div_euclid(HASH_HEIGHT),
    )
}

/// Get hash key from hash coordinates
pub fn fill_hash_key(hash_x: i64, hash_y: i64) -> u64 {
    // Combine hash coordinates into a single key
    // Using bit manipulation to support negative coordinates
    let x_bits = (hash_x as i32) as u32;
    let y_bits = (hash_y as i32) as u32;
    ((x_bits as u64) << 32) | (y_bits as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_fill_hash_coords() {
        // 1-indexed coordinates: cols 1-15 → hash 0, cols 16-30 → hash 1
        assert_eq!(get_fill_hash_coords(1, 1), (0, 0));
        assert_eq!(get_fill_hash_coords(15, 30), (0, 0));
        assert_eq!(get_fill_hash_coords(16, 31), (1, 1));
        assert_eq!(get_fill_hash_coords(31, 61), (2, 2));

        // Edge cases for 1-indexed
        assert_eq!(get_fill_hash_coords(0, 0), (-1, -1)); // col 0 is before col 1
        assert_eq!(get_fill_hash_coords(-14, -29), (-1, -1));
        assert_eq!(get_fill_hash_coords(-15, -30), (-2, -2));
    }

    #[test]
    fn test_fill_hash_key() {
        assert_eq!(fill_hash_key(0, 0), 0);
        assert_eq!(fill_hash_key(1, 0), 1 << 32);
        assert_eq!(fill_hash_key(0, 1), 1);
        assert_eq!(fill_hash_key(1, 1), (1 << 32) | 1);
    }
}
