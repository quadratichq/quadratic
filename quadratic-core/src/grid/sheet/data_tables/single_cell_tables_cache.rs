//! Cache for single-cell data tables using HashSet for O(1) point lookups
//! and R-tree for O(log n) spatial queries.

use std::collections::HashSet;

use crate::{Pos, Rect, a1::RefRangeBounds};

use rstar::{RTree, RTreeObject, primitives::GeomWithData};
use serde::{Deserialize, Serialize};

/// Cache for single-cell data tables using HashSet for O(1) point lookups
/// and R-tree for O(log n) spatial queries.
#[derive(Debug, Clone, Default)]
pub struct SingleCellTablesCache {
    /// HashSet for O(1) point operations (get, insert, remove)
    tables: HashSet<Pos>,
    /// R-tree for O(log n) spatial queries (intersects, nondefault_rects_in_rect)
    spatial_index: RTree<GeomWithData<Rect, Pos>>,
}

impl SingleCellTablesCache {
    pub fn new() -> Self {
        Self {
            tables: HashSet::new(),
            spatial_index: RTree::new(),
        }
    }

    /// Sets or removes a single-cell table at the given position.
    /// If value is Some, adds the position. If None, removes it.
    pub fn set(&mut self, pos: Pos, value: Option<bool>) {
        if value.is_some() {
            if self.tables.insert(pos) {
                // Only update R-tree if this is a new entry
                self.spatial_index
                    .insert(GeomWithData::new(Rect::single_pos(pos), pos));
            }
        } else if self.tables.remove(&pos) {
            // Only update R-tree if we actually removed something
            self.spatial_index
                .remove(&GeomWithData::new(Rect::single_pos(pos), pos));
        }
    }

    /// Returns Some(true) if there's a single-cell table at this position.
    pub fn get(&self, pos: Pos) -> Option<bool> {
        if self.tables.contains(&pos) {
            Some(true)
        } else {
            None
        }
    }

    /// Returns the minimum row index in the given column, or 0 if none.
    pub fn col_min(&self, column: i64) -> i64 {
        self.tables
            .iter()
            .filter(|p| p.x == column)
            .map(|p| p.y)
            .min()
            .unwrap_or(0)
    }

    /// Returns the maximum row index in the given column, or 0 if none.
    pub fn col_max(&self, column: i64) -> i64 {
        self.tables
            .iter()
            .filter(|p| p.x == column)
            .map(|p| p.y)
            .max()
            .unwrap_or(0)
    }

    /// Returns the minimum column index in the given row, or 0 if none.
    pub fn row_min(&self, row: i64) -> i64 {
        self.tables
            .iter()
            .filter(|p| p.y == row)
            .map(|p| p.x)
            .min()
            .unwrap_or(0)
    }

    /// Returns the maximum column index in the given row, or 0 if none.
    pub fn row_max(&self, row: i64) -> i64 {
        self.tables
            .iter()
            .filter(|p| p.y == row)
            .map(|p| p.x)
            .max()
            .unwrap_or(0)
    }

    /// Returns the bounding rectangle of all single-cell tables, or None if empty.
    /// Uses the R-tree's cached envelope for O(1) performance.
    pub fn finite_bounds(&self) -> Option<Rect> {
        if self.tables.is_empty() {
            return None;
        }
        // The R-tree root envelope contains the bounding box of all elements - O(1)
        let envelope = self.spatial_index.root().envelope();
        Some(Rect::new(
            envelope.lower().x,
            envelope.lower().y,
            envelope.upper().x,
            envelope.upper().y,
        ))
    }

    /// Returns true if there are no single-cell tables in the given rectangle.
    pub fn is_all_default_in_rect(&self, rect: Rect) -> bool {
        self.spatial_index
            .locate_in_envelope_intersecting(&rect.envelope())
            .next()
            .is_none()
    }

    /// Returns true if any single-cell table intersects the given rectangle.
    pub fn intersects(&self, rect: Rect) -> bool {
        self.spatial_index
            .locate_in_envelope_intersecting(&rect.envelope())
            .next()
            .is_some()
    }

