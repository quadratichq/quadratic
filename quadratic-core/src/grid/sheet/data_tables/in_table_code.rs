//! This is a cache of all in-table code tables within the sheet.
//!
//! This is only defined for the sheet-level of tables.

use serde::{Deserialize, Serialize};

use crate::{Pos, Rect, grid::Contiguous2D};

#[derive(Debug, Default, Serialize, Deserialize, Clone, PartialEq)]
pub(crate) struct InTableCode {
    single_cell_code: Contiguous2D<Option<Pos>>,
}

impl InTableCode {
    /// Clears the table from the cache
    pub fn clear_table(&mut self, rect: Rect) {
        self.single_cell_code.set_rect(
            rect.min.x,
            rect.min.y,
            Some(rect.max.x),
            Some(rect.max.y),
            None,
        );
    }

    /// Sets the single cell code in the given rect to the given pos.
    pub fn set_single_cell_code(&mut self, rect: Rect, pos: Pos) {
        self.single_cell_code.set_rect(
            rect.min.x,
            rect.min.y,
            Some(rect.max.x),
            Some(rect.max.y),
            Some(pos),
        );
    }

    /// Returns true if there is code in the given rect.
    pub fn has_code_in_rect(&self, rect: Rect) -> bool {
        !self.single_cell_code.is_all_default_in_rect(rect)
    }

    /// Returns true if there is no code in the table.
    pub fn is_all_default(&self) -> bool {
        self.single_cell_code.is_all_default()
    }

    /// Returns all non-default rects in the given rect.
    pub fn nondefault_rects_in_rect(
        &self,
        rect: Rect,
    ) -> impl Iterator<Item = (Rect, Option<Pos>)> {
        self.single_cell_code.nondefault_rects_in_rect(rect)
    }
}
