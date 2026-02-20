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

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // TextCacheKey tests
    // =========================================================================

    #[test]
    fn test_text_cache_key_new() {
        let key = TextCacheKey::new(42, 12.5);
        assert_eq!(key.texture_uid, 42);
        assert_eq!(key.font_size_scaled, 1250); // 12.5 * 100
    }

    #[test]
    fn test_text_cache_key_font_size() {
        let key = TextCacheKey::new(1, 12.5);
        assert_eq!(key.font_size(), 12.5);

        let key2 = TextCacheKey::new(1, 10.0);
        assert_eq!(key2.font_size(), 10.0);

        let key3 = TextCacheKey::new(1, 0.0);
        assert_eq!(key3.font_size(), 0.0);
    }

    #[test]
    fn test_text_cache_key_equality() {
        let key1 = TextCacheKey::new(42, 12.5);
        let key2 = TextCacheKey::new(42, 12.5);
        let key3 = TextCacheKey::new(42, 10.0);
        let key4 = TextCacheKey::new(43, 12.5);

        assert_eq!(key1, key2);
        assert_ne!(key1, key3);
        assert_ne!(key1, key4);
    }

    #[test]
    fn test_text_cache_key_hash() {
        use std::collections::HashSet;

        let key1 = TextCacheKey::new(42, 12.5);
        let key2 = TextCacheKey::new(42, 12.5);
        let key3 = TextCacheKey::new(42, 10.0);

        let mut set = HashSet::new();
        set.insert(key1);
        set.insert(key2); // Should be same as key1
        set.insert(key3);

        assert_eq!(set.len(), 2); // key1 and key2 are the same
        assert!(set.contains(&TextCacheKey::new(42, 12.5)));
        assert!(set.contains(&TextCacheKey::new(42, 10.0)));
    }

    #[test]
    fn test_text_cache_key_font_size_rounding() {
        // Test that font size scaling handles precision correctly
        let key = TextCacheKey::new(1, 12.345);
        // Should round to nearest integer when scaling
        assert_eq!(key.font_size_scaled, 1234); // 12.345 * 100 = 1234.5 -> 1234
        assert!((key.font_size() - 12.34).abs() < 0.01); // Should be close to 12.34
    }

    // =========================================================================
    // TextCacheEntry tests
    // =========================================================================

    #[test]
    fn test_text_cache_entry_new() {
        let entry = TextCacheEntry::new();
        assert!(entry.is_empty());
        assert_eq!(entry.vertices.len(), 0);
        assert_eq!(entry.indices.len(), 0);
        assert_eq!(entry.vertex_offset, 0);
    }

    #[test]
    fn test_text_cache_entry_default() {
        let entry = TextCacheEntry::default();
        assert!(entry.is_empty());
        assert_eq!(entry.vertex_offset, 0);
    }

    #[test]
    fn test_text_cache_entry_is_empty() {
        let mut entry = TextCacheEntry::new();
        assert!(entry.is_empty());

        entry.vertices.push(1.0);
        assert!(!entry.is_empty());

        entry.vertices.clear();
        assert!(entry.is_empty());
    }

    #[test]
    fn test_text_cache_entry_clear() {
        let mut entry = TextCacheEntry::new();
        entry.vertices = vec![1.0, 2.0, 3.0];
        entry.indices = vec![0, 1, 2];
        entry.vertex_offset = 3;

        entry.clear();

        assert!(entry.is_empty());
        assert_eq!(entry.vertices.len(), 0);
        assert_eq!(entry.indices.len(), 0);
        assert_eq!(entry.vertex_offset, 0);
    }

    #[test]
    fn test_text_cache_entry_add_mesh() {
        let mut entry = TextCacheEntry::new();

        // Add first mesh: 2 vertices (8 floats each = 16 floats), 3 indices
        let vertices1 = vec![
            0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, // vertex 0
            10.0, 10.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, // vertex 1
        ];
        let indices1 = vec![0, 1, 0];

        entry.add_mesh(&vertices1, &indices1);

        assert_eq!(entry.vertices.len(), 16);
        assert_eq!(entry.indices, vec![0, 1, 0]);
        assert_eq!(entry.vertex_offset, 2);

        // Add second mesh: should offset indices
        let vertices2 = vec![
            20.0, 20.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, // vertex 2
        ];
        let indices2 = vec![0];

        entry.add_mesh(&vertices2, &indices2);

        assert_eq!(entry.vertices.len(), 24); // 16 + 8
        assert_eq!(entry.indices, vec![0, 1, 0, 2]); // original + offset by 2
        assert_eq!(entry.vertex_offset, 3);
    }

    #[test]
    fn test_text_cache_entry_add_mesh_empty() {
        let mut entry = TextCacheEntry::new();
        entry.add_mesh(&[], &[]);

        assert_eq!(entry.vertices.len(), 0);
        assert_eq!(entry.indices.len(), 0);
        assert_eq!(entry.vertex_offset, 0);
    }

    #[test]
    fn test_text_cache_entry_add_mesh_multiple() {
        let mut entry = TextCacheEntry::new();

        // Add 3 meshes sequentially
        for i in 0..3 {
            let vertices = vec![i as f32, i as f32, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0];
            let indices = vec![0];
            entry.add_mesh(&vertices, &indices);
        }

        assert_eq!(entry.vertex_offset, 3);
        assert_eq!(entry.indices, vec![0, 1, 2]); // Each index offset by previous vertex_offset
        assert_eq!(entry.vertices.len(), 24); // 3 vertices * 8 floats
    }

    // =========================================================================
    // TextCache tests
    // =========================================================================

    #[test]
    fn test_new_text_cache() {
        let cache = new_text_cache();
        assert!(cache.is_empty());
    }

    #[test]
    fn test_text_cache_insert_and_get() {
        let mut cache = new_text_cache();
        let key = TextCacheKey::new(1, 12.0);
        let mut entry = TextCacheEntry::new();

        entry.vertices.push(1.0);
        cache.insert(key, entry);

        assert_eq!(cache.len(), 1);
        assert!(cache.contains_key(&TextCacheKey::new(1, 12.0)));
    }

    #[test]
    fn test_text_cache_multiple_keys() {
        let mut cache = new_text_cache();

        let key1 = TextCacheKey::new(1, 12.0);
        let key2 = TextCacheKey::new(1, 14.0);
        let key3 = TextCacheKey::new(2, 12.0);

        cache.insert(key1, TextCacheEntry::new());
        cache.insert(key2, TextCacheEntry::new());
        cache.insert(key3, TextCacheEntry::new());

        assert_eq!(cache.len(), 3);
        assert!(cache.contains_key(&key1));
        assert!(cache.contains_key(&key2));
        assert!(cache.contains_key(&key3));
    }
}
