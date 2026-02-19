use std::collections::HashSet;

use crate::{
    ClearOption, Pos, Rect,
    grid::{Contiguous2D, Sheet},
};
use serde::{Deserialize, Serialize};

pub(crate) type MergeCellsType = Contiguous2D<Option<Pos>>;
pub(crate) type MergeCellsUpdate = Contiguous2D<Option<ClearOption<Pos>>>;

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
pub struct MergeCells {
    merge_cells: MergeCellsType,
}

impl MergeCells {
    /// creates a new MergeCells from an imported MergeCellsType
    pub fn import(merge_cells: MergeCellsType) -> Self {
        MergeCells { merge_cells }
    }

    /// Prepares a MergeCellsType for serialization
    pub fn export(&self) -> &Contiguous2D<Option<Pos>> {
        &self.merge_cells
    }

    /// Updates the MergeCells with the given MergeCellsUpdate
    pub fn merge_cells_update(
        &mut self,
        merge_cells_updates: MergeCellsUpdate,
    ) -> MergeCellsUpdate {
        self.merge_cells
            .set_from(
                &merge_cells_updates.map_ref(|value| value.as_ref().map(|value| (*value).into())),
            )
            .map_ref(|value| value.as_ref().map(|value| (*value).into()))
    }

    pub fn merge_cells(&mut self, rect: Rect) -> MergeCellsUpdate {
        let mut update = Contiguous2D::new();
        update.set_rect(
            rect.min.x,
            rect.min.y,
            Some(rect.max.x),
            Some(rect.max.y),
            Some(ClearOption::Some(rect.min)),
        );
        self.merge_cells
            .set_from(&update.map_ref(|value| value.as_ref().map(|value| (*value).into())))
            .map_ref(|value| value.as_ref().map(|value| (*value).into()))
    }

    pub fn unmerge_cells(&mut self, rect: Rect) -> MergeCellsUpdate {
        let mut update = Contiguous2D::new();
        update.set_rect(
            rect.min.x,
            rect.min.y,
            Some(rect.max.x),
            Some(rect.max.y),
            Some(ClearOption::Clear),
        );
        self.merge_cells
            .set_from(&update.map_ref(|value| value.as_ref().map(|value| (*value).into())))
            .map_ref(|value| value.as_ref().map(|value| (*value).into()))
    }

    /// Returns true if the given position is part of a merged cell.
    pub fn is_merge_cell(&self, pos: Pos) -> bool {
        self.merge_cells.get(pos).is_some()
    }

    /// Returns the anchor position if this cell is part of a merged cell,
    /// otherwise returns None
    pub fn get_anchor(&self, pos: Pos) -> Option<Pos> {
        self.merge_cells.get(pos)
    }

    /// Returns the rects that are part of merged cells within a given rect.
    /// Returns the FULL merged cell rects, even if only a portion of the
    /// merged cell overlaps with the query rect.
    pub fn get_merge_cells(&self, rect: Rect) -> Vec<Rect> {
        // First, find all unique anchors for cells within the rect
        let anchors: HashSet<Pos> = self
            .merge_cells
            .nondefault_rects_in_rect_combined(rect)
            .into_iter()
            .filter_map(|(_, anchor)| anchor)
            .collect();

        // Then, get the full merged cell rect for each anchor
        anchors
            .into_iter()
            .filter_map(|anchor| self.get_merge_cell_rect(anchor))
            .collect()
    }

    /// Returns the merge cell rect that contains the given position, if any.
    /// The anchor (top-left corner) is at rect.min.
    pub fn get_merge_cell_rect(&self, pos: Pos) -> Option<Rect> {
        // Get the anchor position for this cell
        let anchor = self.merge_cells.get(pos)?;

        // Get max_y directly from the Y block containing the anchor.
        // Since merged cells are rectangular and Contiguous2D is column-oriented,
        // all cells in the same column with the same anchor share a Y block.
        let (_, max_y, _) = self.merge_cells.get_y_block_bounds(anchor)?;

        // Find max_x by walking right from anchor. For each neighbor column,
        // check that its Y block has the same anchor value before including it.
        let mut max_x = anchor.x;
        while let Some((_, _, block_value)) = self.merge_cells.get_y_block_bounds(Pos {
            x: max_x + 1,
            y: anchor.y,
        }) {
            if block_value != Some(anchor) {
                break;
            }
            max_x += 1;
        }

        Some(Rect::new(anchor.x, anchor.y, max_x, max_y))
    }

