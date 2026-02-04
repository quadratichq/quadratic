//! Hash coordinate utilities
//!
//! Functions for converting between cell coordinates and hash coordinates.

use quadratic_core::sheet_offsets::SheetOffsets;

use crate::constants::{HASH_HEIGHT, HASH_PADDING, HASH_WIDTH};

/// Get hash coordinates for a cell position (1-indexed columns/rows)
///
/// # Examples
/// ```ignore
/// // Columns 1-50, rows 1-100 → hash (0, 0)
/// assert_eq!(get_hash_coords(1, 1), (0, 0));
/// assert_eq!(get_hash_coords(50, 100), (0, 0));
///
/// // Columns 51-100, rows 101-200 → hash (1, 1)
/// assert_eq!(get_hash_coords(51, 101), (1, 1));
/// ```
#[inline]
pub fn get_hash_coords(col: i64, row: i64) -> (i64, i64) {
    // Adjust for 1-indexed: col 1-50 → hash 0, col 51-100 → hash 1, etc.
    (
        (col - 1).div_euclid(HASH_WIDTH),
        (row - 1).div_euclid(HASH_HEIGHT),
    )
}

/// Get a unique key from hash coordinates
///
/// Combines hash coordinates into a single u64 key for HashMap storage.
/// Supports negative coordinates via bit manipulation.
#[inline]
pub fn hash_key(hash_x: i64, hash_y: i64) -> u64 {
    let x_bits = (hash_x as i32) as u32;
    let y_bits = (hash_y as i32) as u32;
    ((x_bits as u64) << 32) | (y_bits as u64)
}

/// Represents the range of visible hashes (inclusive bounds)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VisibleHashBounds {
    pub min_hash_x: i64,
    pub max_hash_x: i64,
    pub min_hash_y: i64,
    pub max_hash_y: i64,
}

impl VisibleHashBounds {
    /// Create bounds from viewport world coordinates using sheet offsets
    ///
    /// Includes padding for preloading adjacent hashes.
    pub fn from_viewport(
        vp_x: f32,
        vp_y: f32,
        vp_width: f32,
        vp_height: f32,
        offsets: &SheetOffsets,
    ) -> Self {
        // Convert world coordinates to cell coordinates using offsets
        let (min_col, _) = offsets.column_from_x(vp_x.max(0.0) as f64);
        let (max_col, _) = offsets.column_from_x((vp_x + vp_width).max(0.0) as f64);
        let (min_row, _) = offsets.row_from_y(vp_y.max(0.0) as f64);
        let (max_row, _) = offsets.row_from_y((vp_y + vp_height).max(0.0) as f64);

        // Convert to hash coordinates and add padding
        let (min_hash_x, min_hash_y) = get_hash_coords(min_col, min_row);
        let (max_hash_x, max_hash_y) = get_hash_coords(max_col, max_row);

        Self {
            min_hash_x: min_hash_x - HASH_PADDING,
            max_hash_x: max_hash_x + HASH_PADDING,
            min_hash_y: min_hash_y - HASH_PADDING,
            max_hash_y: max_hash_y + HASH_PADDING,
        }
    }

    /// Check if a hash coordinate is within bounds
    #[inline]
    pub fn contains(&self, hash_x: i64, hash_y: i64) -> bool {
        hash_x >= self.min_hash_x
            && hash_x <= self.max_hash_x
            && hash_y >= self.min_hash_y
            && hash_y <= self.max_hash_y
    }

    /// Iterate over all hash coordinates in bounds
    pub fn iter(&self) -> impl Iterator<Item = (i64, i64)> + '_ {
        (self.min_hash_y..=self.max_hash_y)
            .flat_map(move |y| (self.min_hash_x..=self.max_hash_x).map(move |x| (x, y)))
    }

    /// Get the number of hashes in bounds
    pub fn count(&self) -> usize {
        let width = (self.max_hash_x - self.min_hash_x + 1).max(0) as usize;
        let height = (self.max_hash_y - self.min_hash_y + 1).max(0) as usize;
        width * height
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_hash_coords() {
        // 1-indexed coordinates: cols 1-50 → hash 0, cols 51-100 → hash 1
        assert_eq!(get_hash_coords(1, 1), (0, 0));
        assert_eq!(get_hash_coords(50, 100), (0, 0));
        assert_eq!(get_hash_coords(51, 101), (1, 1));
        assert_eq!(get_hash_coords(101, 201), (2, 2));

        // Edge cases for 1-indexed
        assert_eq!(get_hash_coords(0, 0), (-1, -1));
        assert_eq!(get_hash_coords(-49, -99), (-1, -1));
        assert_eq!(get_hash_coords(-50, -100), (-2, -2));
    }

    #[test]
    fn test_hash_key_unique() {
        // Different coordinates should produce different keys
        assert_ne!(hash_key(0, 0), hash_key(0, 1));
        assert_ne!(hash_key(0, 0), hash_key(1, 0));
        assert_ne!(hash_key(1, 2), hash_key(2, 1));
    }

    #[test]
    fn test_visible_bounds_contains() {
        let bounds = VisibleHashBounds {
            min_hash_x: -1,
            max_hash_x: 2,
            min_hash_y: 0,
            max_hash_y: 3,
        };

        assert!(bounds.contains(0, 0));
        assert!(bounds.contains(-1, 0));
        assert!(bounds.contains(2, 3));
        assert!(!bounds.contains(-2, 0));
        assert!(!bounds.contains(0, 4));
    }

    #[test]
    fn test_visible_bounds_count() {
        let bounds = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 2,
            min_hash_y: 0,
            max_hash_y: 1,
        };
        // 3 columns × 2 rows = 6 hashes
        assert_eq!(bounds.count(), 6);
    }
}
