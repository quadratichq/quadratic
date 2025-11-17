use std::collections::HashSet;

use crate::{
    Pos,
    a1::{A1Selection, CellRefRange},
    grid::sheet::merge_cells::MergeCells,
};

impl A1Selection {
    /// Expands the selection to include anchor cells for any merged cells.
    /// This ensures that formatting operations are applied to the anchor cells
    /// where the data actually lives, while preserving the original selection
    /// for navigation purposes.
    pub fn expand_to_include_merge_anchors(&self, merge_cells: &MergeCells) -> Self {
        let mut expanded_selection = self.clone();
        let mut anchors_to_add = HashSet::new();

        // Check cursor position
        if let Some(anchor) = merge_cells.get_anchor(self.cursor) {
            if anchor != self.cursor {
                anchors_to_add.insert(anchor);
            }
        }

        // Check all positions in ranges
        for range in &self.ranges {
            match range {
                CellRefRange::Sheet { range } => {
                    if range.is_finite() {
                        if let Some(rect) = range.to_rect() {
                            // Check all positions in the range for merged cells
                            for x in rect.min.x..=rect.max.x {
                                for y in rect.min.y..=rect.max.y {
                                    let pos = Pos { x, y };
                                    if let Some(anchor) = merge_cells.get_anchor(pos) {
                                        // Add anchor if it's not already in the range
                                        if !rect.contains(anchor) {
                                            anchors_to_add.insert(anchor);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                CellRefRange::Table { .. } => {
                    // Tables are handled separately in format_ops
                }
            }
        }

        // Add anchor positions to the selection as individual cell ranges
        for anchor in anchors_to_add {
            use crate::a1::{CellRefCoord, CellRefRangeEnd, RefRangeBounds};

            let anchor_range = CellRefRange::Sheet {
                range: RefRangeBounds {
                    start: CellRefRangeEnd {
                        col: CellRefCoord {
                            coord: anchor.x,
                            is_absolute: true,
                        },
                        row: CellRefCoord {
                            coord: anchor.y,
                            is_absolute: true,
                        },
                    },
                    end: CellRefRangeEnd {
                        col: CellRefCoord {
                            coord: anchor.x,
                            is_absolute: true,
                        },
                        row: CellRefCoord {
                            coord: anchor.y,
                            is_absolute: true,
                        },
                    },
                },
            };
            expanded_selection.ranges.push(anchor_range);
        }

        expanded_selection
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Rect, a1::A1Selection};

    #[test]
    fn test_expand_to_include_merge_anchors() {
        // Test 1: Cursor in a merged cell (not at anchor)
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("A1:C3")); // Anchor is A1

        let selection = A1Selection::test_a1("B2"); // Cursor at B2, which is in merged cell
        let expanded = selection.expand_to_include_merge_anchors(&merge_cells);

        // Should include original selection (B2) and anchor (A1)
        assert_eq!(expanded.test_to_string(), "B2,A1");

        // Test 2: Cursor at anchor position (should not add duplicate)
        let selection = A1Selection::test_a1("A1");
        let expanded = selection.expand_to_include_merge_anchors(&merge_cells);

        // Should remain A1 (cursor is already at anchor)
        assert_eq!(expanded.test_to_string(), "A1");

        // Test 3: Range overlapping with merged cell (anchor outside range)
        let selection = A1Selection::test_a1("B2:D4"); // Range overlaps with merged cell A1:C3
        let expanded = selection.expand_to_include_merge_anchors(&merge_cells);

        // Should include original range and anchor A1
        assert_eq!(expanded.test_to_string(), "B2:D4,A1");

        // Test 4: Range already containing anchor (should not add duplicate)
        let selection = A1Selection::test_a1("A1:D4"); // Range already contains anchor A1
        let expanded = selection.expand_to_include_merge_anchors(&merge_cells);

        // Should remain the same (anchor already in range)
        assert_eq!(expanded.test_to_string(), "A1:D4");

        // Test 5: Multiple merged cells
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("A1:B2")); // Anchor A1
        merge_cells.merge_cells(Rect::test_a1("D5:E6")); // Anchor D5

        let selection = A1Selection::test_a1("B2,E6"); // Cursor at B2 (merged), range E6 is in merged cell D5:E6
        let expanded = selection.expand_to_include_merge_anchors(&merge_cells);

        // Should include anchors A1 and D5
        let expanded_str = expanded.test_to_string();
        assert!(expanded_str.contains("A1"), "Should include anchor A1");
        assert!(expanded_str.contains("D5"), "Should include anchor D5");

        // Test 6: No merged cells (should remain unchanged)
        let merge_cells = MergeCells::default();
        let selection = A1Selection::test_a1("A1:B2");
        let expanded = selection.expand_to_include_merge_anchors(&merge_cells);

        // Should remain unchanged
        assert_eq!(expanded.test_to_string(), "A1:B2");

        // Test 7: Cursor in merged cell, range also overlaps with different merged cell
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("A1:B2")); // Anchor A1
        merge_cells.merge_cells(Rect::test_a1("D5:E6")); // Anchor D5

        let mut selection = A1Selection::test_a1("B2"); // Cursor at B2 (merged A1:B2)
        selection.select_rect(4, 5, 5, 6, true); // Add range D5:E6 which overlaps with merged cell
        let expanded = selection.expand_to_include_merge_anchors(&merge_cells);

        // Should include both anchors
        let expanded_str = expanded.test_to_string();
        assert!(
            expanded_str.contains("A1"),
            "Should include anchor A1 from cursor"
        );
        assert!(
            expanded_str.contains("D5"),
            "Should include anchor D5 from range"
        );
    }
}
