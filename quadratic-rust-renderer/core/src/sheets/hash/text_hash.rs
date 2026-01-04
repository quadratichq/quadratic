//! TextHash - spatial hash for text rendering
//!
//! Groups cells into regions for efficient visibility culling and caching.

use std::collections::HashMap;

use quadratic_core_shared::SheetOffsets;

use super::constants::{HASH_HEIGHT, HASH_WIDTH};
use crate::sheets::text::{
    BitmapFonts, EmojiSpriteCache, HorizontalLine, TextCache, TextCacheKey,
};

/// A spatial hash containing text labels for a cell region
///
/// Each TextHash covers HASH_WIDTH × HASH_HEIGHT cells and maintains:
/// - Labels indexed by (col, row)
/// - Cached mesh data for efficient rendering
/// - World bounds for visibility culling
pub struct TextHash {
    /// Hash coordinates (not pixel coordinates)
    pub hash_x: i64,
    pub hash_y: i64,

    /// Labels indexed by (col, row) within this hash
    labels: HashMap<(i64, i64), CellLabelData>,

    /// Whether this hash needs to rebuild its mesh cache
    dirty: bool,

    /// Whether the sprite cache needs regeneration
    sprite_dirty: bool,

    /// Cached text data per (texture_uid, font_size) combination
    cached_text: TextCache,

    /// Cached horizontal lines (underline/strikethrough)
    cached_lines: Vec<HorizontalLine>,

    /// Cached emoji sprites grouped by texture ID
    cached_emojis: EmojiSpriteCache,

    /// Bounds in world coordinates (for visibility culling)
    pub world_x: f32,
    pub world_y: f32,
    pub world_width: f32,
    pub world_height: f32,

    /// Auto-size caches
    columns_max_width: HashMap<i64, f32>,
    rows_max_height: HashMap<i64, f32>,
}

/// Minimal label data stored in the hash
///
/// This is a simplified version - the full CellLabel with mesh generation
/// can be in a separate module.
#[derive(Debug, Clone)]
pub struct CellLabelData {
    /// Column position
    pub col: i64,
    /// Row position
    pub row: i64,
    /// Text content
    pub text: String,
    /// X position in world coordinates
    pub x: f32,
    /// Y position in world coordinates
    pub y: f32,
    /// Width in world coordinates
    pub width: f32,
    /// Height in world coordinates
    pub height: f32,
    /// Unwrapped text width (for auto-size)
    pub unwrapped_width: f32,
    /// Text height with descenders (for auto-size)
    pub text_height: f32,
    /// Left edge of text (for overflow detection)
    pub text_left: f32,
    /// Right edge of text (for overflow detection)
    pub text_right: f32,
    /// Whether text is bold
    pub bold: bool,
    /// Whether text is italic
    pub italic: bool,
    /// Font size
    pub font_size: f32,
    /// Text color [r, g, b, a]
    pub color: [f32; 4],
    /// Cached mesh vertices (generated during rebuild)
    pub mesh_vertices: Vec<f32>,
    /// Cached mesh indices
    pub mesh_indices: Vec<u16>,
    /// Texture UID for the mesh
    pub texture_uid: u32,
    /// Horizontal lines (underline/strikethrough)
    pub horizontal_lines: Vec<HorizontalLine>,
}

impl TextHash {
    /// Create a new hash for the given hash coordinates
    pub fn new(hash_x: i64, hash_y: i64, offsets: &SheetOffsets) -> Self {
        let (world_x, world_y, world_width, world_height) =
            Self::calculate_bounds(hash_x, hash_y, offsets);

        Self {
            hash_x,
            hash_y,
            labels: HashMap::new(),
            dirty: true,
            sprite_dirty: true,
            cached_text: HashMap::new(),
            cached_lines: Vec::new(),
            cached_emojis: HashMap::new(),
            world_x,
            world_y,
            world_width,
            world_height,
            columns_max_width: HashMap::new(),
            rows_max_height: HashMap::new(),
        }
    }

    /// Calculate world bounds for a hash
    fn calculate_bounds(
        hash_x: i64,
        hash_y: i64,
        offsets: &SheetOffsets,
    ) -> (f32, f32, f32, f32) {
        let start_col = hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH - 1;
        let start_row = hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT - 1;

        let (x_start, _) = offsets.column_position_size(start_col);
        let (x_end, width_end) = offsets.column_position_size(end_col);
        let (y_start, _) = offsets.row_position_size(start_row);
        let (y_end, height_end) = offsets.row_position_size(end_row);

        let world_x = x_start as f32;
        let world_y = y_start as f32;
        let world_width = (x_end + width_end - x_start) as f32;
        let world_height = (y_end + height_end - y_start) as f32;

        (world_x, world_y, world_width, world_height)
    }

