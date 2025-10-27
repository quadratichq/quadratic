use crate::{
    ClearOption, Pos, Rect,
    grid::{Contiguous2D, Sheet},
    wasm_bindings::merge_cells::JsMergeCells,
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
}

impl Sheet {
    /// Sends merge cells to the client.
    pub fn send_merge_cells(&self) {
        if !cfg!(target_family = "wasm") && !cfg!(test) {
            return;
        }

        match serde_json::to_vec(&JsMergeCells::from(&self.merge_cells)) {
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
