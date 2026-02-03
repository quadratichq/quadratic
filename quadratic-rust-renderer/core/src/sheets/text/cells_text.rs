//! Cell text management

use std::collections::HashMap;

use crate::types::TextBuffer;
use crate::viewport::VisibleHashBounds;

/// Manages cell text for a sheet
pub struct CellsText {
    /// Text buffers per hash
    hash_text: HashMap<(i64, i64), Vec<TextBuffer>>,

    /// Hashes that are dirty and need reload
    dirty_hashes: std::collections::HashSet<(i64, i64)>,

    /// Hashes that have been requested from core
    requested_hashes: std::collections::HashSet<(i64, i64)>,
}

impl CellsText {
    pub fn new() -> Self {
        Self {
            hash_text: HashMap::new(),
            dirty_hashes: std::collections::HashSet::new(),
            requested_hashes: std::collections::HashSet::new(),
        }
    }

    /// Set text buffers for a hash
    pub fn set_hash_text(&mut self, hash_x: i64, hash_y: i64, buffers: Vec<TextBuffer>) {
        self.hash_text.insert((hash_x, hash_y), buffers);
        self.dirty_hashes.remove(&(hash_x, hash_y));
    }

    /// Get text buffers for a hash
    pub fn get_hash_text(&self, hash_x: i64, hash_y: i64) -> Option<&Vec<TextBuffer>> {
        self.hash_text.get(&(hash_x, hash_y))
    }

    /// Check if a hash has text loaded
    pub fn has_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        self.hash_text.contains_key(&(hash_x, hash_y))
    }

    /// Mark a hash as dirty
    pub fn mark_dirty(&mut self, hash_x: i64, hash_y: i64) {
        self.dirty_hashes.insert((hash_x, hash_y));
    }

    /// Mark a hash as requested
    pub fn mark_requested(&mut self, hash_x: i64, hash_y: i64) {
        self.requested_hashes.insert((hash_x, hash_y));
    }

    /// Get hashes that need loading within visible bounds
    pub fn get_needed_hashes(&self, bounds: &VisibleHashBounds) -> Vec<(i64, i64)> {
        bounds
            .iter()
            .filter(|&(x, y)| !self.has_hash(x, y) || self.dirty_hashes.contains(&(x, y)))
            .collect()
    }

    /// Get hashes that need to be requested (not loaded, not dirty, not already requested)
    pub fn get_unrequested_hashes(&self, bounds: &VisibleHashBounds) -> Vec<(i64, i64)> {
        bounds
            .iter()
            .filter(|&(x, y)| {
                !self.has_hash(x, y)
                    && !self.dirty_hashes.contains(&(x, y))
                    && !self.requested_hashes.contains(&(x, y))
            })
            .collect()
    }

    /// Unload a hash
    pub fn unload_hash(&mut self, hash_x: i64, hash_y: i64) {
        self.hash_text.remove(&(hash_x, hash_y));
        self.requested_hashes.remove(&(hash_x, hash_y));
    }

    /// Get number of loaded hashes
    pub fn hash_count(&self) -> usize {
        self.hash_text.len()
    }

    /// Get visible text buffers
    pub fn get_visible_text(&self, bounds: &VisibleHashBounds) -> Vec<&Vec<TextBuffer>> {
        bounds
            .iter()
            .filter_map(|(x, y)| self.hash_text.get(&(x, y)))
            .collect()
    }
}

impl Default for CellsText {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_bounds(min_x: i64, max_x: i64, min_y: i64, max_y: i64) -> VisibleHashBounds {
        VisibleHashBounds {
            min_hash_x: min_x,
            max_hash_x: max_x,
            min_hash_y: min_y,
            max_hash_y: max_y,
        }
    }

    fn create_test_buffer(texture_uid: u32, font_size: f32) -> TextBuffer {
        TextBuffer::new(texture_uid, font_size)
    }

    #[test]
    fn test_new() {
        let cells_text = CellsText::new();
        assert_eq!(cells_text.hash_count(), 0);
        assert!(!cells_text.has_hash(0, 0));
    }

    #[test]
    fn test_default() {
        let cells_text = CellsText::default();
        assert_eq!(cells_text.hash_count(), 0);
    }

