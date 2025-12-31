//! Sheet - manages a single sheet's data
//!
//! Each sheet owns its own fills, labels, and spatial hashes.

use std::collections::HashMap;

use quadratic_core_shared::{SheetId, SheetOffsets};

use super::fills::CellsFills;
use super::text::{hash_key, CellsTextHash};

/// Manages data for a single sheet
pub struct Sheet {
    /// Sheet ID
    pub sheet_id: SheetId,

    /// Sheet offsets for column widths and row heights
    pub sheet_offsets: SheetOffsets,

    /// Spatial hashes containing cell labels
    /// Key is computed from (hash_x, hash_y) coordinates
    pub hashes: HashMap<u64, CellsTextHash>,

    /// Cell fills (background colors)
    pub fills: CellsFills,

    /// Total label count (cached for stats)
    pub label_count: usize,
}

impl Sheet {
    /// Create a new sheet with default offsets
    pub fn new(sheet_id: SheetId) -> Self {
        Self {
            sheet_id: sheet_id.clone(),
            sheet_offsets: SheetOffsets::default(),
            fills: CellsFills::new(sheet_id),
            hashes: HashMap::new(),
            label_count: 0,
        }
    }

    /// Create a sheet from sheet info
    pub fn from_sheet_info(sheet_id: SheetId, offsets: SheetOffsets) -> Self {
        Self {
            sheet_id: sheet_id.clone(),
            sheet_offsets: offsets,
            fills: CellsFills::new(sheet_id),
            hashes: HashMap::new(),
            label_count: 0,
        }
    }

    /// Update sheet offsets
    pub fn update_from_sheet_info(&mut self, offsets: SheetOffsets) {
        self.sheet_offsets = offsets;
    }

    /// Get a mutable reference to a hash, creating it if needed
    pub fn get_or_create_hash(&mut self, hash_x: i64, hash_y: i64) -> &mut CellsTextHash {
        let key = hash_key(hash_x, hash_y);
        self.hashes
            .entry(key)
            .or_insert_with(|| CellsTextHash::new(hash_x, hash_y, &self.sheet_offsets))
    }

    /// Check if a hash exists
    pub fn has_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        let key = hash_key(hash_x, hash_y);
        self.hashes.contains_key(&key)
    }

    /// Remove a hash
    pub fn remove_hash(&mut self, hash_x: i64, hash_y: i64) {
        let key = hash_key(hash_x, hash_y);
        if let Some(hash) = self.hashes.remove(&key) {
            self.label_count = self.label_count.saturating_sub(hash.label_count());
        }
    }

    /// Get number of loaded hashes
    pub fn hash_count(&self) -> usize {
        self.hashes.len()
    }

    /// Clear all data (for sheet switch)
    pub fn clear(&mut self) {
        self.hashes.clear();
        self.label_count = 0;
        self.fills = CellsFills::new(self.sheet_id.clone());
    }
}
