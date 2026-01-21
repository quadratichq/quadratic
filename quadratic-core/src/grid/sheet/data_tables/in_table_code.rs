//! Cache for tracking code cells within data tables.
//!
//! This module provides efficient lookup of code cells that exist within
//! data tables (as opposed to code cells on the sheet grid).

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::{MultiPos, Pos, Rect, TablePos};

/// Cache for tracking code cells within data tables.
///
/// This enables efficient lookup of:
/// - All code cells within a specific table
/// - Whether a position within a table contains a code cell
/// - All code cells across all tables
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct InTableCodeCache {
    /// Maps parent table position -> set of sub-table positions that contain code
    tables_with_code: HashMap<Pos, HashSet<Pos>>,
}

impl InTableCodeCache {
    /// Creates a new empty cache.
    pub fn new() -> Self {
        Self {
            tables_with_code: HashMap::new(),
        }
    }

    /// Checks if there are any code cells in any table.
    pub fn is_empty(&self) -> bool {
        self.tables_with_code.is_empty()
    }

    /// Adds a code cell at the given TablePos.
    pub fn add(&mut self, table_pos: &TablePos) {
        self.tables_with_code
            .entry(table_pos.parent_pos)
            .or_default()
            .insert(table_pos.sub_table_pos);
    }

    /// Removes a code cell at the given TablePos.
    /// Returns true if the cell was present and removed.
    pub fn remove(&mut self, table_pos: &TablePos) -> bool {
        if let Some(code_cells) = self.tables_with_code.get_mut(&table_pos.parent_pos) {
            let removed = code_cells.remove(&table_pos.sub_table_pos);
            if code_cells.is_empty() {
                self.tables_with_code.remove(&table_pos.parent_pos);
            }
            removed
        } else {
            false
        }
    }

    /// Checks if there is a code cell at the given TablePos.
    pub fn contains(&self, table_pos: &TablePos) -> bool {
        self.tables_with_code
            .get(&table_pos.parent_pos)
            .is_some_and(|cells| cells.contains(&table_pos.sub_table_pos))
    }

    /// Checks if there is a code cell at the given MultiPos (only for TablePos variant).
    pub fn contains_multi_pos(&self, multi_pos: &MultiPos) -> bool {
        match multi_pos {
            MultiPos::Pos(_) => false,
            MultiPos::TablePos(table_pos) => self.contains(table_pos),
        }
    }

