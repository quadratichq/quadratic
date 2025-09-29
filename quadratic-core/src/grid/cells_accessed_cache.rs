use crate::a1::A1Context;

use super::*;

impl Grid {
    /// Creates an Cells Accessed Cache from the grid for use by rust client (or core).
    pub(crate) fn expensive_make_cells_accessed_cache(&self, a1_context: &A1Context) -> RegionMap {
        let mut cells_accessed = RegionMap::default();
        self.sheets.values().for_each(|sheet| {
            sheet.add_sheet_to_cells_accessed_cache(&mut cells_accessed, a1_context);
        });
        cells_accessed
    }
}
