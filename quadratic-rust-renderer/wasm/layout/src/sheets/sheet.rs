//! Single sheet data for layout

use std::collections::HashMap;

use quadratic_core_shared::{GridBounds, SheetId, SheetOffsets};
use quadratic_renderer_core::hash_key;

use super::fills::CellsFills;
use super::text::TextHash;

/// A single sheet's layout data
pub struct Sheet {
    pub sheet_id: SheetId,
    pub sheet_offsets: SheetOffsets,
    pub bounds: GridBounds,

    /// Text hashes (spatial partitioning for text labels)
    pub hashes: HashMap<u64, TextHash>,

    /// Fill data
    pub fills: CellsFills,

    /// Content cache for fast neighbor lookup (used for clip bounds)
    /// Maps row -> sorted list of columns with content
    content_cache: HashMap<i64, Vec<i64>>,

    /// Total label count across all hashes
    pub label_count: usize,
}

impl Sheet {
    pub fn new(sheet_id: SheetId, offsets: SheetOffsets, bounds: GridBounds) -> Self {
        Self {
            sheet_id,
            sheet_offsets: offsets,
            bounds,
            hashes: HashMap::new(),
            fills: CellsFills::new(),
            content_cache: HashMap::new(),
            label_count: 0,
        }
    }

    /// Check if a hash is loaded
    pub fn has_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        let key = hash_key(hash_x, hash_y);
        self.hashes.contains_key(&key)
    }

    /// Get hash count
    pub fn hash_count(&self) -> usize {
        self.hashes.len()
    }

    /// Remove a hash
    pub fn remove_hash(&mut self, hash_x: i64, hash_y: i64) {
        let key = hash_key(hash_x, hash_y);
        if let Some(hash) = self.hashes.remove(&key) {
            self.label_count = self.label_count.saturating_sub(hash.label_count());
        }
    }

    // =========================================================================
    // Content Cache (for clip bounds calculation)
    // =========================================================================

    /// Add a cell to the content cache
    pub fn add_content(&mut self, col: i64, row: i64) {
        let row_content = self.content_cache.entry(row).or_insert_with(Vec::new);

        // Insert in sorted order
        match row_content.binary_search(&col) {
            Ok(_) => {} // Already exists
            Err(pos) => row_content.insert(pos, col),
        }
    }

    /// Clear content cache for a hash region
    pub fn clear_content_for_hash(&mut self, hash_x: i64, hash_y: i64) {
        use quadratic_renderer_core::{HASH_HEIGHT, HASH_WIDTH};

        let start_col = hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH;
        let start_row = hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT;

        for row in start_row..end_row {
            if let Some(cols) = self.content_cache.get_mut(&row) {
                cols.retain(|&c| c < start_col || c >= end_col);
            }
        }
    }

    /// Find the nearest content cell to the left of (col, row)
    pub fn find_content_left(&self, col: i64, row: i64) -> Option<i64> {
        self.content_cache.get(&row).and_then(|cols| {
            // Binary search for position, then take previous
            match cols.binary_search(&col) {
                Ok(pos) if pos > 0 => Some(cols[pos - 1]),
                Err(pos) if pos > 0 => Some(cols[pos - 1]),
                _ => None,
            }
        })
    }

    /// Find the nearest content cell to the right of (col, row)
    pub fn find_content_right(&self, col: i64, row: i64) -> Option<i64> {
        self.content_cache.get(&row).and_then(|cols| {
            // Binary search for position, then take next
            match cols.binary_search(&col) {
                Ok(pos) if pos + 1 < cols.len() => Some(cols[pos + 1]),
                Err(pos) if pos < cols.len() => Some(cols[pos]),
                _ => None,
            }
        })
    }
}