    /// Returns an iterator over all merge cell rects in the sheet.
    /// Each rect represents a merged cell, with the anchor (top-left corner) at rect.min.
    pub fn iter_merge_cells(&self) -> impl Iterator<Item = Rect> + '_ {
        self.merge_cells
            .nondefault_rects_all_combined()
            .map(|(rect, _)| rect)
    }

    /// Adjusts merge cells when a column is inserted.
    /// - Merges at or after the column end: no change
    /// - Merges at or before the column start: shift right by 1
    /// - Merges strictly spanning the column: expand by 1
    ///
    /// Returns all affected rects (old and new positions) for dirty tracking.
    pub fn insert_column(&mut self, column: i64) -> Vec<Rect> {
        // Collect all merge rects before modification
        let merge_rects: Vec<Rect> = self.iter_merge_cells().collect();

        if merge_rects.is_empty() {
            return vec![];
        }

        // Clear all existing merges
        for rect in &merge_rects {
            self.unmerge_cells(*rect);
        }

        // Re-create merges with adjusted positions
        let mut affected_rects = merge_rects.clone();
        for rect in merge_rects {
            let new_rect = if column > rect.max.x {
                // Insertion is at or past the merge end - no change
                rect
            } else if column <= rect.min.x {
                // Insertion is at or before the merge start - shift right
                Rect::new(rect.min.x + 1, rect.min.y, rect.max.x + 1, rect.max.y)
            } else {
                // Insertion is strictly inside the merge - expand
                Rect::new(rect.min.x, rect.min.y, rect.max.x + 1, rect.max.y)
            };
            self.merge_cells(new_rect);
            affected_rects.push(new_rect);
        }
        affected_rects
    }

    /// Adjusts merge cells when a column is removed.
    /// - Merges entirely before the column: no change
    /// - Merges entirely after the column: shift left by 1
    /// - Merges spanning the column: shrink by 1 (or delete if becomes empty)
    ///
    /// Returns all affected rects (old and new positions) for dirty tracking.
    pub fn remove_column(&mut self, column: i64) -> Vec<Rect> {
        // Collect all merge rects before modification
        let merge_rects: Vec<Rect> = self.iter_merge_cells().collect();

        if merge_rects.is_empty() {
            return vec![];
        }

        // Clear all existing merges
        for rect in &merge_rects {
            self.unmerge_cells(*rect);
        }

        // Re-create merges with adjusted positions
        let mut affected_rects = merge_rects.clone();
        for rect in merge_rects {
            if rect.max.x < column {
                // Merge is entirely before the deletion point - no change
                self.merge_cells(rect);
            } else if rect.min.x > column {
                // Merge is entirely after the deletion point - shift left
                let new_rect = Rect::new(rect.min.x - 1, rect.min.y, rect.max.x - 1, rect.max.y);
                self.merge_cells(new_rect);
                affected_rects.push(new_rect);
            } else {
                // Deletion is inside the merge - shrink
                // Only re-create if the merge still has width > 0
                if rect.max.x > rect.min.x {
                    let new_rect = Rect::new(rect.min.x, rect.min.y, rect.max.x - 1, rect.max.y);
                    self.merge_cells(new_rect);
                    affected_rects.push(new_rect);
                }
                // If min.x == max.x, the merge is deleted (single column merge removed)
            }
        }
        affected_rects
    }

    /// Adjusts merge cells when a row is inserted.
    /// - Merges at or after the row end: no change
    /// - Merges at or before the row start: shift down by 1
    /// - Merges strictly spanning the row: expand by 1
    ///
    /// Returns all affected rects (old and new positions) for dirty tracking.
    pub fn insert_row(&mut self, row: i64) -> Vec<Rect> {
        // Collect all merge rects before modification
        let merge_rects: Vec<Rect> = self.iter_merge_cells().collect();

        if merge_rects.is_empty() {
            return vec![];
        }

        // Clear all existing merges
        for rect in &merge_rects {
            self.unmerge_cells(*rect);
        }

        // Re-create merges with adjusted positions
        let mut affected_rects = merge_rects.clone();
        for rect in merge_rects {
            let new_rect = if row > rect.max.y {
                // Insertion is at or past the merge end - no change
                rect
            } else if row <= rect.min.y {
                // Insertion is at or before the merge start - shift down
                Rect::new(rect.min.x, rect.min.y + 1, rect.max.x, rect.max.y + 1)
            } else {
                // Insertion is strictly inside the merge - expand
                Rect::new(rect.min.x, rect.min.y, rect.max.x, rect.max.y + 1)
            };
            self.merge_cells(new_rect);
            affected_rects.push(new_rect);
        }
        affected_rects
    }

    /// Adjusts merge cells when a row is removed.
    /// - Merges entirely before the row: no change
    /// - Merges entirely after the row: shift up by 1
    /// - Merges spanning the row: shrink by 1 (or delete if becomes empty)
    ///
    /// Returns all affected rects (old and new positions) for dirty tracking.
    pub fn remove_row(&mut self, row: i64) -> Vec<Rect> {
        // Collect all merge rects before modification
        let merge_rects: Vec<Rect> = self.iter_merge_cells().collect();

        if merge_rects.is_empty() {
            return vec![];
        }

        // Clear all existing merges
        for rect in &merge_rects {
            self.unmerge_cells(*rect);
        }

        // Re-create merges with adjusted positions
        let mut affected_rects = merge_rects.clone();
        for rect in merge_rects {
            if rect.max.y < row {
                // Merge is entirely before the deletion point - no change
                self.merge_cells(rect);
            } else if rect.min.y > row {
                // Merge is entirely after the deletion point - shift up
                let new_rect = Rect::new(rect.min.x, rect.min.y - 1, rect.max.x, rect.max.y - 1);
                self.merge_cells(new_rect);
                affected_rects.push(new_rect);
            } else {
                // Deletion is inside the merge - shrink
                // Only re-create if the merge still has height > 0
                if rect.max.y > rect.min.y {
                    let new_rect = Rect::new(rect.min.x, rect.min.y, rect.max.x, rect.max.y - 1);
                    self.merge_cells(new_rect);
                    affected_rects.push(new_rect);
                }
                // If min.y == max.y, the merge is deleted (single row merge removed)
            }
        }
        affected_rects
    }
}

