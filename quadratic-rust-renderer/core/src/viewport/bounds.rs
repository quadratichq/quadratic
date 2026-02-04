//! Viewport bounds types

use crate::constants::{HASH_HEIGHT, HASH_PADDING, HASH_WIDTH};

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_visible_bounds_default() {
        let bounds = VisibleBounds::default();
        assert_eq!(bounds.left, 0.0);
        assert_eq!(bounds.top, 0.0);
        assert_eq!(bounds.width, 0.0);
        assert_eq!(bounds.height, 0.0);
    }

    #[test]
    fn test_visible_bounds_creation() {
        let bounds = VisibleBounds {
            left: 10.0,
            top: 20.0,
            right: 110.0,
            bottom: 120.0,
            width: 100.0,
            height: 100.0,
        };

        assert_eq!(bounds.left, 10.0);
        assert_eq!(bounds.top, 20.0);
        assert_eq!(bounds.right, 110.0);
        assert_eq!(bounds.bottom, 120.0);
    }

    #[test]
    fn test_visible_hash_bounds_default() {
        let bounds = VisibleHashBounds::default();
        assert_eq!(bounds.min_hash_x, 0);
        assert_eq!(bounds.max_hash_x, 0);
        assert_eq!(bounds.min_hash_y, 0);
        assert_eq!(bounds.max_hash_y, 0);
    }

    #[test]
    fn test_visible_hash_bounds_contains() {
        let bounds = VisibleHashBounds {
            min_hash_x: -1,
            max_hash_x: 2,
            min_hash_y: 0,
            max_hash_y: 3,
        };

        // Inside bounds
        assert!(bounds.contains(0, 0));
        assert!(bounds.contains(-1, 0));
        assert!(bounds.contains(2, 3));
        assert!(bounds.contains(1, 2));

        // Outside bounds
        assert!(!bounds.contains(-2, 0));
        assert!(!bounds.contains(3, 0));
        assert!(!bounds.contains(0, -1));
        assert!(!bounds.contains(0, 4));
    }

    #[test]
    fn test_visible_hash_bounds_iter() {
        let bounds = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 1,
            min_hash_y: 0,
            max_hash_y: 1,
        };

        let coords: Vec<_> = bounds.iter().collect();
        assert_eq!(coords.len(), 4);
        assert!(coords.contains(&(0, 0)));
        assert!(coords.contains(&(1, 0)));
        assert!(coords.contains(&(0, 1)));
        assert!(coords.contains(&(1, 1)));
    }

    #[test]
    fn test_visible_hash_bounds_count() {
        let bounds = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 2,
            min_hash_y: 0,
            max_hash_y: 1,
        };
        // 3 columns × 2 rows = 6 hashes
        assert_eq!(bounds.count(), 6);
    }

    #[test]
    fn test_visible_hash_bounds_count_single() {
        let bounds = VisibleHashBounds {
            min_hash_x: 5,
            max_hash_x: 5,
            min_hash_y: 3,
            max_hash_y: 3,
        };
        assert_eq!(bounds.count(), 1);
    }

    #[test]
    fn test_visible_hash_bounds_count_empty() {
        let bounds = VisibleHashBounds {
            min_hash_x: 5,
            max_hash_x: 3, // max < min
            min_hash_y: 0,
            max_hash_y: 1,
        };
        assert_eq!(bounds.count(), 0);
    }

    #[test]
    fn test_visible_hash_bounds_from_cells() {
        // Cells 1-50 should be in hash 0, cells 51-100 in hash 1
        let bounds = VisibleHashBounds::from_cells(1, 50, 1, 100);

        // With HASH_PADDING, bounds expand by that amount
        assert!(bounds.min_hash_x <= 0);
        assert!(bounds.max_hash_x >= 0);
        assert!(bounds.min_hash_y <= 0);
        assert!(bounds.max_hash_y >= 0);
    }

    #[test]
    fn test_visible_hash_bounds_from_cells_larger_range() {
        let bounds = VisibleHashBounds::from_cells(1, 200, 1, 300);

        // Should cover multiple hashes
        assert!(bounds.max_hash_x > bounds.min_hash_x);
        assert!(bounds.max_hash_y > bounds.min_hash_y);
    }

    #[test]
    fn test_visible_hash_bounds_iter_empty() {
        let bounds = VisibleHashBounds {
            min_hash_x: 5,
            max_hash_x: 3,
            min_hash_y: 0,
            max_hash_y: 1,
        };

        let coords: Vec<_> = bounds.iter().collect();
        assert!(coords.is_empty());
    }

    #[test]
    fn test_visible_hash_bounds_equality() {
        let bounds1 = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 2,
            min_hash_y: 0,
            max_hash_y: 1,
        };
        let bounds2 = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 2,
            min_hash_y: 0,
            max_hash_y: 1,
        };
        let bounds3 = VisibleHashBounds {
            min_hash_x: 0,
            max_hash_x: 3,
            min_hash_y: 0,
            max_hash_y: 1,
        };

        assert_eq!(bounds1, bounds2);
        assert_ne!(bounds1, bounds3);
    }
}