    /// Returns all code cell positions within the given parent table.
    pub fn code_cells_in_table(&self, parent_pos: &Pos) -> impl Iterator<Item = TablePos> + '_ {
        let parent = *parent_pos;
        self.tables_with_code
            .get(parent_pos)
            .into_iter()
            .flat_map(move |cells| {
                cells
                    .iter()
                    .map(move |sub_pos| TablePos::new(parent, *sub_pos))
            })
    }

    /// Returns all code cell TablePos across all tables.
    pub fn all_code_cells(&self) -> impl Iterator<Item = TablePos> + '_ {
        self.tables_with_code.iter().flat_map(|(parent_pos, cells)| {
            cells
                .iter()
                .map(move |sub_pos| TablePos::new(*parent_pos, *sub_pos))
        })
    }

    /// Returns the number of tables that have code cells.
    pub fn table_count(&self) -> usize {
        self.tables_with_code.len()
    }

    /// Returns the total number of code cells across all tables.
    pub fn code_cell_count(&self) -> usize {
        self.tables_with_code.values().map(|s| s.len()).sum()
    }

    /// Clears all code cells for a specific table.
    /// Returns the set of removed sub-positions, if any.
    pub fn clear_table(&mut self, parent_pos: &Pos) -> Option<HashSet<Pos>> {
        self.tables_with_code.remove(parent_pos)
    }

    /// Returns true if the given table has any code cells.
    pub fn table_has_code(&self, parent_pos: &Pos) -> bool {
        self.tables_with_code.contains_key(parent_pos)
    }

    /// Checks if there are any code cells in tables within the given rect.
    ///
    /// This checks if any parent table position intersects with the rect.
    pub fn has_code_in_rect(&self, rect: Rect) -> bool {
        self.tables_with_code
            .keys()
            .any(|parent_pos| rect.contains(*parent_pos))
    }

    /// Returns all parent table positions that have code cells and intersect with the rect.
    pub fn tables_with_code_in_rect(&self, rect: Rect) -> impl Iterator<Item = Pos> + '_ {
        self.tables_with_code
            .keys()
            .filter(move |parent_pos| rect.contains(**parent_pos))
            .copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_and_contains() {
        let mut cache = InTableCodeCache::new();
        let table_pos = TablePos::from_coords(1, 1, 0, 0);

        assert!(!cache.contains(&table_pos));

        cache.add(&table_pos);
        assert!(cache.contains(&table_pos));
    }

    #[test]
    fn test_remove() {
        let mut cache = InTableCodeCache::new();
        let table_pos = TablePos::from_coords(1, 1, 0, 0);

        cache.add(&table_pos);
        assert!(cache.contains(&table_pos));

        let removed = cache.remove(&table_pos);
        assert!(removed);
        assert!(!cache.contains(&table_pos));

        // Removing again returns false
        let removed = cache.remove(&table_pos);
        assert!(!removed);
    }

    #[test]
    fn test_code_cells_in_table() {
        let mut cache = InTableCodeCache::new();
        let parent = Pos::new(1, 1);

        cache.add(&TablePos::new(parent, Pos::new(0, 0)));
        cache.add(&TablePos::new(parent, Pos::new(1, 0)));
        cache.add(&TablePos::new(parent, Pos::new(0, 1)));

        // Add code cell in different table
        cache.add(&TablePos::from_coords(5, 5, 0, 0));

        let cells: Vec<_> = cache.code_cells_in_table(&parent).collect();
        assert_eq!(cells.len(), 3);
    }

    #[test]
    fn test_all_code_cells() {
        let mut cache = InTableCodeCache::new();

        cache.add(&TablePos::from_coords(1, 1, 0, 0));
        cache.add(&TablePos::from_coords(1, 1, 1, 0));
        cache.add(&TablePos::from_coords(5, 5, 0, 0));

        let all: Vec<_> = cache.all_code_cells().collect();
        assert_eq!(all.len(), 3);
    }

    #[test]
    fn test_clear_table() {
        let mut cache = InTableCodeCache::new();
        let parent = Pos::new(1, 1);

        cache.add(&TablePos::new(parent, Pos::new(0, 0)));
        cache.add(&TablePos::new(parent, Pos::new(1, 0)));
        cache.add(&TablePos::from_coords(5, 5, 0, 0));

        assert_eq!(cache.table_count(), 2);
        assert_eq!(cache.code_cell_count(), 3);

        let cleared = cache.clear_table(&parent);
        assert!(cleared.is_some());
        assert_eq!(cleared.unwrap().len(), 2);

        assert_eq!(cache.table_count(), 1);
        assert_eq!(cache.code_cell_count(), 1);
    }

    #[test]
    fn test_has_code_in_rect() {
        let mut cache = InTableCodeCache::new();

        cache.add(&TablePos::from_coords(5, 5, 0, 0));
        cache.add(&TablePos::from_coords(10, 10, 0, 0));

        // Rect containing first table
        assert!(cache.has_code_in_rect(Rect::new(1, 1, 6, 6)));

        // Rect containing both tables
        assert!(cache.has_code_in_rect(Rect::new(1, 1, 15, 15)));

        // Rect containing neither table
        assert!(!cache.has_code_in_rect(Rect::new(1, 1, 4, 4)));
    }

    #[test]
    fn test_contains_multi_pos() {
        let mut cache = InTableCodeCache::new();
        let table_pos = TablePos::from_coords(1, 1, 0, 0);

        cache.add(&table_pos);

        // TablePos variant should be found
        let multi_table = MultiPos::TablePos(table_pos);
        assert!(cache.contains_multi_pos(&multi_table));

        // Pos variant should never be found (sheet code cells aren't in this cache)
        let multi_pos = MultiPos::Pos(Pos::new(1, 1));
        assert!(!cache.contains_multi_pos(&multi_pos));
    }
}
