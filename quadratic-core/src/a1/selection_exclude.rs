//! Handles the logic for removing cells from a selection.

use crate::Pos;

use super::{A1Selection, CellRefRangeEnd};

impl A1Selection {
    pub fn exclude_cells(&mut self, p1: Pos, p2: Option<Pos>) {
        self.ranges.retain_mut(|range| {
            if range.is_pos_range(p1, p2) {
                false
            } else {
                true
            }
        })
    }
}
