//! Text mesh caching structures
//!
//! Cached vertex/index data for efficient text rendering.

use std::collections::HashMap;

/// Key for grouping cached text data by (texture_uid, font_size)
///
/// Font size is stored as integer (multiplied by 100) for hash equality.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TextCacheKey {
    /// Texture atlas page ID
    pub texture_uid: u32,
    /// Font size × 100 (for hash comparison without float issues)
    pub font_size_scaled: u32,
}

impl TextCacheKey {
    /// Create a new cache key
    pub fn new(texture_uid: u32, font_size: f32) -> Self {
        Self {
            texture_uid,
            font_size_scaled: (font_size * 100.0) as u32,
        }
    }

    /// Get the font size as a float
    pub fn font_size(&self) -> f32 {
        self.font_size_scaled as f32 / 100.0
    }
}

/// Cached vertex/index data for a specific (texture_uid, font_size) combination
#[derive(Debug, Clone, Default)]
pub struct TextCacheEntry {
    /// Vertex data: [x, y, u, v, r, g, b, a] per vertex
    pub vertices: Vec<f32>,
    /// Index data for indexed drawing
    pub indices: Vec<u32>,
    /// Current vertex offset (for building indices)
    pub vertex_offset: u32,
}

impl TextCacheEntry {
    /// Create a new empty cache entry
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if this entry is empty
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Clear the cache entry
    pub fn clear(&mut self) {
        self.vertices.clear();
        self.indices.clear();
        self.vertex_offset = 0;
    }

    /// Add vertices and indices from a mesh
    ///
    /// # Arguments
    /// * `mesh_vertices` - Vertex data [x, y, u, v, r, g, b, a, ...]
    /// * `mesh_indices` - Index data (will be offset by current vertex_offset)
    pub fn add_mesh(&mut self, mesh_vertices: &[f32], mesh_indices: &[u16]) {
        let offset = self.vertex_offset;

        // Add vertices
        self.vertices.extend_from_slice(mesh_vertices);

        // Add indices with offset
        for &i in mesh_indices {
            self.indices.push(i as u32 + offset);
        }

        // Update offset (8 floats per vertex)
        self.vertex_offset += (mesh_vertices.len() / 8) as u32;
    }
}

/// Collection of text cache entries by key
pub type TextCache = HashMap<TextCacheKey, TextCacheEntry>;

/// Create a new empty text cache
pub fn new_text_cache() -> TextCache {
    HashMap::new()
}
