//! Batch receiver - processes RenderBatch from the Layout Worker
//!
//! This module handles receiving pre-computed render batches and maintaining
//! a persistent cache of hash render data for rendering.

use std::collections::HashMap;

use quadratic_renderer_core::{
    CursorRenderData, FillBuffer, HashRenderData, LineBuffer, RenderBatch, TextBuffer,
};

/// Decode a bincode-encoded RenderBatch from the Layout Worker
pub fn decode_render_batch(data: &[u8]) -> Result<RenderBatch, String> {
    let (batch, _): (RenderBatch, _) =
        bincode::decode_from_slice(data, bincode::config::standard())
            .map_err(|e| format!("Failed to decode RenderBatch: {}", e))?;
    Ok(batch)
}

/// Persistent cache for hash render data from the Layout Worker.
///
/// The layout worker sends incremental updates (only dirty hashes),
/// and this cache accumulates them for rendering.
#[derive(Default)]
pub struct BatchCache {
    /// Cached hash render data, indexed by (hash_x, hash_y)
    hashes: HashMap<(i64, i64), HashRenderData>,

    /// Cached grid lines (updated when layout sends new ones)
    grid_lines: Option<LineBuffer>,

    /// Cached cursor data (updated when layout sends new one)
    cursor: Option<CursorRenderData>,

    /// Viewport info from last batch
    viewport_scale: f32,
    viewport_x: f32,
    viewport_y: f32,
    viewport_width: f32,
    viewport_height: f32,

    /// Sequence number of last processed batch
    last_sequence: u64,

    /// Flag indicating new data has arrived since last render
    has_new_data: bool,

    /// Stats
    pub batches_received: u64,
    pub batches_rendered: u64,
}

impl BatchCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update with a new batch from layout worker.
    /// This merges the incoming hashes into the persistent cache.
    pub fn update(&mut self, batch: RenderBatch) {
        // Only accept newer batches
        if batch.sequence <= self.last_sequence {
            return;
        }

        self.last_sequence = batch.sequence;
        self.batches_received += 1;
        self.has_new_data = true;

        // Update viewport info
        self.viewport_scale = batch.viewport_scale;
        self.viewport_x = batch.viewport_x;
        self.viewport_y = batch.viewport_y;
        self.viewport_width = batch.viewport_width;
        self.viewport_height = batch.viewport_height;

        // Merge hashes into cache (update existing, add new)
        for hash_data in batch.hashes {
            let key = (hash_data.hash_x, hash_data.hash_y);
            self.hashes.insert(key, hash_data);
        }

        // Update grid lines if provided
        if let Some(lines) = batch.grid_lines {
            self.grid_lines = Some(lines);
        }

        // Update cursor if provided
        if let Some(cursor) = batch.cursor {
            self.cursor = Some(cursor);
        }

        log::debug!(
            "[BatchCache] Updated with batch #{}: {} total cached hashes",
            batch.sequence,
            self.hashes.len()
        );
    }

    /// Check if there's new data to render
    pub fn has_new_data(&self) -> bool {
        self.has_new_data
    }

    /// Mark that we've consumed the new data flag
    pub fn mark_rendered(&mut self) {
        if self.has_new_data {
            self.has_new_data = false;
            self.batches_rendered += 1;
        }
    }

    /// Get all cached hashes for rendering
    pub fn get_hashes(&self) -> impl Iterator<Item = &HashRenderData> {
        self.hashes.values()
    }

    /// Get all cached hashes as a slice for rendering
    pub fn get_hashes_vec(&self) -> Vec<&HashRenderData> {
        self.hashes.values().collect()
    }

    /// Get cached grid lines
    pub fn get_grid_lines(&self) -> Option<&LineBuffer> {
        self.grid_lines.as_ref()
    }

    /// Get cached cursor
    pub fn get_cursor(&self) -> Option<&CursorRenderData> {
        self.cursor.as_ref()
    }

    /// Check if cache has any hash data
    pub fn has_hashes(&self) -> bool {
        !self.hashes.is_empty()
    }

    /// Get hash count
    pub fn hash_count(&self) -> usize {
        self.hashes.len()
    }

    /// Clear hashes that are outside the given bounds
    /// (call this when viewport changes significantly)
    pub fn evict_distant_hashes(&mut self, min_hash_x: i64, max_hash_x: i64, min_hash_y: i64, max_hash_y: i64, margin: i64) {
        let expanded_min_x = min_hash_x - margin;
        let expanded_max_x = max_hash_x + margin;
        let expanded_min_y = min_hash_y - margin;
        let expanded_max_y = max_hash_y + margin;

        self.hashes.retain(|&(x, y), _| {
            x >= expanded_min_x && x <= expanded_max_x && y >= expanded_min_y && y <= expanded_max_y
        });
    }

    /// Clear all cached data (e.g., on sheet change)
    pub fn clear(&mut self) {
        self.hashes.clear();
        self.grid_lines = None;
        self.cursor = None;
        self.has_new_data = false;
    }

    // Legacy compatibility - these methods support the old batch-based rendering
    // TODO: Remove once rendering is fully updated to use the cache

    /// Take the current batch for rendering (legacy - returns None now)
    pub fn take(&mut self) -> Option<RenderBatch> {
        // No longer returns a batch - data is accessed via get_hashes() etc.
        None
    }

    /// Check if there's a new batch to render (legacy)
    pub fn has_batch(&self) -> bool {
        self.has_new_data
    }
}

