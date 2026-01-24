//! Viewport bounds types

use crate::types::{HASH_HEIGHT, HASH_PADDING, HASH_WIDTH};

/// Visible bounds in world coordinates
#[derive(Debug, Clone, Copy, Default)]
pub struct VisibleBounds {
    pub left: f32,
    pub top: f32,
    pub width: f32,
    pub height: f32,
    pub right: f32,
    pub bottom: f32,
}

/// Represents the range of visible hashes (inclusive bounds)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct VisibleHashBounds {
    pub min_hash_x: i64,
    pub max_hash_x: i64,
    pub min_hash_y: i64,
    pub max_hash_y: i64,
}

impl VisibleHashBounds {
    /// Check if a hash coordinate is within bounds
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

    /// Create hash bounds from cell bounds
    pub fn from_cells(min_col: i64, max_col: i64, min_row: i64, max_row: i64) -> Self {
        let min_hash_x = (min_col - 1).div_euclid(HASH_WIDTH);
        let max_hash_x = (max_col - 1).div_euclid(HASH_WIDTH);
        let min_hash_y = (min_row - 1).div_euclid(HASH_HEIGHT);
        let max_hash_y = (max_row - 1).div_euclid(HASH_HEIGHT);

        Self {
            min_hash_x: min_hash_x - HASH_PADDING,
            max_hash_x: max_hash_x + HASH_PADDING,
            min_hash_y: min_hash_y - HASH_PADDING,
            max_hash_y: max_hash_y + HASH_PADDING,
        }
    }
}
