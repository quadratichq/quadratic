//! Single sheet data
//!
//! Each sheet contains:
//! - Sheet offsets (column widths, row heights)
//! - Grid bounds (extent of data)
//! - Spatial hashes for text and fills
//! - Content cache for overflow detection

use std::collections::{HashMap, HashSet};

use quadratic_core::grid::GridBounds;
use quadratic_core::grid::SheetId;
use quadratic_core::sheet_offsets::SheetOffsets;

use super::fills::CellsFills;
use super::hash::{hash_key, HASH_HEIGHT, HASH_WIDTH};
use super::text::TextHash;
use super::text::CellsText;

/// Data for a single sheet
pub struct Sheet {
    /// Sheet ID
    pub id: SheetId,

    /// Sheet offsets (column widths, row heights)
    pub offsets: SheetOffsets,

    /// Bounds of all data in the sheet
    pub bounds: GridBounds,

    /// Spatial hashes containing cell labels
    /// Key is computed from (hash_x, hash_y) coordinates
    pub text_hashes: HashMap<u64, TextHash>,

    /// Cell fills (backgrounds)
    pub fills: CellsFills,

    /// Cell text (legacy - for compatibility)
    pub text: CellsText,

    /// Content cache - tracks which cells have content for overflow clipping
    pub content_cache: HashSet<(i64, i64)>,

    /// Total label count (cached for stats)
    pub label_count: usize,
}

impl Sheet {
    /// Create a new sheet with default offsets
    pub fn new(id: SheetId) -> Self {
        Self {
            id,
            offsets: SheetOffsets::default(),
            bounds: GridBounds::Empty,
            text_hashes: HashMap::new(),
            fills: CellsFills::new(),
            text: CellsText::new(),
            content_cache: HashSet::new(),
            label_count: 0,
        }
    }

    /// Create a sheet with specific offsets and bounds
    pub fn with_offsets(id: SheetId, offsets: SheetOffsets, bounds: GridBounds) -> Self {
        Self {
            id,
            offsets,
            bounds,
            text_hashes: HashMap::new(),
            fills: CellsFills::new(),
            text: CellsText::new(),
            content_cache: HashSet::new(),
            label_count: 0,
        }
    }

    /// Get sheet ID
    pub fn id(&self) -> SheetId {
        self.id
    }

    /// Update offsets and bounds
    pub fn update_offsets(&mut self, offsets: SheetOffsets, bounds: GridBounds) {
        self.offsets = offsets;
        self.bounds = bounds;

        // Update all text hash bounds
        for hash in self.text_hashes.values_mut() {
            hash.update_bounds(&self.offsets);
        }
    }

    // ========================================================================
    // Text Hash Management
    // ========================================================================

    /// Get or create a text hash
    pub fn get_or_create_text_hash(&mut self, hash_x: i64, hash_y: i64) -> &mut TextHash {
        let key = hash_key(hash_x, hash_y);
        self.text_hashes
            .entry(key)
            .or_insert_with(|| TextHash::new(hash_x, hash_y, &self.offsets))
    }

    /// Get a text hash
    pub fn get_text_hash(&self, hash_x: i64, hash_y: i64) -> Option<&TextHash> {
        let key = hash_key(hash_x, hash_y);
        self.text_hashes.get(&key)
    }

    /// Get a mutable text hash
    pub fn get_text_hash_mut(&mut self, hash_x: i64, hash_y: i64) -> Option<&mut TextHash> {
        let key = hash_key(hash_x, hash_y);
        self.text_hashes.get_mut(&key)
    }

    /// Check if a text hash exists
    pub fn has_text_hash(&self, hash_x: i64, hash_y: i64) -> bool {
        let key = hash_key(hash_x, hash_y);
        self.text_hashes.contains_key(&key)
    }

    /// Remove a text hash
    pub fn remove_text_hash(&mut self, hash_x: i64, hash_y: i64) {
        let key = hash_key(hash_x, hash_y);
        if let Some(hash) = self.text_hashes.remove(&key) {
            self.label_count = self.label_count.saturating_sub(hash.label_count());
        }
    }

    /// Get number of loaded text hashes
    pub fn text_hash_count(&self) -> usize {
        self.text_hashes.len()
    }

    // ========================================================================
    // Content Cache (for overflow detection)
    // ========================================================================

    /// Check if a cell has content
    pub fn has_content(&self, col: i64, row: i64) -> bool {
        self.content_cache.contains(&(col, row))
    }

    /// Add a cell to content cache
    pub fn add_content(&mut self, col: i64, row: i64) {
        self.content_cache.insert((col, row));
    }

    /// Remove a cell from content cache
    pub fn remove_content(&mut self, col: i64, row: i64) {
        self.content_cache.remove(&(col, row));
    }

    /// Clear content cache for a hash region
    pub fn clear_content_for_hash(&mut self, hash_x: i64, hash_y: i64) {
        let start_col = hash_x * HASH_WIDTH + 1;
        let end_col = start_col + HASH_WIDTH;
        let start_row = hash_y * HASH_HEIGHT + 1;
        let end_row = start_row + HASH_HEIGHT;

        self.content_cache.retain(|(col, row)| {
            !(*col >= start_col && *col < end_col && *row >= start_row && *row < end_row)
        });
    }

    /// Find next cell with content to the left
    pub fn find_content_left(&self, col: i64, row: i64) -> Option<i64> {
        let min_col = (col - 100).max(1);
        for search_col in (min_col..col).rev() {
            if self.content_cache.contains(&(search_col, row)) {
                return Some(search_col);
            }
        }
        None
    }

    /// Find next cell with content to the right
    pub fn find_content_right(&self, col: i64, row: i64) -> Option<i64> {
        let max_col = col + 100;
        for search_col in (col + 1)..=max_col {
            if self.content_cache.contains(&(search_col, row)) {
                return Some(search_col);
            }
        }
        None
    }

    // ========================================================================
    // Auto-size
    // ========================================================================

    /// Get max content width for a column (for auto-resize)
    pub fn get_column_max_width(&self, column: i64) -> f32 {
        self.text_hashes
            .values()
            .map(|hash| hash.get_column_max_width(column))
            .fold(0.0f32, |a, b| a.max(b))
    }

    /// Get max content height for a row (for auto-resize)
    pub fn get_row_max_height(&self, row: i64) -> f32 {
        self.text_hashes
            .values()
            .map(|hash| hash.get_row_max_height(row))
            .fold(0.0f32, |a, b| a.max(b))
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /// Clear all data (for sheet switch)
    pub fn clear(&mut self) {
        self.text_hashes.clear();
        self.label_count = 0;
        self.content_cache.clear();
        self.fills = CellsFills::new();
    }
}
