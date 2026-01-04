//! Sheet - manages a single sheet's data
//!
//! Each sheet owns its own fills, labels, spatial hashes, and table cache.

use std::collections::{HashMap, HashSet};

use quadratic_core_shared::{GridBounds, SheetId, SheetOffsets};

use super::fills::CellsFills;
use super::text::{hash_key, CellsTextHash};
use crate::tables::TableCache;

/// Manages data for a single sheet
pub struct Sheet {
    /// Sheet ID
    pub sheet_id: SheetId,

    /// Sheet offsets for column widths and row heights
    pub sheet_offsets: SheetOffsets,

    /// Bounds of all data in the sheet (for limiting hash requests)
    pub bounds: GridBounds,

    /// Spatial hashes containing cell labels
    /// Key is computed from (hash_x, hash_y) coordinates
    pub hashes: HashMap<u64, CellsTextHash>,

    /// Cell fills (background colors)
    pub fills: CellsFills,

    /// Table cache for rendering table headers
    pub tables: TableCache,

    /// Total label count (cached for stats)
    pub label_count: usize,

    /// Content cache - tracks which cells have content for overflow clipping
    /// Key is (column, row) - used to determine if a neighbor cell has content
    /// that should cause text to be clipped
    pub content_cache: HashSet<(i64, i64)>,
}

impl Sheet {
    /// Create a new sheet with default offsets
    pub fn new(sheet_id: SheetId) -> Self {
        Self {
            sheet_id: sheet_id.clone(),
            sheet_offsets: SheetOffsets::default(),
            bounds: GridBounds::Empty,
            fills: CellsFills::new(sheet_id),
            hashes: HashMap::new(),
            tables: TableCache::new(),
            label_count: 0,
            content_cache: HashSet::new(),
        }
    }

    /// Create a sheet from sheet info
    pub fn from_sheet_info(sheet_id: SheetId, offsets: SheetOffsets, bounds: GridBounds) -> Self {
        Self {
            sheet_id: sheet_id.clone(),
            sheet_offsets: offsets,
            bounds,
            fills: CellsFills::new(sheet_id),
            hashes: HashMap::new(),
            tables: TableCache::new(),
            label_count: 0,
            content_cache: HashSet::new(),
        }
    }

    /// Check if a cell has content (for overflow clipping)
    pub fn has_content(&self, col: i64, row: i64) -> bool {
        self.content_cache.contains(&(col, row))
    }

    /// Add a cell to the content cache
    pub fn add_content(&mut self, col: i64, row: i64) {
        self.content_cache.insert((col, row));
    }

    /// Remove a cell from the content cache
    pub fn remove_content(&mut self, col: i64, row: i64) {
        self.content_cache.remove(&(col, row));
    }

    /// Clear content cache for a hash region
    pub fn clear_content_for_hash(&mut self, hash_x: i64, hash_y: i64) {
        use super::text::{HASH_WIDTH, HASH_HEIGHT};
        let start_col = hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH;
        let start_row = hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT;

        self.content_cache
            .retain(|(col, row)| !(*col >= start_col && *col < end_col && *row >= start_row && *row < end_row));
    }

    /// Update sheet offsets and bounds
    pub fn update_from_sheet_info(&mut self, offsets: SheetOffsets, bounds: GridBounds) {
        self.sheet_offsets = offsets;
        self.bounds = bounds;
        // Update table bounds when offsets change
        self.tables.update_bounds(&self.sheet_offsets);
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
        self.tables.clear();
        self.content_cache.clear();
    }

    /// Find the next cell with content to the left of the given column on the same row
    /// Returns the column index if found, None otherwise
    pub fn find_content_left(&self, col: i64, row: i64) -> Option<i64> {
        // Start from col-1 and search left
        let mut search_col = col - 1;
        // Limit search to avoid scanning too far (100 columns max)
        let min_col = (col - 100).max(1);
        while search_col >= min_col {
            if self.content_cache.contains(&(search_col, row)) {
                return Some(search_col);
            }
            search_col -= 1;
        }
        None
    }

    /// Find the next cell with content to the right of the given column on the same row
    /// Returns the column index if found, None otherwise
    pub fn find_content_right(&self, col: i64, row: i64) -> Option<i64> {
        // Start from col+1 and search right
        let mut search_col = col + 1;
        // Limit search to avoid scanning too far (100 columns max)
        let max_col = col + 100;
        while search_col <= max_col {
            if self.content_cache.contains(&(search_col, row)) {
                return Some(search_col);
            }
            search_col += 1;
        }
        None
    }
}
