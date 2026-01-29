//! TextHash - spatial hash for text layout
//!
//! Groups cells into HASH_WIDTH × HASH_HEIGHT regions for efficient layout and rendering.
//! This is the canonical implementation used by the layout worker to produce HashRenderData.

use std::collections::HashMap;

use quadratic_core::sheet_offsets::SheetOffsets;

use super::bitmap_font::BitmapFonts;
use super::cell_label::CellLabel;
use super::horizontal_line::HorizontalLine;
use crate::types::{FillBuffer, HashRenderData, TextBuffer};

/// Hash dimensions (matches client: CellsTypes.ts and core: renderer_constants.rs)
pub const HASH_WIDTH: i64 = 50;
pub const HASH_HEIGHT: i64 = 100;

/// A spatial hash containing text labels for a region
///
/// Stores CellLabels and produces HashRenderData when rebuilt.
pub struct TextHash {
    /// Hash coordinates (not pixel coordinates)
    pub hash_x: i64,
    pub hash_y: i64,

    /// Labels indexed by (col, row)
    labels: HashMap<(i64, i64), CellLabel>,

    /// World bounds (computed from offsets)
    pub world_x: f32,
    pub world_y: f32,
    pub world_width: f32,
    pub world_height: f32,

    /// Whether this hash needs rebuild
    dirty: bool,

    /// Auto-size caches
    columns_max_cache: HashMap<i64, f32>,
    rows_max_cache: HashMap<i64, f32>,

    /// Cached render data from last rebuild
    cached_render_data: Option<HashRenderData>,
}

impl TextHash {
    /// Create a new text hash for the given coordinates
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
            labels: HashMap::new(),
            world_x: x_start as f32,
            world_y: y_start as f32,
            world_width: (x_end + width_end - x_start) as f32,
            world_height: (y_end + height_end - y_start) as f32,
            dirty: true,
            columns_max_cache: HashMap::new(),
            rows_max_cache: HashMap::new(),
            cached_render_data: None,
        }
    }

    /// Add a label at the given cell position
    pub fn add_label(&mut self, col: i64, row: i64, label: CellLabel) {
        self.labels.insert((col, row), label);
        self.dirty = true;
    }

    /// Remove a label at the given cell position
    pub fn remove_label(&mut self, col: i64, row: i64) -> Option<CellLabel> {
        let result = self.labels.remove(&(col, row));
        if result.is_some() {
            self.dirty = true;
        }
        result
    }

    /// Get a label at the given cell position
    pub fn get_label(&self, col: i64, row: i64) -> Option<&CellLabel> {
        self.labels.get(&(col, row))
    }

    /// Get a mutable label at the given cell position
    pub fn get_label_mut(&mut self, col: i64, row: i64) -> Option<&mut CellLabel> {
        self.labels.get_mut(&(col, row))
    }

    /// Iterate over all labels
    pub fn labels_iter(&self) -> impl Iterator<Item = (&(i64, i64), &CellLabel)> {
        self.labels.iter()
    }

    /// Iterate over all labels mutably
    pub fn labels_iter_mut(&mut self) -> impl Iterator<Item = (&(i64, i64), &mut CellLabel)> {
        self.labels.iter_mut()
    }

    /// Check if this hash has any labels
    pub fn is_empty(&self) -> bool {
        self.labels.is_empty()
    }

    /// Get the number of labels in this hash
    pub fn label_count(&self) -> usize {
        self.labels.len()
    }

    /// Mark this hash as dirty (needs rebuild)
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Check if this hash is dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Clear the dirty flag without rebuilding
    pub fn clear_dirty(&mut self) {
        self.dirty = false;
    }

    /// Check if hash intersects viewport bounds
    pub fn intersects_viewport(&self, min_x: f32, max_x: f32, min_y: f32, max_y: f32) -> bool {
        let hash_right = self.world_x + self.world_width;
        let hash_bottom = self.world_y + self.world_height;

        !(hash_right < min_x || self.world_x > max_x || hash_bottom < min_y || self.world_y > max_y)
    }

    /// Rebuild all labels and generate render data
    ///
    /// This layouts all labels, collects their meshes, and produces HashRenderData
    /// that can be sent to the renderer. Returns a reference to the cached data.
    pub fn rebuild(&mut self, fonts: &BitmapFonts) -> &HashRenderData {
        // Clear auto-size caches
        self.columns_max_cache.clear();
        self.rows_max_cache.clear();

        // Layout all labels
        for label in self.labels.values_mut() {
            label.layout(fonts);
        }

        // Collect all text buffers and horizontal lines
        let mut all_buffers: Vec<TextBuffer> = Vec::new();
        let mut all_lines: Vec<HorizontalLine> = Vec::new();

        for label in self.labels.values_mut() {
            // Collect text buffers (requires mutable access to build meshes)
            all_buffers.extend(label.get_text_buffers(fonts));

            // Collect horizontal lines
            all_lines.extend(label.get_horizontal_lines(fonts).iter().cloned());

            // Update auto-size caches
            let col = label.col();
            let row = label.row();
            let width = label.unwrapped_text_width();
            let height = label.text_height_with_descenders();

            let max_width = self.columns_max_cache.entry(col).or_insert(0.0);
            if width > *max_width {
                *max_width = width;
            }

            let max_height = self.rows_max_cache.entry(row).or_insert(0.0);
            if height > *max_height {
                *max_height = height;
            }
        }

        // Merge text buffers by (texture_uid, font_size)
        let text_buffers = merge_text_buffers(all_buffers);

        // Convert horizontal lines to fill buffer
        let horizontal_lines = if all_lines.is_empty() {
            None
        } else {
            let mut buffer = FillBuffer::new();
            for line in &all_lines {
                buffer.add_rect(line.x, line.y, line.width, line.height, line.color);
            }
            Some(buffer)
        };

        self.dirty = false;

        // Cache the render data and return a reference to avoid cloning
        self.cached_render_data.insert(HashRenderData {
            hash_x: self.hash_x,
            hash_y: self.hash_y,
            world_x: self.world_x,
            world_y: self.world_y,
            world_width: self.world_width,
            world_height: self.world_height,
            text_buffers,
            fills: None, // Fills handled separately
            horizontal_lines,
            emoji_sprites: HashMap::new(), // TODO: emoji support
            sprite_dirty: true,
        })
    }

    /// Get cached render data without rebuilding
    pub fn get_cached_render_data(&self) -> Option<&HashRenderData> {
        self.cached_render_data.as_ref()
    }

    /// Get cached render data, cloned
    pub fn clone_cached_render_data(&self) -> Option<HashRenderData> {
        self.cached_render_data.clone()
    }

    /// Get column max width (for auto-size)
    pub fn get_column_max_width(&self, column: i64) -> f32 {
        self.columns_max_cache.get(&column).copied().unwrap_or(0.0)
    }

    /// Get row max height (for auto-size)
    pub fn get_row_max_height(&self, row: i64) -> f32 {
        self.rows_max_cache.get(&row).copied().unwrap_or(0.0)
    }

    /// Get all column max widths
    pub fn get_all_column_max_widths(&self) -> &HashMap<i64, f32> {
        &self.columns_max_cache
    }

    /// Get all row max heights
    pub fn get_all_row_max_heights(&self) -> &HashMap<i64, f32> {
        &self.rows_max_cache
    }

    /// Clear all labels
    pub fn clear(&mut self) {
        self.labels.clear();
        self.columns_max_cache.clear();
        self.rows_max_cache.clear();
        self.cached_render_data = None;
        self.dirty = true;
    }

    /// Update bounds when offsets change
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        // Calculate the cell range for this hash (1-indexed)
        let start_col = self.hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH - 1;
        let start_row = self.hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT - 1;

        // Get world bounds from offsets
        let (x_start, _) = offsets.column_position_size(start_col);
        let (x_end, width_end) = offsets.column_position_size(end_col);
        let (y_start, _) = offsets.row_position_size(start_row);
        let (y_end, height_end) = offsets.row_position_size(end_row);

        self.world_x = x_start as f32;
        self.world_y = y_start as f32;
        self.world_width = (x_end + width_end - x_start) as f32;
        self.world_height = (y_end + height_end - y_start) as f32;
    }

    /// Get cached text buffers for rendering
    pub fn cached_text_buffers(&self) -> &[TextBuffer] {
        self.cached_render_data
            .as_ref()
            .map(|data| data.text_buffers.as_slice())
            .unwrap_or(&[])
    }

    /// Get cached horizontal lines buffer for rendering
    pub fn cached_horizontal_lines_buffer(&self) -> Option<&FillBuffer> {
        self.cached_render_data
            .as_ref()
            .and_then(|data| data.horizontal_lines.as_ref())
    }
}