impl Sheet {
    /// Sends merge cells to the client and render worker.
    pub fn send_merge_cells(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match crate::compression::serialize(
            &crate::compression::SerializationFormat::Bincode,
            &self.merge_cells,
        ) {
            Ok(merge_cells) => {
                let empty_hashes: Vec<crate::Pos> = vec![];
                let dirty_hashes_json = serde_json::to_vec(&empty_hashes).unwrap_or_default();
                crate::wasm_bindings::js::jsMergeCells(
                    self.id.to_string(),
                    merge_cells,
                    dirty_hashes_json,
                );
            }
            Err(e) => {
                dbgjs!(format!(
                    "[send_merge_cells] Error serializing merge cells {:?}",
                    e
                ));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_merge_cells() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:E3"));
        let merge_cells = merge_cells.get_merge_cells(Rect::test_a1("B2:C3"));
        assert_eq!(merge_cells, vec![Rect::test_a1("B3:E3")]);
    }

    #[test]
    fn test_iter_merge_cells() {
        let mut merge_cells = MergeCells::default();

        // Initially, there should be no merge cells
        assert_eq!(merge_cells.iter_merge_cells().count(), 0);

        // Add some merge cells
        merge_cells.merge_cells(Rect::test_a1("B3:E3"));
        merge_cells.merge_cells(Rect::test_a1("A1:A1"));
        merge_cells.merge_cells(Rect::test_a1("F5:G6"));

        // Should have 3 merge cells
        let all_merge_cells: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(all_merge_cells.len(), 3);
        assert!(all_merge_cells.contains(&Rect::test_a1("B3:E3")));
        assert!(all_merge_cells.contains(&Rect::test_a1("A1:A1")));
        assert!(all_merge_cells.contains(&Rect::test_a1("F5:G6")));

        // Unmerge one
        merge_cells.unmerge_cells(Rect::test_a1("B3:E3"));

        // Should have 2 merge cells now
        let all_merge_cells: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(all_merge_cells.len(), 2);
        assert!(!all_merge_cells.contains(&Rect::test_a1("B3:E3")));
        assert!(all_merge_cells.contains(&Rect::test_a1("A1:A1")));
        assert!(all_merge_cells.contains(&Rect::test_a1("F5:G6")));
    }

    #[test]
    fn test_get_merge_cell_rect() {
        let mut merge_cells = MergeCells::default();

        // Create a merged cell B2:D4 (3 columns x 3 rows)
        merge_cells.merge_cells(Rect::test_a1("B2:D4"));

        // Query from anchor (B2) should return the full rect
        let rect = merge_cells.get_merge_cell_rect(pos![B2]);
        assert_eq!(rect, Some(Rect::test_a1("B2:D4")));

        // Query from middle (C3) should return the full rect
        let rect = merge_cells.get_merge_cell_rect(pos![C3]);
        assert_eq!(rect, Some(Rect::test_a1("B2:D4")));

        // Query from bottom-right (D4) should return the full rect
        let rect = merge_cells.get_merge_cell_rect(pos![D4]);
        assert_eq!(rect, Some(Rect::test_a1("B2:D4")));

        // Query from outside should return None
        let rect = merge_cells.get_merge_cell_rect(pos![A1]);
        assert_eq!(rect, None);

        // Query from cell adjacent to merged cell should return None
        let rect = merge_cells.get_merge_cell_rect(pos![E2]);
        assert_eq!(rect, None);
    }

    #[test]
    fn test_get_merge_cell_rect_with_multiple_merges() {
        let mut merge_cells = MergeCells::default();

        // Create two separate merged cells
        merge_cells.merge_cells(Rect::test_a1("A1:B2"));
        merge_cells.merge_cells(Rect::test_a1("D1:E3"));

        // Query first merged cell
        let rect = merge_cells.get_merge_cell_rect(pos![A1]);
        assert_eq!(rect, Some(Rect::test_a1("A1:B2")));

        let rect = merge_cells.get_merge_cell_rect(pos![B2]);
        assert_eq!(rect, Some(Rect::test_a1("A1:B2")));

        // Query second merged cell
        let rect = merge_cells.get_merge_cell_rect(pos![D1]);
        assert_eq!(rect, Some(Rect::test_a1("D1:E3")));

        let rect = merge_cells.get_merge_cell_rect(pos![E3]);
        assert_eq!(rect, Some(Rect::test_a1("D1:E3")));

        // Query gap between merged cells (C column)
        let rect = merge_cells.get_merge_cell_rect(pos![C1]);
        assert_eq!(rect, None);
    }

    #[test]
    fn test_get_merge_cell_rect_adjacent_same_y_range() {
        let mut merge_cells = MergeCells::default();

        // Create two adjacent merged cells with the same Y range
        // B2:D4 and E2:G4 (they share the same rows but different columns)
        merge_cells.merge_cells(Rect::test_a1("B2:D4"));
        merge_cells.merge_cells(Rect::test_a1("E2:G4"));

        // Query first merged cell (B2:D4)
        let rect = merge_cells.get_merge_cell_rect(pos![B2]);
        assert_eq!(rect, Some(Rect::test_a1("B2:D4")));

        let rect = merge_cells.get_merge_cell_rect(pos![C3]);
        assert_eq!(rect, Some(Rect::test_a1("B2:D4")));

        let rect = merge_cells.get_merge_cell_rect(pos![D4]);
        assert_eq!(rect, Some(Rect::test_a1("B2:D4")));

        // Query second merged cell (E2:G4)
        let rect = merge_cells.get_merge_cell_rect(pos![E2]);
        assert_eq!(rect, Some(Rect::test_a1("E2:G4")));

        let rect = merge_cells.get_merge_cell_rect(pos![F3]);
        assert_eq!(rect, Some(Rect::test_a1("E2:G4")));

        let rect = merge_cells.get_merge_cell_rect(pos![G4]);
        assert_eq!(rect, Some(Rect::test_a1("E2:G4")));

        // Query boundary cells - D4 is in first merge, E2 is in second
        let rect = merge_cells.get_merge_cell_rect(pos![D2]);
        assert_eq!(rect, Some(Rect::test_a1("B2:D4")));

        let rect = merge_cells.get_merge_cell_rect(pos![E4]);
        assert_eq!(rect, Some(Rect::test_a1("E2:G4")));

        // Query outside both merged cells
        let rect = merge_cells.get_merge_cell_rect(pos![A2]);
        assert_eq!(rect, None);

        let rect = merge_cells.get_merge_cell_rect(pos![H2]);
        assert_eq!(rect, None);
    }

    /// Tests that get_merge_cells returns the FULL merged cell rect even when
    /// only a portion of the merged cell overlaps with the query rect.
    /// This is the bug scenario: B8:B9 and C11:D12 merged, query B8:C11
    /// should return both full merged cells including C11:D12 (not C11:C12).
    #[test]
    fn test_get_merge_cells_returns_full_rect_when_partial_overlap() {
        let mut merge_cells = MergeCells::default();

        // Create merged cells B8:B9 and C11:D12
        merge_cells.merge_cells(Rect::test_a1("B8:B9"));
        merge_cells.merge_cells(Rect::test_a1("C11:D12"));

        // Query with rect B8:C11 (only overlaps with C11 of the C11:D12 merge)
        let result = merge_cells.get_merge_cells(Rect::test_a1("B8:C11"));

        // Should return BOTH full merged cell rects
        assert_eq!(result.len(), 2, "Should find both merged cells");
        assert!(
            result.contains(&Rect::test_a1("B8:B9")),
            "Should include B8:B9"
        );
        assert!(
            result.contains(&Rect::test_a1("C11:D12")),
            "Should include full C11:D12, not just C11:C12"
        );
    }

    /// Test that get_merge_cells returns the full rect even when query
    /// only touches the corner of a merged cell.
    #[test]
    fn test_get_merge_cells_corner_touch() {
        let mut merge_cells = MergeCells::default();

        // Create a merged cell C3:E5
        merge_cells.merge_cells(Rect::test_a1("C3:E5"));

        // Query with A1:C3 (only touches corner C3)
        let result = merge_cells.get_merge_cells(Rect::test_a1("A1:C3"));

        // Should return the full merged cell rect
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], Rect::test_a1("C3:E5"));
    }

