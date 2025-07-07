//! This is a cache of all in-table code tables within the sheet.
//!
//! This is only defined for the sheet-level of tables.

use serde::{Deserialize, Serialize};

use crate::{Pos, Rect, grid::Contiguous2D};

#[derive(Debug, Default, Serialize, Deserialize, Clone, PartialEq)]
pub(crate) struct InTableCode {
    pub(crate) single_cell_code: Contiguous2D<Option<Pos>>,
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

    /// Returns true if there is code in the given rect.
    pub fn has_code_in_rect(&self, rect: Rect) -> bool {
        !self.single_cell_code.is_all_default_in_rect(rect)
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
}
