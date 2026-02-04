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
    /// Note this may include rects that are outside the given rect. Use
    /// rect.min to find the anchor for the merged cell.
    pub fn get_merge_cells(&self, rect: Rect) -> Vec<Rect> {
        self.merge_cells
            .nondefault_rects_in_rect_combined(rect)
            .into_iter()
            .map(|(rect, _)| rect)
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
                crate::wasm_bindings::js::jsMergeCells(self.id.to_string(), merge_cells);
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
}
