//! Batch receiver - processes RenderBatch from the Layout Worker
//!
//! This module handles receiving pre-computed render batches and uploading
//! the vertex buffers to the GPU for rendering.

use quadratic_rust_renderer_shared::{FillBuffer, LineBuffer, RenderBatch, TextBuffer};

/// Decode a bincode-encoded RenderBatch from the Layout Worker
pub fn decode_render_batch(data: &[u8]) -> Result<RenderBatch, String> {
    let (batch, _): (RenderBatch, _) =
        bincode::decode_from_slice(data, bincode::config::standard())
            .map_err(|e| format!("Failed to decode RenderBatch: {}", e))?;
    Ok(batch)
}

/// Cache for the latest RenderBatch
/// The render worker processes this each frame
#[derive(Default)]
pub struct BatchCache {
    /// The latest batch from layout worker
    pub current_batch: Option<RenderBatch>,

    /// Sequence number of last processed batch
    last_sequence: u64,

    /// Stats
    pub batches_received: u64,
    pub batches_rendered: u64,
}

impl BatchCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Update with a new batch from layout worker
    pub fn update(&mut self, batch: RenderBatch) {
        // Only accept newer batches
        if batch.sequence > self.last_sequence {
            self.last_sequence = batch.sequence;
            self.current_batch = Some(batch);
            self.batches_received += 1;
        }
    }

    /// Take the current batch for rendering
    pub fn take(&mut self) -> Option<RenderBatch> {
        if let Some(batch) = self.current_batch.take() {
            self.batches_rendered += 1;
            Some(batch)
        } else {
            None
        }
    }

    /// Check if there's a new batch to render
    pub fn has_batch(&self) -> bool {
        self.current_batch.is_some()
    }

    /// Get the latest batch by reference (for partial updates)
    pub fn peek(&self) -> Option<&RenderBatch> {
        self.current_batch.as_ref()
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
    fn test_batch_cache_ordering() {
        let mut cache = BatchCache::new();

        // First batch
        let batch1 = RenderBatch {
            sequence: 1,
            ..Default::default()
        };
        cache.update(batch1);
        assert!(cache.has_batch());
        assert_eq!(cache.batches_received, 1);

        // Older batch should be ignored
        let batch0 = RenderBatch {
            sequence: 0,
            ..Default::default()
        };
        cache.update(batch0);
        assert_eq!(cache.batches_received, 1); // Not incremented

        // Newer batch should be accepted
        let batch2 = RenderBatch {
            sequence: 2,
            ..Default::default()
        };
        cache.update(batch2);
        assert_eq!(cache.batches_received, 2);

        // Take the batch
        let taken = cache.take();
        assert!(taken.is_some());
        assert_eq!(taken.unwrap().sequence, 2);
        assert!(!cache.has_batch());
        assert_eq!(cache.batches_rendered, 1);
    }
}
