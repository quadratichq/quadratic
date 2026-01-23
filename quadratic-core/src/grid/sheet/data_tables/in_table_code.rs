//! Cache for tracking code cells within data tables.
//!
//! This module provides efficient lookup of code cells that exist within
//! data tables (as opposed to code cells on the sheet grid).
//!
//! Note: Nested (in-table) tables cannot have UI elements like table names,
//! column headers, or alternating colors. They exist purely as code outputs
//! within another table's data region.

use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::{MultiPos, Pos, Rect, TablePos};

/// Information about a nested code cell's output bounds.
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct NestedCodeOutput {
    /// The anchor position of the nested code cell within the parent table (data coordinates)
    pub anchor: Pos,
    /// Width of the output in cells
    pub width: u32,
    /// Height of the output in cells
    pub height: u32,
}

impl NestedCodeOutput {
    /// Creates a new NestedCodeOutput with the given anchor and size.
    pub fn new(anchor: Pos, width: u32, height: u32) -> Self {
        Self {
            anchor,
            width,
            height,
        }
    }

    /// Creates a 1x1 output at the given anchor.
    pub fn single_cell(anchor: Pos) -> Self {
        Self::new(anchor, 1, 1)
    }

    /// Returns the output rect within the parent table's data region.
    pub fn output_rect(&self) -> Rect {
        Rect::new(
            self.anchor.x,
            self.anchor.y,
            self.anchor.x + self.width as i64 - 1,
            self.anchor.y + self.height as i64 - 1,
        )
    }

    /// Returns true if this output contains the given position (in data coordinates).
    pub fn contains(&self, pos: Pos) -> bool {
        pos.x >= self.anchor.x
            && pos.x < self.anchor.x + self.width as i64
            && pos.y >= self.anchor.y
            && pos.y < self.anchor.y + self.height as i64
    }

    /// Returns the offset from the anchor to the given position, if contained.
    pub fn offset_from_anchor(&self, pos: Pos) -> Option<(u32, u32)> {
        if self.contains(pos) {
            Some((
                (pos.x - self.anchor.x) as u32,
                (pos.y - self.anchor.y) as u32,
            ))
        } else {
            None
        }
    }
}

/// Cache for tracking code cells within data tables.
///
/// This enables efficient lookup of:
/// - All code cells within a specific table
/// - Whether a position within a table contains a code cell
/// - All code cells across all tables
/// - Which nested code cell covers a given position (for multi-cell outputs)
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct InTableCodeCache {
    /// Maps parent table position -> set of sub-table positions that contain code
    tables_with_code: HashMap<Pos, HashSet<Pos>>,

    /// Maps parent table position -> (anchor position -> output bounds)
    /// This tracks the output bounds of each nested code cell for multi-cell lookups.
    #[serde(default)]
    nested_output_bounds: HashMap<Pos, HashMap<Pos, NestedCodeOutput>>,
}

impl InTableCodeCache {
    /// Creates a new empty cache.
    pub fn new() -> Self {
        Self {
            tables_with_code: HashMap::new(),
            nested_output_bounds: HashMap::new(),
        }
    }

    /// Checks if there are any code cells in any table.
    pub fn is_empty(&self) -> bool {
        self.tables_with_code.is_empty()
    }

    /// Returns an iterator over all parent positions and their code cell positions.
    pub fn iter(&self) -> impl Iterator<Item = (&Pos, &HashSet<Pos>)> {
        self.tables_with_code.iter()
    }

    /// Adds a code cell at the given TablePos with default 1x1 output size.
    pub fn add(&mut self, table_pos: &TablePos) {
        self.tables_with_code
            .entry(table_pos.parent_pos)
            .or_default()
            .insert(table_pos.sub_table_pos);

        // Add default 1x1 output bounds
        self.nested_output_bounds
            .entry(table_pos.parent_pos)
            .or_default()
            .insert(
                table_pos.sub_table_pos,
                NestedCodeOutput::single_cell(table_pos.sub_table_pos),
            );
    }

