use crate::CellRefRange;

use super::*;

impl BordersA1 {
    /// Returns true if the borders for the Selection are already set to the
    /// given style.
    pub fn is_toggle_borders(
        &self,
        _border_selection: BorderSelection,
        _style: Option<BorderStyle>,
        _range: &CellRefRange,
    ) -> bool {
        // match border_selection {
        //     BorderSelection::All => match range {
        //         CellRefRange::Sheet { range } => {
        //             self.is_same_sheet(border_selection, style, range);
        //         }
        //     },
        //     // todo: remove
        //     _ => false,
        // }
        false
    }
}
