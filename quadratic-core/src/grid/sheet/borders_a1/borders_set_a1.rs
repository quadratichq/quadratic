use crate::{controller::operations::operation::Operation, grid::SheetId};

use super::*;

impl BordersA1 {
    /// Sets the borders for a selection.
    pub fn set_borders_a1(
        &mut self,
        sheet_id: SheetId,
        borders: &BordersA1Updates,
    ) -> Vec<Operation> {
        let reverse_borders = BordersA1Updates {
            left: borders.left.as_ref().map(|value| self.left.set_from(value)),
            right: borders
                .right
                .as_ref()
                .map(|value| self.right.set_from(value)),
            top: borders.top.as_ref().map(|value| self.top.set_from(value)),
            bottom: borders
                .bottom
                .as_ref()
                .map(|value| self.bottom.set_from(value)),
        };

        vec![Operation::SetBordersA1 {
            sheet_id,
            borders: reverse_borders,
        }]
    }
}
