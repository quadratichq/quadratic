//! Cell fills management

use std::collections::HashMap;

use crate::types::FillBuffer;
use crate::viewport::VisibleHashBounds;

/// Manages cell fills for a sheet
pub struct CellsFills {
    /// Fills per hash
    hash_fills: HashMap<(i64, i64), FillBuffer>,

    /// Meta fills (infinite row/column/sheet fills)
    meta_fills: Option<FillBuffer>,

    /// Hashes that are dirty and need reload
    dirty_hashes: std::collections::HashSet<(i64, i64)>,

    /// Whether meta fills have been loaded
    meta_loaded: bool,
}

impl CellsFills {
    pub fn new() -> Self {
        Self {
            hash_fills: HashMap::new(),
            meta_fills: None,
            dirty_hashes: std::collections::HashSet::new(),
            meta_loaded: false,
        }
    }

    /// Check if meta fills are loaded
    pub fn meta_loaded(&self) -> bool {
        self.meta_loaded
    }

    /// Set meta fills
    pub fn set_meta_fills(&mut self, fills: FillBuffer) {
        self.meta_fills = Some(fills);
        self.meta_loaded = true;
    }

    /// Get meta fills
    pub fn meta_fills(&self) -> Option<&FillBuffer> {
        self.meta_fills.as_ref()
    }

    /// Set fills for a hash
    pub fn set_hash_fills(&mut self, hash_x: i64, hash_y: i64, fills: FillBuffer) {
        self.hash_fills.insert((hash_x, hash_y), fills);
        self.dirty_hashes.remove(&(hash_x, hash_y));
    }

    /// Get fills for a hash
    pub fn get_hash_fills(&self, hash_x: i64, hash_y: i64) -> Option<&FillBuffer> {
        self.hash_fills.get(&(hash_x, hash_y))
    }

    /// Check if a hash has fills loaded
    pub fn has_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        self.hash_fills.contains_key(&(hash_x, hash_y))
    }

    /// Mark a hash as dirty
    pub fn mark_dirty(&mut self, hash_x: i64, hash_y: i64) {
        self.dirty_hashes.insert((hash_x, hash_y));
    }

    /// Get hashes that need loading within visible bounds
    pub fn get_needed_hashes(&self, bounds: &VisibleHashBounds) -> Vec<(i64, i64)> {
        bounds
            .iter()
            .filter(|&(x, y)| !self.has_hash(x, y) || self.dirty_hashes.contains(&(x, y)))
            .collect()
    }

    /// Unload a hash
    pub fn unload_hash(&mut self, hash_x: i64, hash_y: i64) {
        self.hash_fills.remove(&(hash_x, hash_y));
    }

    /// Get number of loaded hashes
    pub fn hash_count(&self) -> usize {
        self.hash_fills.len()
    }

    /// Get visible fill buffers
    pub fn get_visible_fills(&self, bounds: &VisibleHashBounds) -> Vec<&FillBuffer> {
        bounds
            .iter()
            .filter_map(|(x, y)| self.hash_fills.get(&(x, y)))
            .collect()
    }
}

impl Default for CellsFills {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_fill_buffer() -> FillBuffer {
        let mut buffer = FillBuffer::new();
        buffer.add_rect(0.0, 0.0, 100.0, 50.0, [1.0, 0.0, 0.0, 1.0]);
        buffer
    }

    #[test]
    fn test_cells_fills_new() {
        let fills = CellsFills::new();
        assert!(!fills.meta_loaded());
        assert_eq!(fills.hash_count(), 0);
    }

    #[test]
    fn test_cells_fills_default() {
        let fills = CellsFills::default();
        assert!(!fills.meta_loaded());
    }

    #[test]
    fn test_set_meta_fills() {
        let mut fills = CellsFills::new();
        let buffer = create_test_fill_buffer();

        assert!(!fills.meta_loaded());
        assert!(fills.meta_fills().is_none());

        fills.set_meta_fills(buffer);

        assert!(fills.meta_loaded());
        assert!(fills.meta_fills().is_some());
    }

    #[test]
    fn test_set_hash_fills() {
        let mut fills = CellsFills::new();
        let buffer = create_test_fill_buffer();

        assert!(!fills.has_hash(0, 0));

        fills.set_hash_fills(0, 0, buffer);

        assert!(fills.has_hash(0, 0));
        assert_eq!(fills.hash_count(), 1);
    }

    #[test]
    fn test_get_hash_fills() {
        let mut fills = CellsFills::new();
        let buffer = create_test_fill_buffer();

        fills.set_hash_fills(1, 2, buffer);

        assert!(fills.get_hash_fills(1, 2).is_some());
        assert!(fills.get_hash_fills(0, 0).is_none());
    }

    #[test]
    fn test_mark_dirty() {
        let mut fills = CellsFills::new();
        fills.set_hash_fills(0, 0, create_test_fill_buffer());

        fills.mark_dirty(0, 0);

        let bounds = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 0,
            min_hash_y: 0,
            max_hash_y: 0,
        };

        // Dirty hash should be in needed hashes
        let needed = fills.get_needed_hashes(&bounds);
        assert!(needed.contains(&(0, 0)));
    }

    #[test]
    fn test_set_hash_fills_clears_dirty() {
        let mut fills = CellsFills::new();
        fills.mark_dirty(0, 0);

        let bounds = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 0,
            min_hash_y: 0,
            max_hash_y: 0,
        };

        assert!(fills.get_needed_hashes(&bounds).contains(&(0, 0)));

        fills.set_hash_fills(0, 0, create_test_fill_buffer());

        assert!(!fills.get_needed_hashes(&bounds).contains(&(0, 0)));
    }

    #[test]
    fn test_unload_hash() {
        let mut fills = CellsFills::new();
        fills.set_hash_fills(0, 0, create_test_fill_buffer());

        assert!(fills.has_hash(0, 0));

        fills.unload_hash(0, 0);

        assert!(!fills.has_hash(0, 0));
        assert_eq!(fills.hash_count(), 0);
    }

    #[test]
    fn test_get_needed_hashes() {
        let mut fills = CellsFills::new();

        let bounds = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 2,
            min_hash_y: 0,
            max_hash_y: 1,
        };

        // All hashes needed initially
        let needed = fills.get_needed_hashes(&bounds);
        assert_eq!(needed.len(), 6);

        // Load one hash
        fills.set_hash_fills(0, 0, create_test_fill_buffer());

        let needed = fills.get_needed_hashes(&bounds);
        assert_eq!(needed.len(), 5);
        assert!(!needed.contains(&(0, 0)));
    }

    #[test]
    fn test_get_visible_fills() {
        let mut fills = CellsFills::new();
        fills.set_hash_fills(0, 0, create_test_fill_buffer());
        fills.set_hash_fills(1, 0, create_test_fill_buffer());
        fills.set_hash_fills(2, 2, create_test_fill_buffer());

        let bounds = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 1,
            min_hash_y: 0,
            max_hash_y: 0,
        };

        let visible = fills.get_visible_fills(&bounds);
        // Should only return 2 buffers (0,0 and 1,0), not (2,2)
        assert_eq!(visible.len(), 2);
    }

    #[test]
    fn test_multiple_hashes() {
        let mut fills = CellsFills::new();

        for x in 0..5 {
            for y in 0..5 {
                fills.set_hash_fills(x, y, create_test_fill_buffer());
            }
        }

        assert_eq!(fills.hash_count(), 25);
    }
}
