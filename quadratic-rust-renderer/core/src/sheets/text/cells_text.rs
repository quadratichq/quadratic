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