    /// Update world bounds from sheet offsets (call when offsets change)
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        let (x, y, w, h) = Self::calculate_bounds(self.hash_x, self.hash_y, offsets);
        self.world_x = x;
        self.world_y = y;
        self.world_width = w;
        self.world_height = h;
        self.sprite_dirty = true;
    }

    // ========================================================================
    // Label Management
    // ========================================================================

    /// Add or update a label
    pub fn add_label(&mut self, label: CellLabelData) {
        self.labels.insert((label.col, label.row), label);
        self.dirty = true;
        self.sprite_dirty = true;
    }

    /// Remove a label
    pub fn remove_label(&mut self, col: i64, row: i64) -> Option<CellLabelData> {
        let result = self.labels.remove(&(col, row));
        if result.is_some() {
            self.dirty = true;
            self.sprite_dirty = true;
        }
        result
    }

    /// Get a label
    pub fn get_label(&self, col: i64, row: i64) -> Option<&CellLabelData> {
        self.labels.get(&(col, row))
    }

    /// Get a mutable label
    pub fn get_label_mut(&mut self, col: i64, row: i64) -> Option<&mut CellLabelData> {
        self.labels.get_mut(&(col, row))
    }

    /// Iterate over all labels
    pub fn labels(&self) -> impl Iterator<Item = &CellLabelData> {
        self.labels.values()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.labels.is_empty()
    }

    /// Get label count
    pub fn label_count(&self) -> usize {
        self.labels.len()
    }

    // ========================================================================
    // Dirty State
    // ========================================================================

    /// Mark as dirty
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
        self.sprite_dirty = true;
    }

    /// Check if dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Check if sprite cache is dirty
    pub fn is_sprite_dirty(&self) -> bool {
        self.sprite_dirty
    }

    /// Clear sprite dirty flag
    pub fn clear_sprite_dirty(&mut self) {
        self.sprite_dirty = false;
    }

    // ========================================================================
    // Visibility
    // ========================================================================

    /// Check if this hash intersects the given viewport bounds
    pub fn intersects_viewport(&self, min_x: f32, max_x: f32, min_y: f32, max_y: f32) -> bool {
        let hash_right = self.world_x + self.world_width;
        let hash_bottom = self.world_y + self.world_height;

        !(hash_right < min_x || self.world_x > max_x || hash_bottom < min_y || self.world_y > max_y)
    }

    // ========================================================================
    // Overflow Detection
    // ========================================================================

    /// Check if any labels overflow to the right
    pub fn has_overflow_right(&self) -> bool {
        let hash_right = self.world_x + self.world_width;
        self.labels.values().any(|label| label.text_right > hash_right)
    }

    /// Check if any labels overflow to the left
    pub fn has_overflow_left(&self) -> bool {
        self.labels.values().any(|label| label.text_left < self.world_x)
    }

    // ========================================================================
    // Cache Rebuild
    // ========================================================================

    /// Rebuild cached mesh data if dirty
    pub fn rebuild_if_dirty(&mut self, _fonts: &BitmapFonts) {
        if !self.dirty {
            return;
        }

        // Clear caches
        self.cached_text.clear();
        self.cached_lines.clear();
        self.cached_emojis.clear();
        self.columns_max_width.clear();
        self.rows_max_height.clear();

        // Collect data from all labels
        for label in self.labels.values() {
            // Update auto-size caches
            let col_max = self.columns_max_width.entry(label.col).or_insert(0.0);
            if label.unwrapped_width > *col_max {
                *col_max = label.unwrapped_width;
            }

            let row_max = self.rows_max_height.entry(label.row).or_insert(0.0);
            if label.text_height > *row_max {
                *row_max = label.text_height;
            }

            // Add to text cache
            if !label.mesh_vertices.is_empty() {
                let cache_key = TextCacheKey::new(label.texture_uid, label.font_size);
                let entry = self.cached_text.entry(cache_key).or_default();
                entry.add_mesh(&label.mesh_vertices, &label.mesh_indices);
            }

            // Add horizontal lines
            self.cached_lines.extend(label.horizontal_lines.iter().cloned());
        }

        self.dirty = false;
        self.sprite_dirty = true;
    }

    // ========================================================================
    // Cache Access
    // ========================================================================

    /// Get cached text data
    pub fn cached_text(&self) -> &TextCache {
        &self.cached_text
    }

    /// Get cached horizontal lines
    pub fn cached_lines(&self) -> &[HorizontalLine] {
        &self.cached_lines
    }

    /// Get cached emoji sprites
    pub fn cached_emojis(&self) -> &EmojiSpriteCache {
        &self.cached_emojis
    }

    /// Get max content width for a column
    pub fn column_max_width(&self, col: i64) -> f32 {
        self.columns_max_width.get(&col).copied().unwrap_or(0.0)
    }

    /// Get max content height for a row
    pub fn row_max_height(&self, row: i64) -> f32 {
        self.rows_max_height.get(&row).copied().unwrap_or(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intersects_viewport() {
        let offsets = SheetOffsets::default();
        let hash = TextHash::new(0, 0, &offsets);

        // Hash at (0,0) with default offsets covers a large area
        assert!(hash.intersects_viewport(0.0, 100.0, 0.0, 100.0));
        assert!(hash.intersects_viewport(-100.0, 100.0, -100.0, 100.0));
    }
}
