//! CellsTextHash - spatial hash for text layout

use std::collections::HashMap;

use quadratic_core_shared::SheetOffsets;
use quadratic_rust_renderer_shared::{FillBuffer, HashRenderData, TextBuffer, HASH_HEIGHT, HASH_WIDTH};

use super::{BitmapFonts, CellLabel, HorizontalLine};

/// A spatial hash containing text labels for a hash region
pub struct CellsTextHash {
    /// Hash coordinates
    pub hash_x: i64,
    pub hash_y: i64,

    /// Labels indexed by (col, row)
    labels: HashMap<(i64, i64), CellLabel>,

    /// World bounds
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

impl CellsTextHash {
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

    /// Add a label
    pub fn add_label(&mut self, col: i64, row: i64, label: CellLabel) {
        self.labels.insert((col, row), label);
        self.dirty = true;
    }

    /// Get a label
    pub fn get_label(&self, col: i64, row: i64) -> Option<&CellLabel> {
        self.labels.get(&(col, row))
    }

    /// Get a label mutably
    pub fn get_label_mut(&mut self, col: i64, row: i64) -> Option<&mut CellLabel> {
        self.labels.get_mut(&(col, row))
    }

    /// Iterate over all labels
    pub fn labels_iter(&self) -> impl Iterator<Item = (&(i64, i64), &CellLabel)> {
        self.labels.iter()
    }

    pub fn is_empty(&self) -> bool {
        self.labels.is_empty()
    }

    pub fn label_count(&self) -> usize {
        self.labels.len()
    }

    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Check if hash intersects viewport bounds
    pub fn intersects_viewport(&self, min_x: f32, max_x: f32, min_y: f32, max_y: f32) -> bool {
        let hash_right = self.world_x + self.world_width;
        let hash_bottom = self.world_y + self.world_height;

        !(hash_right < min_x || self.world_x > max_x || hash_bottom < min_y || self.world_y > max_y)
    }

    /// Rebuild all labels and generate render data
    pub fn rebuild(&mut self, fonts: &BitmapFonts) -> HashRenderData {
        // Clear auto-size caches
        self.columns_max_cache.clear();
        self.rows_max_cache.clear();

        // Layout all labels
        for label in self.labels.values_mut() {
            label.layout(fonts);
        }

        // Collect all text buffers
        let mut all_buffers: Vec<TextBuffer> = Vec::new();
        let mut all_lines: Vec<HorizontalLine> = Vec::new();

        for label in self.labels.values() {
            // Collect text buffers
            all_buffers.extend(label.get_text_buffers());

            // Collect horizontal lines
            all_lines.extend(label.get_horizontal_lines().iter().cloned());

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

        let render_data = HashRenderData {
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
        };

        // Cache the render data for subsequent frames
        self.cached_render_data = Some(render_data.clone());

        render_data
    }

    /// Get cached render data without rebuilding.
    /// Returns None if no cached data exists.
    pub fn get_cached_render_data(&self) -> Option<HashRenderData> {
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
