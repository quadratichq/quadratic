mod column_row;
mod helpers;
mod keyboard;
mod mouse;

use std::str::FromStr;

use crate::a1::{A1Context, RefRangeBounds};
use crate::grid::SheetId;
use crate::grid::sheet::merge_cells::MergeCells;
use crate::{Pos, Rect};

use super::{A1Selection, CellRefRange};

impl A1Selection {
    pub fn select_rect(&mut self, left: i64, top: i64, right: i64, bottom: i64, append: bool) {
        let range = RefRangeBounds::new_relative_rect(Rect::new(left, top, right, bottom));
        if append {
            self.ranges.push(CellRefRange::Sheet { range });
        } else {
            self.ranges.clear();
            self.ranges.push(CellRefRange::Sheet { range });
        }
        self.cursor.x = left;
        self.cursor.y = top;
    }

    pub fn move_to(&mut self, x: i64, y: i64, append: bool, merge_cells: &MergeCells) {
        let new_pos = Pos::new(x, y);

        // When appending, if the new position is within the same merged cell
        // as the cursor, ignore the action to prevent multi-selecting within
        // a single merged cell.
        if append
            && let Some(cursor_merge) = merge_cells.get_merge_cell_rect(self.cursor)
            && cursor_merge.contains(new_pos)
        {
            return;
        }

        // When ctrl+clicking (appending) a merged cell, select the anchor
        // (top-left) cell rather than the clicked cell within the merge.
        let pos = if append {
            merge_cells.get_anchor(new_pos).unwrap_or(new_pos)
        } else {
            new_pos
        };

        if append {
            self.ranges.push(CellRefRange::new_relative_pos(pos));
        } else {
            self.ranges.clear();
            self.ranges.push(CellRefRange::new_relative_pos(pos));
        }
        self.cursor.x = pos.x;
        self.cursor.y = pos.y;
    }

    /// Helper to convert last range to RefRangeBounds (for set_columns_selected and set_rows_selected)
    fn last_range_to_bounds(&self, a1_context: &A1Context) -> Option<RefRangeBounds> {
        let last = self.ranges.last()?;
        match last {
            CellRefRange::Sheet { range } => Some(*range),
            CellRefRange::Table { range } => {
                range.convert_to_ref_range_bounds(false, a1_context, false, false)
            }
        }
    }

    pub fn append_selection(&self, other: &Self) -> Self {
        let mut ranges = self.ranges.clone();
        ranges.extend(other.ranges.iter().cloned());
        Self {
            sheet_id: self.sheet_id,
            cursor: self.cursor,
            ranges,
        }
    }

    /// Selects the entire sheet. (Note: doesn't check whether the SheetId
    /// exists, only if it is valid)
    pub fn select_sheet(&mut self, sheet_id: String) -> Result<(), String> {
        self.sheet_id = SheetId::from_str(&sheet_id).map_err(|e| e.to_string())?;
        self.ranges.clear();
        self.ranges.push(CellRefRange::ALL);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{A1Selection, CellRefRange, MergeCells};
    use crate::grid::SheetId;
    use crate::Rect;

    #[test]
    fn test_move_to() {
        let merge_cells = MergeCells::default();
        let mut selection = A1Selection::test_a1("A1,B1,C1");
        selection.move_to(2, 2, false, &merge_cells);
        assert_eq!(selection.test_to_string(), "B2");
    }

    #[test]
    fn test_move_to_append_within_same_merged_cell() {
        let mut merge_cells = MergeCells::default();
        // Create merged cell C16:D18
        merge_cells.merge_cells(Rect::new(3, 16, 4, 18));

        // Click C16 (anchor of merged cell)
        let mut selection = A1Selection::test_a1("C16");

        // Ctrl+click C18 (within the same merged cell) — should be ignored
        selection.move_to(3, 18, true, &merge_cells);
        assert_eq!(selection.test_to_string(), "C16");

        // Ctrl+click D17 (also within the same merged cell) — should be ignored
        selection.move_to(4, 17, true, &merge_cells);
        assert_eq!(selection.test_to_string(), "C16");

        // Ctrl+click E1 (outside the merged cell) — should append
        selection.move_to(5, 1, true, &merge_cells);
        assert_eq!(selection.test_to_string(), "C16,E1");
    }

    #[test]
    fn test_move_to_append_different_merged_cells() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::new(1, 1, 2, 2)); // A1:B2
        merge_cells.merge_cells(Rect::new(4, 4, 5, 5)); // D4:E5