/// Extract raw vertex data from a TextBuffer for GPU upload
pub fn extract_text_vertices(buffer: &TextBuffer) -> (&[f32], &[u32]) {
    (&buffer.vertices, &buffer.indices)
}

/// Extract raw vertex data from a FillBuffer for GPU upload
pub fn extract_fill_vertices(buffer: &FillBuffer) -> &[f32] {
    &buffer.vertices
}

/// Extract raw vertex data from a LineBuffer for GPU upload
pub fn extract_line_vertices(buffer: &LineBuffer) -> &[f32] {
    &buffer.vertices
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_cache_merges_hashes() {
        let mut cache = BatchCache::new();

        // First batch with hash (0, 0)
        let batch1 = RenderBatch {
            sequence: 1,
            hashes: vec![HashRenderData {
                hash_x: 0,
                hash_y: 0,
                ..Default::default()
            }],
            ..Default::default()
        };
        cache.update(batch1);
        assert_eq!(cache.hash_count(), 1);
        assert!(cache.has_new_data());

        // Second batch with hash (1, 0)
        let batch2 = RenderBatch {
            sequence: 2,
            hashes: vec![HashRenderData {
                hash_x: 1,
                hash_y: 0,
                ..Default::default()
            }],
            ..Default::default()
        };
        cache.update(batch2);
        assert_eq!(cache.hash_count(), 2); // Both hashes are cached

        // Mark rendered
        cache.mark_rendered();
        assert!(!cache.has_new_data());

        // Third batch updates existing hash (0, 0)
        let batch3 = RenderBatch {
            sequence: 3,
            hashes: vec![HashRenderData {
                hash_x: 0,
                hash_y: 0,
                world_x: 100.0, // Different data
                ..Default::default()
            }],
            ..Default::default()
        };
        cache.update(batch3);
        assert_eq!(cache.hash_count(), 2); // Still 2 hashes
        assert!(cache.has_new_data());

        // Verify the hash was updated
        let hash = cache.hashes.get(&(0, 0)).unwrap();
        assert_eq!(hash.world_x, 100.0);
    }

    #[test]
    fn test_batch_cache_rejects_old_batches() {
        let mut cache = BatchCache::new();

        let batch2 = RenderBatch {
            sequence: 2,
            ..Default::default()
        };
        cache.update(batch2);
        assert_eq!(cache.batches_received, 1);

        // Older batch should be rejected
        let batch1 = RenderBatch {
            sequence: 1,
            ..Default::default()
        };
        cache.update(batch1);
        assert_eq!(cache.batches_received, 1); // Not incremented
    }
}