    /// Adds a code cell at the given TablePos with specified output size.
    pub fn add_with_size(&mut self, table_pos: &TablePos, width: u32, height: u32) {
        self.tables_with_code
            .entry(table_pos.parent_pos)
            .or_default()
            .insert(table_pos.sub_table_pos);

        self.nested_output_bounds
            .entry(table_pos.parent_pos)
            .or_default()
            .insert(
                table_pos.sub_table_pos,
                NestedCodeOutput::new(table_pos.sub_table_pos, width, height),
            );
    }

    /// Updates the output size for an existing code cell.
    /// Returns true if the code cell exists and was updated.
    pub fn update_output_size(&mut self, table_pos: &TablePos, width: u32, height: u32) -> bool {
        if let Some(bounds) = self.nested_output_bounds.get_mut(&table_pos.parent_pos) {
            if let Some(output) = bounds.get_mut(&table_pos.sub_table_pos) {
                output.width = width;
                output.height = height;
                return true;
            }
        }
        false
    }

    /// Returns the output bounds for a code cell at the given TablePos.
    pub fn get_output_bounds(&self, table_pos: &TablePos) -> Option<&NestedCodeOutput> {
        self.nested_output_bounds
            .get(&table_pos.parent_pos)
            .and_then(|bounds| bounds.get(&table_pos.sub_table_pos))
    }

