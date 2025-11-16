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
                &merge_cells_updates
                    .map_ref(|value| value.as_ref().map(|value| value.clone().into())),
            )
            .map_ref(|value| value.as_ref().map(|value| value.clone().into()))
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
            .set_from(&update.map_ref(|value| value.as_ref().map(|value| value.clone().into())))
            .map_ref(|value| value.as_ref().map(|value| value.clone().into()))
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
            .set_from(&update.map_ref(|value| value.as_ref().map(|value| value.clone().into())))
            .map_ref(|value| value.as_ref().map(|value| value.clone().into()))
    }

    /// Returns true if the given position is part of a merged cell.
    pub fn is_merge_cell(&self, pos: Pos) -> bool {
        self.merge_cells.get(pos).is_some()
    }

    /// Returns the rects that are part of merged cells within a given rect.
    /// Note this may include rects that are outside the given rect. Use
    /// rect.min to find the anchor for the merged cell.
    pub fn get_merge_cells(&self, rect: Rect) -> Vec<Rect> {
        self.merge_cells
            .nondefault_rects_in_rect(rect)
            .map(|(rect, _)| rect)
            .collect()
    }

    /// Returns the merge cell rect that contains the given position, if any.
    /// The anchor (top-left corner) is at rect.min.
    pub fn get_merge_cell_rect(&self, pos: Pos) -> Option<Rect> {
        // Get the anchor position for this cell
        let anchor = self.merge_cells.get(pos)?;

        // Find all merge cell rects that share this anchor
        // When there are overlapping axes, the contiguous 2D array may split a single
        // merged cell into multiple rects, so we need to find all rects with the same anchor
        // and compute their bounding box
        let search_rect = Rect::new(
            anchor.x,
            anchor.y,
            anchor.x.saturating_add(1000),
            anchor.y.saturating_add(1000),
        );

        // Collect all rects that have the same anchor
        let rects_with_anchor: Vec<Rect> = self
            .merge_cells
            .nondefault_rects_in_rect(search_rect)
            .filter_map(|(rect, stored_anchor)| {
                if stored_anchor == Some(anchor) {
                    Some(rect)
                } else {
                    None
                }
            })
            .collect();

        if rects_with_anchor.is_empty() {
            return None;
        }

        // Compute the bounding box of all these rects
        let min_x = rects_with_anchor.iter().map(|r| r.min.x).min()?;
        let min_y = rects_with_anchor.iter().map(|r| r.min.y).min()?;
        let max_x = rects_with_anchor.iter().map(|r| r.max.x).max()?;
        let max_y = rects_with_anchor.iter().map(|r| r.max.y).max()?;

        Some(Rect::new(min_x, min_y, max_x, max_y))
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