    /// Returns an iterator over positions in the given rectangle.
    pub fn nondefault_rects_in_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Option<bool>)> + '_ {
        self.spatial_index
            .locate_in_envelope_intersecting(&rect.envelope())
            .map(|obj| (Rect::single_pos(obj.data), Some(true)))
    }

    /// Returns an iterator over positions in the given range.
    pub fn nondefault_rects_in_range(
        &self,
        range: RefRangeBounds,
    ) -> impl Iterator<Item = (Rect, Option<bool>)> + '_ {
        // Use the R-tree with the unbounded rect, then filter by the range
        let rect = range.to_rect_unbounded();
        self.spatial_index
            .locate_in_envelope_intersecting(&rect.envelope())
            .filter(move |obj| range.contains_pos(obj.data))
            .map(|obj| (Rect::single_pos(obj.data), Some(true)))
    }
}

impl PartialEq for SingleCellTablesCache {
    fn eq(&self, other: &Self) -> bool {
        self.tables == other.tables
    }
}

impl Serialize for SingleCellTablesCache {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        // Serialize just the positions; R-tree will be rebuilt on deserialize
        let positions: Vec<Pos> = self.tables.iter().copied().collect();
        positions.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for SingleCellTablesCache {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let positions = Vec::<Pos>::deserialize(deserializer)?;
        let mut cache = Self::new();
        for pos in positions {
            cache.set(pos, Some(true));
        }
        Ok(cache)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_cache() -> SingleCellTablesCache {
        let mut cache = SingleCellTablesCache::new();
        // Add some test positions:
        // (1,1), (1,5), (3,2), (5,5), (10,10)
        cache.set(Pos::new(1, 1), Some(true));
        cache.set(Pos::new(1, 5), Some(true));
        cache.set(Pos::new(3, 2), Some(true));
        cache.set(Pos::new(5, 5), Some(true));
        cache.set(Pos::new(10, 10), Some(true));
        cache
    }

    #[test]
    fn test_new() {
        let cache = SingleCellTablesCache::new();
        assert!(cache.tables.is_empty());
    }

    #[test]
    fn test_set_and_get() {
        let mut cache = SingleCellTablesCache::new();

        // Test adding
        cache.set(Pos::new(1, 1), Some(true));
        assert_eq!(cache.get(Pos::new(1, 1)), Some(true));
        assert_eq!(cache.get(Pos::new(2, 2)), None);

        // Test removing
        cache.set(Pos::new(1, 1), None);
        assert_eq!(cache.get(Pos::new(1, 1)), None);

        // Test double add (should be idempotent)
        cache.set(Pos::new(3, 3), Some(true));
        cache.set(Pos::new(3, 3), Some(true));
        assert_eq!(cache.get(Pos::new(3, 3)), Some(true));

        // Test double remove (should be idempotent)
        cache.set(Pos::new(3, 3), None);
        cache.set(Pos::new(3, 3), None);
        assert_eq!(cache.get(Pos::new(3, 3)), None);
    }

    #[test]
    fn test_col_min_max() {
        let cache = create_test_cache();

        // Column 1 has (1,1) and (1,5)
        assert_eq!(cache.col_min(1), 1);
        assert_eq!(cache.col_max(1), 5);

        // Column 3 has only (3,2)
        assert_eq!(cache.col_min(3), 2);
        assert_eq!(cache.col_max(3), 2);

        // Column 5 has only (5,5)
        assert_eq!(cache.col_min(5), 5);
        assert_eq!(cache.col_max(5), 5);

        // Column 2 has nothing
        assert_eq!(cache.col_min(2), 0);
        assert_eq!(cache.col_max(2), 0);
    }

    #[test]
    fn test_row_min_max() {
        let cache = create_test_cache();

        // Row 1 has (1,1)
        assert_eq!(cache.row_min(1), 1);
        assert_eq!(cache.row_max(1), 1);

        // Row 5 has (1,5) and (5,5)
        assert_eq!(cache.row_min(5), 1);
        assert_eq!(cache.row_max(5), 5);

        // Row 2 has (3,2)
        assert_eq!(cache.row_min(2), 3);
        assert_eq!(cache.row_max(2), 3);

        // Row 3 has nothing
        assert_eq!(cache.row_min(3), 0);
        assert_eq!(cache.row_max(3), 0);
    }

    #[test]
    fn test_finite_bounds() {
        let cache = create_test_cache();

        // Bounds should be from (1,1) to (10,10)
        let bounds = cache.finite_bounds().unwrap();
        assert_eq!(bounds.min.x, 1);
        assert_eq!(bounds.min.y, 1);
        assert_eq!(bounds.max.x, 10);
        assert_eq!(bounds.max.y, 10);

        // Empty cache should return None
        let empty_cache = SingleCellTablesCache::new();
        assert_eq!(empty_cache.finite_bounds(), None);
    }

    #[test]
    fn test_is_all_default_in_rect() {
        let cache = create_test_cache();

        // Rect containing (1,1) should not be all default
        assert!(!cache.is_all_default_in_rect(Rect::new(1, 1, 2, 2)));

        // Rect not containing any positions should be all default
        assert!(cache.is_all_default_in_rect(Rect::new(6, 1, 9, 4)));

        // Rect containing multiple positions
        assert!(!cache.is_all_default_in_rect(Rect::new(1, 1, 10, 10)));
    }

    #[test]
    fn test_intersects() {
        let cache = create_test_cache();

        // Rect containing (1,1) should intersect
        assert!(cache.intersects(Rect::new(1, 1, 2, 2)));

        // Rect not containing any positions should not intersect
        assert!(!cache.intersects(Rect::new(6, 1, 9, 4)));

        // Rect containing multiple positions
        assert!(cache.intersects(Rect::new(1, 1, 10, 10)));
    }

    #[test]
    fn test_nondefault_rects_in_rect() {
        let cache = create_test_cache();

        // Get all positions in rect (1,1) to (5,5)
        let rects: Vec<_> = cache
            .nondefault_rects_in_rect(Rect::new(1, 1, 5, 5))
            .collect();
        assert_eq!(rects.len(), 4); // (1,1), (1,5), (3,2), (5,5)

        // Get positions in rect (1,1) to (2,2)
        let rects: Vec<_> = cache
            .nondefault_rects_in_rect(Rect::new(1, 1, 2, 2))
            .collect();
        assert_eq!(rects.len(), 1); // (1,1)

        // Get positions in empty rect
        let rects: Vec<_> = cache
            .nondefault_rects_in_rect(Rect::new(100, 100, 200, 200))
            .collect();
        assert_eq!(rects.len(), 0);
    }

    #[test]
    fn test_nondefault_rects_in_range() {
        let cache = create_test_cache();

        // Test finite range
        let range = RefRangeBounds::new_relative(1, 1, 5, 5);
        let rects: Vec<_> = cache.nondefault_rects_in_range(range).collect();
        assert_eq!(rects.len(), 4); // (1,1), (1,5), (3,2), (5,5)

        // Test column range (all rows in column 1)
        let range = RefRangeBounds::new_relative_col(1);
        let rects: Vec<_> = cache.nondefault_rects_in_range(range).collect();
        assert_eq!(rects.len(), 2); // (1,1), (1,5)

        // Test row range (all columns in row 5)
        let range = RefRangeBounds::new_relative_row(5);
        let rects: Vec<_> = cache.nondefault_rects_in_range(range).collect();
        assert_eq!(rects.len(), 2); // (1,5), (5,5)
    }

    #[test]
    fn test_serialization() {
        let cache = create_test_cache();

        // Serialize
        let serialized = serde_json::to_string(&cache).unwrap();

        // Deserialize
        let deserialized: SingleCellTablesCache = serde_json::from_str(&serialized).unwrap();

        // Verify equality (based on tables HashSet)
        assert_eq!(cache, deserialized);

        // Verify that spatial queries still work after deserialization
        assert!(deserialized.intersects(Rect::new(1, 1, 2, 2)));
        assert_eq!(deserialized.get(Pos::new(1, 1)), Some(true));
    }

    #[test]
    fn test_partial_eq() {
        let cache1 = create_test_cache();
        let cache2 = create_test_cache();

        assert_eq!(cache1, cache2);

        let mut cache3 = create_test_cache();
        cache3.set(Pos::new(100, 100), Some(true));
        assert_ne!(cache1, cache3);
    }

    #[test]
    fn test_rtree_consistency() {
        let mut cache = SingleCellTablesCache::new();

        // Add positions
        cache.set(Pos::new(1, 1), Some(true));
        cache.set(Pos::new(2, 2), Some(true));

        // Verify R-tree is consistent with HashSet
        assert!(cache.intersects(Rect::new(1, 1, 1, 1)));
        assert!(cache.intersects(Rect::new(2, 2, 2, 2)));

        // Remove one position
        cache.set(Pos::new(1, 1), None);

        // R-tree should be updated
        assert!(!cache.intersects(Rect::new(1, 1, 1, 1)));
        assert!(cache.intersects(Rect::new(2, 2, 2, 2)));

        // Add the same position again
        cache.set(Pos::new(1, 1), Some(true));
        assert!(cache.intersects(Rect::new(1, 1, 1, 1)));
    }
}