    #[test]
    fn test_insert_column_before_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Insert column at B (column 2) - before the merge
        merge_cells.insert_column(2);

        // Merge should shift right: C2:E4 -> D2:F4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("D2:F4"));
    }

    #[test]
    fn test_insert_column_at_merge_start() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Insert column at C (column 3) - at the merge start
        merge_cells.insert_column(3);

        // Merge should shift right: C2:E4 -> D2:F4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("D2:F4"));
    }

    #[test]
    fn test_insert_column_inside_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Insert column at D (column 4) - inside the merge
        merge_cells.insert_column(4);

        // Merge should expand: C2:E4 -> C2:F4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("C2:F4"));
    }

    #[test]
    fn test_insert_column_adjacent_after_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Insert column at F (column 6) - immediately after the merge end
        merge_cells.insert_column(6);

        // Merge should be unchanged (adjacent insertion does not expand)
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("C2:E4"));
    }

    #[test]
    fn test_insert_column_after_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Insert column at G (column 7) - well after the merge
        merge_cells.insert_column(7);

        // Merge should be unchanged
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("C2:E4"));
    }

    #[test]
    fn test_remove_column_before_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Remove column A (column 1) - before the merge
        merge_cells.remove_column(1);

        // Merge should shift left: C2:E4 -> B2:D4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B2:D4"));
    }

    #[test]
    fn test_remove_column_at_merge_start() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Remove column C (column 3) - at the merge start
        merge_cells.remove_column(3);

        // Merge should shrink: C2:E4 -> C2:D4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("C2:D4"));
    }

    #[test]
    fn test_remove_column_inside_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Remove column D (column 4) - inside the merge
        merge_cells.remove_column(4);

        // Merge should shrink: C2:E4 -> C2:D4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("C2:D4"));
    }

    #[test]
    fn test_remove_column_single_column_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:C4")); // single column merge

        // Remove column C (column 3) - the entire merge
        merge_cells.remove_column(3);

        // Merge should be deleted
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 0);
    }

    #[test]
    fn test_remove_column_after_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:E4")); // columns 3-5

        // Remove column G (column 7) - after the merge
        merge_cells.remove_column(7);

        // Merge should be unchanged
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("C2:E4"));
    }

    #[test]
    fn test_insert_row_before_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Insert row at row 2 - before the merge
        merge_cells.insert_row(2);

        // Merge should shift down: B3:D5 -> B4:D6
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B4:D6"));
    }

    #[test]
    fn test_insert_row_at_merge_start() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Insert row at row 3 - at the merge start
        merge_cells.insert_row(3);

        // Merge should shift down: B3:D5 -> B4:D6
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B4:D6"));
    }

    #[test]
    fn test_insert_row_inside_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Insert row at row 4 - inside the merge
        merge_cells.insert_row(4);

        // Merge should expand: B3:D5 -> B3:D6
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B3:D6"));
    }

    #[test]
    fn test_insert_row_adjacent_after_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Insert row at row 6 - immediately after the merge end
        merge_cells.insert_row(6);

        // Merge should be unchanged (adjacent insertion does not expand)
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B3:D5"));
    }

    #[test]
    fn test_insert_row_after_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Insert row at row 7 - well after the merge
        merge_cells.insert_row(7);

        // Merge should be unchanged
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B3:D5"));
    }

    #[test]
    fn test_remove_row_before_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Remove row 1 - before the merge
        merge_cells.remove_row(1);

        // Merge should shift up: B3:D5 -> B2:D4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B2:D4"));
    }

    #[test]
    fn test_remove_row_at_merge_start() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Remove row 3 - at the merge start
        merge_cells.remove_row(3);

        // Merge should shrink: B3:D5 -> B3:D4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B3:D4"));
    }

    #[test]
    fn test_remove_row_inside_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Remove row 4 - inside the merge
        merge_cells.remove_row(4);

        // Merge should shrink: B3:D5 -> B3:D4
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B3:D4"));
    }

    #[test]
    fn test_remove_row_single_row_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D3")); // single row merge

        // Remove row 3 - the entire merge
        merge_cells.remove_row(3);

        // Merge should be deleted
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 0);
    }

    #[test]
    fn test_remove_row_after_merge() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:D5")); // rows 3-5

        // Remove row 7 - after the merge
        merge_cells.remove_row(7);

        // Merge should be unchanged
        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 1);
        assert_eq!(rects[0], Rect::test_a1("B3:D5"));
    }

    #[test]
    fn test_insert_column_multiple_merges() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B2:C3")); // before insertion point
        merge_cells.merge_cells(Rect::test_a1("E2:G3")); // spans insertion point
        merge_cells.merge_cells(Rect::test_a1("I2:J3")); // after insertion point

        // Insert column at F (column 6) - inside E2:G3
        merge_cells.insert_column(6);

        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 3);
        assert!(rects.contains(&Rect::test_a1("B2:C3"))); // unchanged
        assert!(rects.contains(&Rect::test_a1("E2:H3"))); // expanded
        assert!(rects.contains(&Rect::test_a1("J2:K3"))); // shifted
    }

    #[test]
    fn test_remove_row_multiple_merges() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B2:C3")); // before deletion point
        merge_cells.merge_cells(Rect::test_a1("B5:C7")); // spans deletion point
        merge_cells.merge_cells(Rect::test_a1("B9:C10")); // after deletion point

        // Remove row 6 - inside B5:C7
        merge_cells.remove_row(6);

        let rects: Vec<Rect> = merge_cells.iter_merge_cells().collect();
        assert_eq!(rects.len(), 3);
        assert!(rects.contains(&Rect::test_a1("B2:C3"))); // unchanged
        assert!(rects.contains(&Rect::test_a1("B5:C6"))); // shrunk
        assert!(rects.contains(&Rect::test_a1("B8:C9"))); // shifted
    }
}
