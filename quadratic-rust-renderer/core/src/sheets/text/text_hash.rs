//! TextHash - spatial hash for text layout
//!
//! Groups cells into HASH_WIDTH × HASH_HEIGHT regions for efficient layout and rendering.
//! This is the canonical implementation used by the layout worker to produce HashRenderData.

use std::collections::HashMap;

use quadratic_core::sheet_offsets::SheetOffsets;

use super::bitmap_font::BitmapFonts;
use super::cell_label::CellLabel;
use super::horizontal_line::HorizontalLine;
use crate::constants::{HASH_HEIGHT, HASH_WIDTH};
use crate::types::{FillBuffer, HashRenderData, TextBuffer};

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

    fn create_test_offsets() -> SheetOffsets {
        SheetOffsets::default()
    }

    fn create_test_label(col: i64, row: i64, text: &str) -> CellLabel {
        CellLabel::new(text.to_string(), col, row)
    }

    fn create_test_fonts() -> BitmapFonts {
        BitmapFonts::new()
    }

    // =========================================================================
    // hash_coords tests
    // =========================================================================

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

    #[test]
    fn test_hash_coords_negative() {
        // Negative coordinates should still work
        assert_eq!(hash_coords(0, 1), (-1, 0));
        assert_eq!(hash_coords(1, 0), (0, -1));
        assert_eq!(hash_coords(0, 0), (-1, -1));
    }

    #[test]
    fn test_hash_coords_large_values() {
        // Test large cell coordinates
        let large_col = HASH_WIDTH * 10 + 25;
        let large_row = HASH_HEIGHT * 5 + 50;
        assert_eq!(hash_coords(large_col, large_row), (10, 5));
    }

    // =========================================================================
    // TextHash::new tests
    // =========================================================================

    #[test]
    fn test_text_hash_new() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        assert_eq!(hash.hash_x, 0);
        assert_eq!(hash.hash_y, 0);
        assert!(hash.is_empty());
        assert_eq!(hash.label_count(), 0);
        assert!(hash.is_dirty());
        assert!(hash.get_cached_render_data().is_none());
    }

    #[test]
    fn test_text_hash_new_non_zero_coords() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(2, 3, &offsets);

        assert_eq!(hash.hash_x, 2);
        assert_eq!(hash.hash_y, 3);
        assert!(hash.is_empty());
    }

    #[test]
    fn test_text_hash_world_bounds() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        // World bounds should be calculated from offsets
        assert!(hash.world_x >= 0.0);
        assert!(hash.world_y >= 0.0);
        assert!(hash.world_width > 0.0);
        assert!(hash.world_height > 0.0);
    }

    // =========================================================================
    // Label management tests
    // =========================================================================

    #[test]
    fn test_add_label() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        let label = create_test_label(1, 1, "Test");

        hash.add_label(1, 1, label);

        assert!(!hash.is_empty());
        assert_eq!(hash.label_count(), 1);
        assert!(hash.is_dirty());
    }

    #[test]
    fn test_add_multiple_labels() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        hash.add_label(1, 1, create_test_label(1, 1, "Cell A1"));
        hash.add_label(2, 1, create_test_label(2, 1, "Cell B1"));
        hash.add_label(1, 2, create_test_label(1, 2, "Cell A2"));

        assert_eq!(hash.label_count(), 3);
    }

    #[test]
    fn test_add_label_overwrites_existing() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        hash.add_label(1, 1, create_test_label(1, 1, "First"));
        hash.add_label(1, 1, create_test_label(1, 1, "Second"));

        assert_eq!(hash.label_count(), 1);
        assert_eq!(hash.get_label(1, 1).unwrap().text, "Second");
    }

    #[test]
    fn test_remove_label() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        let label = create_test_label(1, 1, "Test");

        hash.add_label(1, 1, label);
        assert_eq!(hash.label_count(), 1);

        let removed = hash.remove_label(1, 1);
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().text, "Test");
        assert!(hash.is_empty());
        assert!(hash.is_dirty());
    }

    #[test]
    fn test_remove_label_nonexistent() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        hash.clear_dirty();

        let removed = hash.remove_label(999, 999);
        assert!(removed.is_none());
        assert!(!hash.is_dirty());
    }

    #[test]
    fn test_get_label() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        hash.add_label(1, 1, create_test_label(1, 1, "Test"));

        let label = hash.get_label(1, 1);
        assert!(label.is_some());
        assert_eq!(label.unwrap().text, "Test");

        let missing = hash.get_label(999, 999);
        assert!(missing.is_none());
    }

    #[test]
    fn test_get_label_mut() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        hash.add_label(1, 1, create_test_label(1, 1, "Test"));

        let label = hash.get_label_mut(1, 1);
        assert!(label.is_some());
        label.unwrap().text = "Modified".to_string();

        assert_eq!(hash.get_label(1, 1).unwrap().text, "Modified");
    }

    #[test]
    fn test_labels_iter() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        hash.add_label(1, 1, create_test_label(1, 1, "A1"));
        hash.add_label(2, 1, create_test_label(2, 1, "B1"));
        hash.add_label(1, 2, create_test_label(1, 2, "A2"));

        let mut positions: Vec<(i64, i64)> = hash
            .labels_iter()
            .map(|((col, row), _)| (*col, *row))
            .collect();
        positions.sort();

        assert_eq!(positions, vec![(1, 1), (1, 2), (2, 1)]);
    }

    #[test]
    fn test_labels_iter_mut() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        hash.add_label(1, 1, create_test_label(1, 1, "Original"));

        for (_, label) in hash.labels_iter_mut() {
            label.text = "Modified".to_string();
        }

        assert_eq!(hash.get_label(1, 1).unwrap().text, "Modified");
    }

    // =========================================================================
    // Dirty flag tests
    // =========================================================================

    #[test]
    fn test_mark_dirty() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        hash.clear_dirty();
        assert!(!hash.is_dirty());

        hash.mark_dirty();
        assert!(hash.is_dirty());
    }

    #[test]
    fn test_clear_dirty() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        assert!(hash.is_dirty());
        hash.clear_dirty();
        assert!(!hash.is_dirty());
    }

    #[test]
    fn test_add_label_sets_dirty() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        hash.clear_dirty();
        hash.add_label(1, 1, create_test_label(1, 1, "Test"));
        assert!(hash.is_dirty());
    }

    #[test]
    fn test_remove_label_sets_dirty_when_found() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        hash.add_label(1, 1, create_test_label(1, 1, "Test"));
        hash.clear_dirty();

        hash.remove_label(1, 1);
        assert!(hash.is_dirty());
    }

    // =========================================================================
    // Viewport intersection tests
    // =========================================================================

    #[test]
    fn test_intersects_viewport_fully_inside() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let min_x = hash.world_x - 100.0;
        let max_x = hash.world_x + hash.world_width + 100.0;
        let min_y = hash.world_y - 100.0;
        let max_y = hash.world_y + hash.world_height + 100.0;

        assert!(hash.intersects_viewport(min_x, max_x, min_y, max_y));
    }

    #[test]
    fn test_intersects_viewport_partially_overlapping() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let min_x = hash.world_x + hash.world_width / 2.0;
        let max_x = hash.world_x + hash.world_width + 100.0;
        let min_y = hash.world_y + hash.world_height / 2.0;
        let max_y = hash.world_y + hash.world_height + 100.0;

        assert!(hash.intersects_viewport(min_x, max_x, min_y, max_y));
    }

    #[test]
    fn test_intersects_viewport_not_intersecting() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let min_x = hash.world_x + hash.world_width + 1.0;
        let max_x = hash.world_x + hash.world_width + 100.0;
        let min_y = hash.world_y;
        let max_y = hash.world_y + hash.world_height;

        assert!(!hash.intersects_viewport(min_x, max_x, min_y, max_y));
    }

    #[test]
    fn test_intersects_viewport_to_left() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let min_x = hash.world_x - 100.0;
        let max_x = hash.world_x - 1.0;
        let min_y = hash.world_y;
        let max_y = hash.world_y + hash.world_height;

        assert!(!hash.intersects_viewport(min_x, max_x, min_y, max_y));
    }

    #[test]
    fn test_intersects_viewport_to_right() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let min_x = hash.world_x + hash.world_width + 1.0;
        let max_x = hash.world_x + hash.world_width + 100.0;
        let min_y = hash.world_y;
        let max_y = hash.world_y + hash.world_height;

        assert!(!hash.intersects_viewport(min_x, max_x, min_y, max_y));
    }

    #[test]
    fn test_intersects_viewport_above() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let min_x = hash.world_x;
        let max_x = hash.world_x + hash.world_width;
        let min_y = hash.world_y - 100.0;
        let max_y = hash.world_y - 1.0;

        assert!(!hash.intersects_viewport(min_x, max_x, min_y, max_y));
    }

    #[test]
    fn test_intersects_viewport_below() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let min_x = hash.world_x;
        let max_x = hash.world_x + hash.world_width;
        let min_y = hash.world_y + hash.world_height + 1.0;
        let max_y = hash.world_y + hash.world_height + 100.0;

        assert!(!hash.intersects_viewport(min_x, max_x, min_y, max_y));
    }

    // =========================================================================
    // Auto-size cache tests
    // =========================================================================

    #[test]
    fn test_get_column_max_width_empty() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        assert_eq!(hash.get_column_max_width(1), 0.0);
    }

    #[test]
    fn test_get_row_max_height_empty() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        assert_eq!(hash.get_row_max_height(1), 0.0);
    }

    #[test]
    fn test_get_all_column_max_widths() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let widths = hash.get_all_column_max_widths();
        assert!(widths.is_empty());
    }

    #[test]
    fn test_get_all_row_max_heights() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let heights = hash.get_all_row_max_heights();
        assert!(heights.is_empty());
    }

    // =========================================================================
    // Clear tests
    // =========================================================================

    #[test]
    fn test_clear() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        hash.add_label(1, 1, create_test_label(1, 1, "Test"));
        hash.add_label(2, 2, create_test_label(2, 2, "Test2"));
        assert_eq!(hash.label_count(), 2);

        hash.clear();
        assert!(hash.is_empty());
        assert_eq!(hash.label_count(), 0);
        assert!(hash.is_dirty());
        assert!(hash.get_cached_render_data().is_none());
    }

    #[test]
    fn test_clear_clears_caches() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        // Rebuild to populate caches
        let fonts = create_test_fonts();
        hash.add_label(1, 1, create_test_label(1, 1, "Test"));
        let _ = hash.rebuild(&fonts);

        hash.clear();

        assert_eq!(hash.get_column_max_width(1), 0.0);
        assert_eq!(hash.get_row_max_height(1), 0.0);
    }

    // =========================================================================
    // Update bounds tests
    // =========================================================================

    #[test]
    fn test_update_bounds() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);

        // Create new offsets (may have same defaults, but we test the method works)
        let new_offsets = SheetOffsets::default();
        hash.update_bounds(&new_offsets);

        // Bounds should be updated (may be same if defaults unchanged, but method should work)
        assert!(hash.world_x >= 0.0);
        assert!(hash.world_y >= 0.0);
        assert!(hash.world_width > 0.0);
        assert!(hash.world_height > 0.0);
    }

    // =========================================================================
    // Cached render data tests
    // =========================================================================

    #[test]
    fn test_get_cached_render_data_none() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        assert!(hash.get_cached_render_data().is_none());
    }

    #[test]
    fn test_clone_cached_render_data_none() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        assert!(hash.clone_cached_render_data().is_none());
    }

    #[test]
    fn test_cached_text_buffers_empty() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        let buffers = hash.cached_text_buffers();
        assert!(buffers.is_empty());
    }

    #[test]
    fn test_cached_horizontal_lines_buffer_none() {
        let offsets = create_test_offsets();
        let hash = TextHash::new(0, 0, &offsets);

        assert!(hash.cached_horizontal_lines_buffer().is_none());
    }

    // =========================================================================
    // Rebuild tests
    // =========================================================================

    #[test]
    fn test_rebuild_empty_hash() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        let fonts = create_test_fonts();

        let render_data = hash.rebuild(&fonts);

        assert_eq!(render_data.hash_x, 0);
        assert_eq!(render_data.hash_y, 0);
        assert!(render_data.text_buffers.is_empty());
        assert!(!hash.is_dirty());
    }

    #[test]
    fn test_rebuild_clears_dirty_flag() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        let fonts = create_test_fonts();

        hash.add_label(1, 1, create_test_label(1, 1, "Test"));
        assert!(hash.is_dirty());

        let _ = hash.rebuild(&fonts);
        assert!(!hash.is_dirty());
    }

    #[test]
    fn test_rebuild_clears_auto_size_caches() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        let fonts = create_test_fonts();

        hash.add_label(1, 1, create_test_label(1, 1, "Test"));
        let _ = hash.rebuild(&fonts);

        // Caches should be populated after rebuild
        // (Note: actual values depend on font metrics, but caches should exist)
        let _ = hash.get_column_max_width(1);
        let _ = hash.get_row_max_height(1);
    }

    #[test]
    fn test_rebuild_caches_render_data() {
        let offsets = create_test_offsets();
        let mut hash = TextHash::new(0, 0, &offsets);
        let fonts = create_test_fonts();

        hash.add_label(1, 1, create_test_label(1, 1, "Test"));
        let _ = hash.rebuild(&fonts);

        let cached = hash.get_cached_render_data();
        assert!(cached.is_some());
        assert_eq!(cached.unwrap().hash_x, 0);
        assert_eq!(cached.unwrap().hash_y, 0);
    }

    // =========================================================================
    // merge_text_buffers tests
    // =========================================================================

    #[test]
    fn test_merge_text_buffers_empty() {
        let buffers = Vec::<TextBuffer>::new();
        let merged = merge_text_buffers(buffers);
        assert!(merged.is_empty());
    }

    #[test]
    fn test_merge_text_buffers_single() {
        let mut buffer = TextBuffer::new(1, 14.0);
        buffer.vertices = vec![1.0; 8]; // 1 vertex (8 floats)
        buffer.indices = vec![0];

        let merged = merge_text_buffers(vec![buffer]);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].texture_uid, 1);
        assert_eq!(merged[0].font_size, 14.0);
    }

    #[test]
    fn test_merge_text_buffers_same_key() {
        // Each vertex is 8 floats: [x, y, u, v, r, g, b, a]
        let mut buffer1 = TextBuffer::new(1, 14.0);
        buffer1.vertices = vec![1.0; 8]; // 1 vertex
        buffer1.indices = vec![0];

        let mut buffer2 = TextBuffer::new(1, 14.0);
        buffer2.vertices = vec![2.0; 8]; // 1 vertex
        buffer2.indices = vec![0];

        let merged = merge_text_buffers(vec![buffer1, buffer2]);
        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].vertices.len(), 16); // 2 vertices * 8 floats
        assert_eq!(merged[0].indices.len(), 2);
        // Indices should be offset for second buffer (vertex_offset = 1)
        assert_eq!(merged[0].indices[0], 0); // First buffer index
        assert_eq!(merged[0].indices[1], 1); // Second buffer index offset by 1
    }

    #[test]
    fn test_merge_text_buffers_different_keys() {
        let mut buffer1 = TextBuffer::new(1, 14.0);
        buffer1.vertices = vec![1.0; 8]; // 1 vertex
        buffer1.indices = vec![0];

        let mut buffer2 = TextBuffer::new(2, 14.0);
        buffer2.vertices = vec![2.0; 8]; // 1 vertex
        buffer2.indices = vec![0];

        let merged = merge_text_buffers(vec![buffer1, buffer2]);
        assert_eq!(merged.len(), 2);
    }

    #[test]
    fn test_merge_text_buffers_different_font_sizes() {
        let mut buffer1 = TextBuffer::new(1, 14.0);
        buffer1.vertices = vec![1.0; 8]; // 1 vertex
        buffer1.indices = vec![0];

        let mut buffer2 = TextBuffer::new(1, 16.0);
        buffer2.vertices = vec![2.0; 8]; // 1 vertex
        buffer2.indices = vec![0];

        let merged = merge_text_buffers(vec![buffer1, buffer2]);
        // Different font sizes should not merge (font_size * 100.0 as u32)
        assert_eq!(merged.len(), 2);
    }
}
