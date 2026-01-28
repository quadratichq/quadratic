use super::super::{A1Selection, CellRefRange};
use crate::Pos;
use crate::Rect;
use crate::a1::A1Context;
use crate::grid::sheet::merge_cells::MergeCells;

/// Expands the rect to fully include any merged cells that partially overlap it
pub(super) fn expand_to_include_merge_cells(rect: &mut Rect, merge_cells: &MergeCells) {
    loop {
        let mut expanded = false;
        let merged_cells = merge_cells.get_merge_cells(*rect);
        for merged_cell_rect in merged_cells.iter() {
            if !rect.contains_rect(merged_cell_rect) {
                rect.union_in_place(merged_cell_rect);
                expanded = true;
            }
        }
        if !expanded {
            break;
        }
    }
}

impl A1Selection {
    /// Helper to reposition cursor after removing a range, ensuring it stays within valid selections
    pub(crate) fn reposition_cursor_after_removal(
        &mut self,
        removed_pos: i64,
        fallback_pos: i64,
        a1_context: &A1Context,
        is_column: bool,
    ) {
        if self.contains_pos(self.cursor, a1_context) {
            return;
        }

        let try_positions = [
            (removed_pos + 1, fallback_pos),
            (removed_pos - 1, fallback_pos),
            (removed_pos + 1, fallback_pos), // default fallback
        ];

        for (primary, secondary) in try_positions {
            let test_pos = if is_column {
                Pos {
                    x: primary,
                    y: secondary,
                }
            } else {
                Pos {
                    x: secondary,
                    y: primary,
                }
            };
            if self.contains_pos(test_pos, a1_context) {
                self.cursor = test_pos;
                return;
            }
        }

        // If no valid position found, use fallback
        if is_column {
            self.cursor.x = fallback_pos;
        } else {
            self.cursor.y = fallback_pos;
        }
    }

    pub(crate) fn ensure_non_empty_ranges(
        &mut self,
        _removed_pos: i64,
        fallback_pos: i64,
        is_column: bool,
    ) {
        if self.ranges.is_empty() {
            if is_column {
                self.cursor.x = fallback_pos;
            } else {
                self.cursor.y = fallback_pos;
            }
            self.ranges
                .push(CellRefRange::new_relative_pos(self.cursor));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grid::sheet::merge_cells::MergeCells;

    #[test]
    fn test_expand_no_merge_cells() {
        let merge_cells = MergeCells::default();
        let mut rect = Rect::test_a1("B2:D4");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        assert_eq!(rect, Rect::test_a1("B2:D4"));
    }

    #[test]
    fn test_expand_merge_cell_fully_inside() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C3:D4"));
        let mut rect = Rect::test_a1("B2:E5");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should remain unchanged since merge cell is fully inside
        assert_eq!(rect, Rect::test_a1("B2:E5"));
    }

    #[test]
    fn test_expand_merge_cell_extends_right() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("C2:F2"));
        let mut rect = Rect::test_a1("B2:D3");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should expand to include the full merged cell
        assert_eq!(rect, Rect::test_a1("B2:F3"));
    }

    #[test]
    fn test_expand_merge_cell_extends_left() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("A2:C2"));
        let mut rect = Rect::test_a1("B2:D3");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should expand to include the full merged cell
        assert_eq!(rect, Rect::test_a1("A2:D3"));
    }

    #[test]
    fn test_expand_merge_cell_extends_down() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B3:B6"));
        let mut rect = Rect::test_a1("B2:D4");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should expand down to include the full merged cell
        assert_eq!(rect, Rect::test_a1("B2:D6"));
    }

    #[test]
    fn test_expand_merge_cell_extends_up() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B1:B3"));
        let mut rect = Rect::test_a1("B2:D4");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should expand up to include the full merged cell
        assert_eq!(rect, Rect::test_a1("B1:D4"));
    }

    #[test]
    fn test_expand_merge_cell_extends_all_directions() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("A1:E5"));
        let mut rect = Rect::test_a1("C3:C3");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should expand to encompass the entire merged cell
        assert_eq!(rect, Rect::test_a1("A1:E5"));
    }

    #[test]
    fn test_expand_multiple_merge_cells() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("A2:C2"));
        merge_cells.merge_cells(Rect::test_a1("D2:F2"));
        let mut rect = Rect::test_a1("B2:E3");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should expand to include both merged cells
        assert_eq!(rect, Rect::test_a1("A2:F3"));
    }

    #[test]
    fn test_expand_large_merge_cell() {
        // Test that a single large merge cell properly expands the rect
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("A1:F6"));
        let mut rect = Rect::test_a1("C3:D4");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        assert_eq!(rect, Rect::test_a1("A1:F6"));
    }

    #[test]
    fn test_expand_merge_cells_in_both_directions() {
        // Test that merge cells that extend in different directions all get included
        let mut merge_cells = MergeCells::default();
        // Merge cell that extends left from the rect
        merge_cells.merge_cells(Rect::test_a1("A2:C2"));
        // Merge cell that extends down from the rect
        merge_cells.merge_cells(Rect::test_a1("D3:D5"));
        let mut rect = Rect::test_a1("B2:D3");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Should expand left to A and down to row 5
        assert_eq!(rect, Rect::test_a1("A2:D5"));
    }

    #[test]
    fn test_expand_non_overlapping_merge_cells() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("A1:B1")); // Above and left of rect
        merge_cells.merge_cells(Rect::test_a1("F6:G7")); // Below and right of rect
        let mut rect = Rect::test_a1("C3:D4");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should remain unchanged since merge cells don't overlap
        assert_eq!(rect, Rect::test_a1("C3:D4"));
    }

    #[test]
    fn test_expand_merge_cell_at_corner() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("D4:F6"));
        let mut rect = Rect::test_a1("B2:D4");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Rect should expand to include the merge cell that touches at corner
        assert_eq!(rect, Rect::test_a1("B2:F6"));
    }

    #[test]
    fn test_expand_single_cell_rect() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::test_a1("B2:D4"));
        let mut rect = Rect::test_a1("C3:C3");
        expand_to_include_merge_cells(&mut rect, &merge_cells);
        // Single cell inside a merged cell should expand to the full merge
        assert_eq!(rect, Rect::test_a1("B2:D4"));
    }
}