    #[test]
    fn test_set_hash_text() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0), create_test_buffer(2, 14.0)];

        cells_text.set_hash_text(0, 0, buffers.clone());
        assert!(cells_text.has_hash(0, 0));
        assert_eq!(cells_text.hash_count(), 1);

        let retrieved = cells_text.get_hash_text(0, 0).unwrap();
        assert_eq!(retrieved.len(), 2);
        assert_eq!(retrieved[0].texture_uid, 1);
        assert_eq!(retrieved[1].texture_uid, 2);
    }

    #[test]
    fn test_set_hash_text_removes_dirty() {
        let mut cells_text = CellsText::new();
        cells_text.mark_dirty(0, 0);

        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers);

        let bounds = create_test_bounds(0, 0, 0, 0);
        let needed = cells_text.get_needed_hashes(&bounds);
        assert!(needed.is_empty());
    }

    #[test]
    fn test_get_hash_text_nonexistent() {
        let cells_text = CellsText::new();
        assert!(cells_text.get_hash_text(0, 0).is_none());
        assert!(cells_text.get_hash_text(5, 10).is_none());
    }

    #[test]
    fn test_has_hash() {
        let mut cells_text = CellsText::new();
        assert!(!cells_text.has_hash(0, 0));

        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers);
        assert!(cells_text.has_hash(0, 0));
        assert!(!cells_text.has_hash(1, 1));
    }

    #[test]
    fn test_mark_dirty() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers);

        let bounds = create_test_bounds(0, 0, 0, 0);
        assert!(cells_text.get_needed_hashes(&bounds).is_empty());

        cells_text.mark_dirty(0, 0);
        let needed = cells_text.get_needed_hashes(&bounds);
        assert_eq!(needed.len(), 1);
        assert_eq!(needed[0], (0, 0));
    }

    #[test]
    fn test_mark_requested() {
        let mut cells_text = CellsText::new();
        cells_text.mark_requested(0, 0);

        let bounds = create_test_bounds(0, 0, 0, 0);
        let unrequested = cells_text.get_unrequested_hashes(&bounds);
        assert!(unrequested.is_empty());
    }

    #[test]
    fn test_get_needed_hashes_empty() {
        let cells_text = CellsText::new();
        let bounds = create_test_bounds(0, 2, 0, 2);
        let needed = cells_text.get_needed_hashes(&bounds);

        assert_eq!(needed.len(), 9);
        assert!(needed.contains(&(0, 0)));
        assert!(needed.contains(&(2, 2)));
    }

    #[test]
    fn test_get_needed_hashes_with_loaded() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers);

        let bounds = create_test_bounds(0, 1, 0, 1);
        let needed = cells_text.get_needed_hashes(&bounds);

        assert_eq!(needed.len(), 3);
        assert!(!needed.contains(&(0, 0)));
        assert!(needed.contains(&(0, 1)));
        assert!(needed.contains(&(1, 0)));
        assert!(needed.contains(&(1, 1)));
    }

    #[test]
    fn test_get_needed_hashes_with_dirty() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers);
        cells_text.mark_dirty(0, 0);

        let bounds = create_test_bounds(0, 1, 0, 1);
        let needed = cells_text.get_needed_hashes(&bounds);

        assert_eq!(needed.len(), 4);
        assert!(needed.contains(&(0, 0)));
    }

    #[test]
    fn test_get_unrequested_hashes() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers);
        cells_text.mark_requested(1, 0);
        cells_text.mark_dirty(0, 1);

        let bounds = create_test_bounds(0, 1, 0, 1);
        let unrequested = cells_text.get_unrequested_hashes(&bounds);

        assert_eq!(unrequested.len(), 1);
        assert_eq!(unrequested[0], (1, 1));
    }

    #[test]
    fn test_get_unrequested_hashes_all_loaded() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers.clone());
        cells_text.set_hash_text(0, 1, buffers.clone());
        cells_text.set_hash_text(1, 0, buffers.clone());
        cells_text.set_hash_text(1, 1, buffers);

        let bounds = create_test_bounds(0, 1, 0, 1);
        let unrequested = cells_text.get_unrequested_hashes(&bounds);
        assert!(unrequested.is_empty());
    }

    #[test]
    fn test_unload_hash() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers);
        cells_text.mark_requested(0, 0);

        assert_eq!(cells_text.hash_count(), 1);
        assert!(cells_text.has_hash(0, 0));

        cells_text.unload_hash(0, 0);

        assert_eq!(cells_text.hash_count(), 0);
        assert!(!cells_text.has_hash(0, 0));

        let bounds = create_test_bounds(0, 0, 0, 0);
        let unrequested = cells_text.get_unrequested_hashes(&bounds);
        assert_eq!(unrequested.len(), 1);
    }

    #[test]
    fn test_unload_hash_nonexistent() {
        let mut cells_text = CellsText::new();
        cells_text.unload_hash(5, 5);
        assert_eq!(cells_text.hash_count(), 0);
    }

    #[test]
    fn test_hash_count() {
        let mut cells_text = CellsText::new();
        assert_eq!(cells_text.hash_count(), 0);

        let buffers = vec![create_test_buffer(1, 12.0)];
        cells_text.set_hash_text(0, 0, buffers.clone());
        assert_eq!(cells_text.hash_count(), 1);

        cells_text.set_hash_text(1, 1, buffers.clone());
        assert_eq!(cells_text.hash_count(), 2);

        cells_text.set_hash_text(0, 0, buffers.clone());
        assert_eq!(cells_text.hash_count(), 2);

        cells_text.unload_hash(0, 0);
        assert_eq!(cells_text.hash_count(), 1);
    }

    #[test]
    fn test_get_visible_text() {
        let mut cells_text = CellsText::new();
        let buffers1 = vec![create_test_buffer(1, 12.0)];
        let buffers2 = vec![create_test_buffer(2, 14.0)];

        cells_text.set_hash_text(0, 0, buffers1);
        cells_text.set_hash_text(1, 1, buffers2);

        let bounds = create_test_bounds(0, 1, 0, 1);
        let visible = cells_text.get_visible_text(&bounds);

        assert_eq!(visible.len(), 2);
    }

    #[test]
    fn test_get_visible_text_partial() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0)];

        cells_text.set_hash_text(0, 0, buffers.clone());
        cells_text.set_hash_text(2, 2, buffers);

        let bounds = create_test_bounds(0, 1, 0, 1);
        let visible = cells_text.get_visible_text(&bounds);

        assert_eq!(visible.len(), 1);
    }

    #[test]
    fn test_get_visible_text_empty() {
        let cells_text = CellsText::new();
        let bounds = create_test_bounds(0, 1, 0, 1);
        let visible = cells_text.get_visible_text(&bounds);

        assert!(visible.is_empty());
    }

    #[test]
    fn test_multiple_hashes() {
        let mut cells_text = CellsText::new();
        let buffers = vec![create_test_buffer(1, 12.0)];

        cells_text.set_hash_text(0, 0, buffers.clone());
        cells_text.set_hash_text(1, 0, buffers.clone());
        cells_text.set_hash_text(0, 1, buffers.clone());
        cells_text.set_hash_text(1, 1, buffers);

        assert_eq!(cells_text.hash_count(), 4);
        assert!(cells_text.has_hash(0, 0));
        assert!(cells_text.has_hash(1, 0));
        assert!(cells_text.has_hash(0, 1));
        assert!(cells_text.has_hash(1, 1));
    }

    #[test]
    fn test_dirty_and_requested_interaction() {
        let mut cells_text = CellsText::new();
        cells_text.mark_dirty(0, 0);
        cells_text.mark_requested(0, 0);

        let bounds = create_test_bounds(0, 0, 0, 0);
        let needed = cells_text.get_needed_hashes(&bounds);
        assert_eq!(needed.len(), 1);

        let unrequested = cells_text.get_unrequested_hashes(&bounds);
        assert!(unrequested.is_empty());
    }

    #[test]
    fn test_set_hash_text_overwrites() {
        let mut cells_text = CellsText::new();
        let buffers1 = vec![create_test_buffer(1, 12.0)];
        let buffers2 = vec![create_test_buffer(2, 14.0), create_test_buffer(3, 16.0)];

        cells_text.set_hash_text(0, 0, buffers1);
        assert_eq!(cells_text.get_hash_text(0, 0).unwrap().len(), 1);

        cells_text.set_hash_text(0, 0, buffers2);
        assert_eq!(cells_text.get_hash_text(0, 0).unwrap().len(), 2);
        assert_eq!(cells_text.hash_count(), 1);
    }
}