    /// Removes a code cell at the given TablePos.
    /// Returns true if the cell was present and removed.
    pub fn remove(&mut self, table_pos: &TablePos) -> bool {
        // Remove from output bounds
        if let Some(bounds) = self.nested_output_bounds.get_mut(&table_pos.parent_pos) {
            bounds.remove(&table_pos.sub_table_pos);
            if bounds.is_empty() {
                self.nested_output_bounds.remove(&table_pos.parent_pos);
            }
        }

        // Remove from code cells set
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

    /// Finds the code cell whose output covers the given position within a parent table.
    /// Returns the TablePos of the code cell and the offset into its output.
    ///
    /// `data_pos` is the position within the parent table's data region (0-indexed).
    pub fn find_covering_code_cell(
        &self,
        parent_pos: &Pos,
        data_pos: Pos,
    ) -> Option<(TablePos, u32, u32)> {
        let bounds = self.nested_output_bounds.get(parent_pos)?;

        for (anchor, output) in bounds.iter() {
            if let Some((offset_x, offset_y)) = output.offset_from_anchor(data_pos) {
                return Some((TablePos::new(*parent_pos, *anchor), offset_x, offset_y));
            }
        }
        None
    }

    /// Returns all output bounds for code cells within a parent table.
    pub fn output_bounds_in_table(
        &self,
        parent_pos: &Pos,
    ) -> impl Iterator<Item = (&Pos, &NestedCodeOutput)> {
        self.nested_output_bounds
            .get(parent_pos)
            .into_iter()
            .flat_map(|bounds| bounds.iter())
    }

    /// Checks if there are any overlapping code cell outputs within a parent table.
    /// Returns the positions of overlapping code cells if any.
    pub fn find_overlapping_outputs(&self, parent_pos: &Pos) -> Vec<(Pos, Pos)> {
        let Some(bounds) = self.nested_output_bounds.get(parent_pos) else {
            return Vec::new();
        };

        let outputs: Vec<_> = bounds.iter().collect();
        let mut overlaps = Vec::new();

        for i in 0..outputs.len() {
            for j in (i + 1)..outputs.len() {
                let (anchor1, output1) = outputs[i];
                let (anchor2, output2) = outputs[j];

                if output1.output_rect().intersects(output2.output_rect()) {
                    overlaps.push((*anchor1, *anchor2));
                }
            }
        }

        overlaps
    }

    /// Checks if adding a code cell with the given output size would overlap with existing outputs.
    pub fn would_overlap(
        &self,
        table_pos: &TablePos,
        width: u32,
        height: u32,
    ) -> Option<Pos> {
        let Some(bounds) = self.nested_output_bounds.get(&table_pos.parent_pos) else {
            return None;
        };

        let new_rect = Rect::new(
            table_pos.sub_table_pos.x,
            table_pos.sub_table_pos.y,
            table_pos.sub_table_pos.x + width as i64 - 1,
            table_pos.sub_table_pos.y + height as i64 - 1,
        );

        for (anchor, output) in bounds.iter() {
            // Skip self
            if *anchor == table_pos.sub_table_pos {
                continue;
            }

            if output.output_rect().intersects(new_rect) {
                return Some(*anchor);
            }
        }

        None
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
        self.nested_output_bounds.remove(parent_pos);
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

    #[test]
    fn test_add_with_size() {
        let mut cache = InTableCodeCache::new();
        let table_pos = TablePos::from_coords(1, 1, 0, 0);

        cache.add_with_size(&table_pos, 3, 2);

        assert!(cache.contains(&table_pos));

        let bounds = cache.get_output_bounds(&table_pos).unwrap();
        assert_eq!(bounds.width, 3);
        assert_eq!(bounds.height, 2);
        assert_eq!(bounds.anchor, Pos::new(0, 0));
    }

    #[test]
    fn test_update_output_size() {
        let mut cache = InTableCodeCache::new();
        let table_pos = TablePos::from_coords(1, 1, 0, 0);

        cache.add(&table_pos);

        // Default is 1x1
        let bounds = cache.get_output_bounds(&table_pos).unwrap();
        assert_eq!(bounds.width, 1);
        assert_eq!(bounds.height, 1);

        // Update to 3x2
        assert!(cache.update_output_size(&table_pos, 3, 2));

        let bounds = cache.get_output_bounds(&table_pos).unwrap();
        assert_eq!(bounds.width, 3);
        assert_eq!(bounds.height, 2);
    }

    #[test]
    fn test_find_covering_code_cell() {
        let mut cache = InTableCodeCache::new();
        let parent = Pos::new(1, 1);

        // Add a 3x2 code cell at (0, 0)
        let table_pos = TablePos::new(parent, Pos::new(0, 0));
        cache.add_with_size(&table_pos, 3, 2);

        // Position (0, 0) should be covered
        let result = cache.find_covering_code_cell(&parent, Pos::new(0, 0));
        assert!(result.is_some());
        let (found_pos, offset_x, offset_y) = result.unwrap();
        assert_eq!(found_pos.sub_table_pos, Pos::new(0, 0));
        assert_eq!(offset_x, 0);
        assert_eq!(offset_y, 0);

        // Position (2, 1) should be covered (offset 2, 1)
        let result = cache.find_covering_code_cell(&parent, Pos::new(2, 1));
        assert!(result.is_some());
        let (found_pos, offset_x, offset_y) = result.unwrap();
        assert_eq!(found_pos.sub_table_pos, Pos::new(0, 0));
        assert_eq!(offset_x, 2);
        assert_eq!(offset_y, 1);

        // Position (3, 0) should NOT be covered (outside width)
        let result = cache.find_covering_code_cell(&parent, Pos::new(3, 0));
        assert!(result.is_none());

        // Position (0, 2) should NOT be covered (outside height)
        let result = cache.find_covering_code_cell(&parent, Pos::new(0, 2));
        assert!(result.is_none());
    }

    #[test]
    fn test_find_overlapping_outputs() {
        let mut cache = InTableCodeCache::new();
        let parent = Pos::new(1, 1);

        // Add a 3x2 code cell at (0, 0)
        cache.add_with_size(&TablePos::new(parent, Pos::new(0, 0)), 3, 2);

        // Add a 2x2 code cell at (5, 5) - no overlap
        cache.add_with_size(&TablePos::new(parent, Pos::new(5, 5)), 2, 2);

        // No overlaps
        let overlaps = cache.find_overlapping_outputs(&parent);
        assert!(overlaps.is_empty());

        // Add a 2x2 code cell at (2, 1) - overlaps with first
        cache.add_with_size(&TablePos::new(parent, Pos::new(2, 1)), 2, 2);

        let overlaps = cache.find_overlapping_outputs(&parent);
        assert_eq!(overlaps.len(), 1);
    }

    #[test]
    fn test_would_overlap() {
        let mut cache = InTableCodeCache::new();
        let parent = Pos::new(1, 1);

        // Add a 3x2 code cell at (0, 0)
        cache.add_with_size(&TablePos::new(parent, Pos::new(0, 0)), 3, 2);

        // Check if adding at (5, 5) would overlap - should not
        let result = cache.would_overlap(&TablePos::new(parent, Pos::new(5, 5)), 2, 2);
        assert!(result.is_none());

        // Check if adding at (2, 1) would overlap - should overlap
        let result = cache.would_overlap(&TablePos::new(parent, Pos::new(2, 1)), 2, 2);
        assert_eq!(result, Some(Pos::new(0, 0)));
    }

    #[test]
    fn test_nested_code_output_rect() {
        let output = NestedCodeOutput::new(Pos::new(2, 3), 4, 5);
        let rect = output.output_rect();
        assert_eq!(rect.min, Pos::new(2, 3));
        assert_eq!(rect.max, Pos::new(5, 7));
    }

    #[test]
    fn test_nested_code_output_contains() {
        let output = NestedCodeOutput::new(Pos::new(2, 3), 4, 5);

        // Should contain positions within the rect
        assert!(output.contains(Pos::new(2, 3)));
        assert!(output.contains(Pos::new(5, 7)));
        assert!(output.contains(Pos::new(3, 5)));

        // Should not contain positions outside the rect
        assert!(!output.contains(Pos::new(1, 3)));
        assert!(!output.contains(Pos::new(2, 2)));
        assert!(!output.contains(Pos::new(6, 3)));
        assert!(!output.contains(Pos::new(2, 8)));
    }

    #[test]
    fn test_nested_code_output_offset() {
        let output = NestedCodeOutput::new(Pos::new(2, 3), 4, 5);

        // Should return correct offsets for positions within the rect
        assert_eq!(output.offset_from_anchor(Pos::new(2, 3)), Some((0, 0)));
        assert_eq!(output.offset_from_anchor(Pos::new(5, 7)), Some((3, 4)));
        assert_eq!(output.offset_from_anchor(Pos::new(3, 5)), Some((1, 2)));

        // Should return None for positions outside the rect
        assert_eq!(output.offset_from_anchor(Pos::new(1, 3)), None);
        assert_eq!(output.offset_from_anchor(Pos::new(6, 3)), None);
    }

    #[test]
    fn test_multiple_non_overlapping_outputs() {
        let mut cache = InTableCodeCache::new();
        let parent = Pos::new(0, 0);

        // Add 3 code cells in a row (each 2x2)
        cache.add_with_size(&TablePos::new(parent, Pos::new(0, 0)), 2, 2);
        cache.add_with_size(&TablePos::new(parent, Pos::new(3, 0)), 2, 2);
        cache.add_with_size(&TablePos::new(parent, Pos::new(6, 0)), 2, 2);

        // No overlaps
        let overlaps = cache.find_overlapping_outputs(&parent);
        assert!(overlaps.is_empty());

        // Each position should be found by the correct code cell
        let result = cache.find_covering_code_cell(&parent, Pos::new(0, 0));
        assert_eq!(result.unwrap().0.sub_table_pos, Pos::new(0, 0));

        let result = cache.find_covering_code_cell(&parent, Pos::new(3, 1));
        assert_eq!(result.unwrap().0.sub_table_pos, Pos::new(3, 0));

        let result = cache.find_covering_code_cell(&parent, Pos::new(7, 1));
        assert_eq!(result.unwrap().0.sub_table_pos, Pos::new(6, 0));

        // Gap position should not be covered
        let result = cache.find_covering_code_cell(&parent, Pos::new(2, 0));
        assert!(result.is_none());
    }

    #[test]
    fn test_cache_iter() {
        let mut cache = InTableCodeCache::new();
        let parent1 = Pos::new(1, 1);
        let parent2 = Pos::new(10, 10);

        cache.add_with_size(&TablePos::new(parent1, Pos::new(0, 0)), 2, 2);
        cache.add_with_size(&TablePos::new(parent1, Pos::new(5, 5)), 3, 3);
        cache.add_with_size(&TablePos::new(parent2, Pos::new(0, 0)), 1, 1);

        let entries: Vec<_> = cache.iter().collect();
        assert_eq!(entries.len(), 2);

        // Check parent1 has 2 code cells
        let parent1_codes = entries.iter().find(|(p, _)| **p == parent1);
        assert!(parent1_codes.is_some());
        assert_eq!(parent1_codes.unwrap().1.len(), 2);

        // Check parent2 has 1 code cell
        let parent2_codes = entries.iter().find(|(p, _)| **p == parent2);
        assert!(parent2_codes.is_some());
        assert_eq!(parent2_codes.unwrap().1.len(), 1);
    }
}
