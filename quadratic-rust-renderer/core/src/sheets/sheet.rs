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
use super::hash::hash_key;
use super::text::TextHash;
use crate::constants::{HASH_HEIGHT, HASH_WIDTH};
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
        (min_col..col)
            .rev()
            .find(|&search_col| self.content_cache.contains(&(search_col, row)))
    }

    /// Find next cell with content to the right
    pub fn find_content_right(&self, col: i64, row: i64) -> Option<i64> {
        let max_col = col + 100;
        ((col + 1)..=max_col).find(|&search_col| self.content_cache.contains(&(search_col, row)))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sheet_new() {
        let id = SheetId::TEST;
        let sheet = Sheet::new(id);

        assert_eq!(sheet.id(), id);
        assert!(sheet.text_hashes.is_empty());
        assert!(sheet.content_cache.is_empty());
        assert_eq!(sheet.label_count, 0);
    }

    #[test]
    fn test_sheet_with_offsets() {
        let id = SheetId::TEST;
        let offsets = SheetOffsets::default();
        let bounds = GridBounds::Empty;

        let sheet = Sheet::with_offsets(id, offsets, bounds);
        assert_eq!(sheet.id(), id);
        assert!(matches!(sheet.bounds, GridBounds::Empty));
    }

    #[test]
    fn test_content_cache_add_remove() {
        let mut sheet = Sheet::new(SheetId::TEST);

        assert!(!sheet.has_content(5, 10));

        sheet.add_content(5, 10);
        assert!(sheet.has_content(5, 10));

        sheet.remove_content(5, 10);
        assert!(!sheet.has_content(5, 10));
    }

    #[test]
    fn test_content_cache_multiple() {
        let mut sheet = Sheet::new(SheetId::TEST);

        sheet.add_content(1, 1);
        sheet.add_content(2, 2);
        sheet.add_content(3, 3);

        assert!(sheet.has_content(1, 1));
        assert!(sheet.has_content(2, 2));
        assert!(sheet.has_content(3, 3));
        assert!(!sheet.has_content(4, 4));
    }

    #[test]
    fn test_find_content_left() {
        let mut sheet = Sheet::new(SheetId::TEST);

        sheet.add_content(3, 1);
        sheet.add_content(7, 1);
        sheet.add_content(15, 1);

        // Find closest to the left
        assert_eq!(sheet.find_content_left(20, 1), Some(15));
        assert_eq!(sheet.find_content_left(10, 1), Some(7));
        assert_eq!(sheet.find_content_left(5, 1), Some(3));
        assert_eq!(sheet.find_content_left(3, 1), None); // At the content itself
        assert_eq!(sheet.find_content_left(2, 1), None);
    }

    #[test]
    fn test_find_content_left_different_rows() {
        let mut sheet = Sheet::new(SheetId::TEST);

        sheet.add_content(5, 1);
        sheet.add_content(5, 2);

        // Content in different row should not be found
        assert_eq!(sheet.find_content_left(10, 1), Some(5));
        assert_eq!(sheet.find_content_left(10, 3), None);
    }

    #[test]
    fn test_find_content_right() {
        let mut sheet = Sheet::new(SheetId::TEST);

        sheet.add_content(5, 1);
        sheet.add_content(10, 1);
        sheet.add_content(20, 1);

        assert_eq!(sheet.find_content_right(1, 1), Some(5));
        assert_eq!(sheet.find_content_right(5, 1), Some(10));
        assert_eq!(sheet.find_content_right(15, 1), Some(20));
        assert_eq!(sheet.find_content_right(20, 1), None); // At the content itself
    }

    #[test]
    fn test_find_content_right_different_rows() {
        let mut sheet = Sheet::new(SheetId::TEST);

        sheet.add_content(10, 1);
        sheet.add_content(10, 2);

        assert_eq!(sheet.find_content_right(1, 1), Some(10));
        assert_eq!(sheet.find_content_right(1, 3), None);
    }

    #[test]
    fn test_text_hash_creation() {
        let mut sheet = Sheet::new(SheetId::TEST);

        assert!(!sheet.has_text_hash(0, 0));
        assert_eq!(sheet.text_hash_count(), 0);

        let _hash = sheet.get_or_create_text_hash(0, 0);

        assert!(sheet.has_text_hash(0, 0));
        assert_eq!(sheet.text_hash_count(), 1);
    }

    #[test]
    fn test_text_hash_get() {
        let mut sheet = Sheet::new(SheetId::TEST);

        // Create a hash
        let _hash = sheet.get_or_create_text_hash(1, 2);

        // Get it back
        assert!(sheet.get_text_hash(1, 2).is_some());
        assert!(sheet.get_text_hash(0, 0).is_none());
    }

    #[test]
    fn test_text_hash_remove() {
        let mut sheet = Sheet::new(SheetId::TEST);

        sheet.get_or_create_text_hash(0, 0);
        assert!(sheet.has_text_hash(0, 0));

        sheet.remove_text_hash(0, 0);
        assert!(!sheet.has_text_hash(0, 0));
    }

    #[test]
    fn test_clear_content_for_hash() {
        let mut sheet = Sheet::new(SheetId::TEST);

        // Add content in hash region (0,0) - columns 1-50, rows 1-100
        sheet.add_content(1, 1);
        sheet.add_content(25, 50);
        sheet.add_content(50, 100);

        // Add content outside hash region (0,0)
        sheet.add_content(51, 1); // Different hash
        sheet.add_content(1, 101); // Different hash

        sheet.clear_content_for_hash(0, 0);

        // Content in hash (0,0) should be removed
        assert!(!sheet.has_content(1, 1));
        assert!(!sheet.has_content(25, 50));
        assert!(!sheet.has_content(50, 100));

        // Content outside should remain
        assert!(sheet.has_content(51, 1));
        assert!(sheet.has_content(1, 101));
    }

    #[test]
    fn test_column_max_width_empty() {
        let sheet = Sheet::new(SheetId::TEST);
        assert_eq!(sheet.get_column_max_width(1), 0.0);
    }

    #[test]
    fn test_row_max_height_empty() {
        let sheet = Sheet::new(SheetId::TEST);
        assert_eq!(sheet.get_row_max_height(1), 0.0);
    }

    #[test]
    fn test_update_offsets() {
        let mut sheet = Sheet::new(SheetId::TEST);
        let new_offsets = SheetOffsets::default();
        let new_bounds = GridBounds::Empty;

        sheet.update_offsets(new_offsets, new_bounds);
        // Should not panic
    }

    #[test]
    fn test_clear() {
        let mut sheet = Sheet::new(SheetId::TEST);

        // Add some data
        sheet.add_content(1, 1);
        sheet.get_or_create_text_hash(0, 0);

        sheet.clear();

        assert!(sheet.content_cache.is_empty());
        assert!(sheet.text_hashes.is_empty());
        assert_eq!(sheet.label_count, 0);
    }
}