/// Merge multiple TextBuffers with same (texture_uid, font_size)
fn merge_text_buffers(buffers: Vec<TextBuffer>) -> Vec<TextBuffer> {
    let mut merged: HashMap<(u32, u32), TextBuffer> = HashMap::new();

    for buf in buffers {
        let key = (buf.texture_uid, (buf.font_size * 100.0) as u32);

        if let Some(existing) = merged.get_mut(&key) {
            // Merge vertices and indices
            let vertex_offset = (existing.vertices.len() / 8) as u32;
            existing.vertices.extend(&buf.vertices);
            for idx in &buf.indices {
                existing.indices.push(idx + vertex_offset);
            }
        } else {
            merged.insert(key, buf);
        }
    }

    merged.into_values().collect()
}

/// Compute hash coordinates for a cell position
#[inline]
pub fn hash_coords(col: i64, row: i64) -> (i64, i64) {
    let hash_x = (col - 1).div_euclid(HASH_WIDTH);
    let hash_y = (row - 1).div_euclid(HASH_HEIGHT);
    (hash_x, hash_y)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_coords() {
        // First cell (1, 1) is in hash (0, 0)
        assert_eq!(hash_coords(1, 1), (0, 0));

        // Cell at HASH_WIDTH is still in hash (0, 0)
        assert_eq!(hash_coords(HASH_WIDTH, 1), (0, 0));

        // Cell at HASH_WIDTH + 1 is in hash (1, 0)
        assert_eq!(hash_coords(HASH_WIDTH + 1, 1), (1, 0));

        // Cell at HASH_HEIGHT is still in hash (0, 0)
        assert_eq!(hash_coords(1, HASH_HEIGHT), (0, 0));

        // Cell at HASH_HEIGHT + 1 is in hash (0, 1)
        assert_eq!(hash_coords(1, HASH_HEIGHT + 1), (0, 1));
    }
}
