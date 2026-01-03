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