        // Click A1 (in first merged cell)
        let mut selection = A1Selection::test_a1("A1");

        // Ctrl+click D4 (in a different merged cell) — should append
        selection.move_to(4, 4, true, &merge_cells);
        assert_eq!(selection.test_to_string(), "A1,D4");
    }

    #[test]
    fn test_move_to_no_merge_cells() {
        let merge_cells = MergeCells::default();

        // Without merge cells, append should work normally
        let mut selection = A1Selection::test_a1("A1");
        selection.move_to(3, 3, true, &merge_cells);
        assert_eq!(selection.test_to_string(), "A1,C3");
    }

    #[test]
    fn test_move_to_non_append_on_merged_cell() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::new(3, 16, 4, 18)); // C16:D18

        // Click C16
        let mut selection = A1Selection::test_a1("C16");

        // Non-append click within the same merged cell — should move (replace)
        selection.move_to(3, 18, false, &merge_cells);
        assert_eq!(selection.test_to_string(), "C18");
    }

    #[test]
    fn test_move_to_append_selects_merge_anchor() {
        let mut merge_cells = MergeCells::default();
        merge_cells.merge_cells(Rect::new(3, 16, 4, 18)); // C16:D18
        merge_cells.merge_cells(Rect::new(6, 1, 8, 3)); // F1:H3

        // Start at A1 (outside any merge)
        let mut selection = A1Selection::test_a1("A1");

        // Ctrl+click D18 (non-anchor cell within C16:D18) — should select C16
        selection.move_to(4, 18, true, &merge_cells);
        assert_eq!(selection.test_to_string(), "A1,C16");
        assert_eq!(selection.cursor.x, 3);
        assert_eq!(selection.cursor.y, 16);

        // Ctrl+click H3 (non-anchor cell within F1:H3) — should select F1
        selection.move_to(8, 3, true, &merge_cells);
        assert_eq!(selection.test_to_string(), "A1,C16,F1");
        assert_eq!(selection.cursor.x, 6);
        assert_eq!(selection.cursor.y, 1);

        // Ctrl+click on a non-merged cell — should select that exact cell
        selection.move_to(10, 10, true, &merge_cells);
        assert_eq!(selection.test_to_string(), "A1,C16,F1,J10");
        assert_eq!(selection.cursor.x, 10);
        assert_eq!(selection.cursor.y, 10);
    }

    #[test]
    fn test_select_rect() {
        let mut selection = A1Selection::test_a1("A1,B2,C3");
        selection.select_rect(1, 1, 2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1:B2")]);
        assert_eq!(selection.cursor.x, 1);
        assert_eq!(selection.cursor.y, 1);

        let mut selection = A1Selection::test_a1("A1:C3");
        selection.select_rect(3, 3, 5, 5, true);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A1:C3"),
                CellRefRange::test_a1("C3:E5"),
            ]
        );
        assert_eq!(selection.cursor.x, 3);
        assert_eq!(selection.cursor.y, 3);
    }

    #[test]
    fn test_select_rect_single_cell() {
        let mut selection = A1Selection::test_a1("A1");
        selection.select_rect(2, 2, 2, 2, false);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B2")]);
        assert_eq!(selection.cursor.x, 2);
        assert_eq!(selection.cursor.y, 2);
    }

    #[test]
    fn test_select_sheet() {
        let mut selection = A1Selection::default(SheetId::TEST);
        selection.select_sheet(SheetId::TEST.to_string()).unwrap();
        assert_eq!(selection.ranges, vec![CellRefRange::ALL]);
        assert_eq!(selection.sheet_id, SheetId::TEST);
    }
}
