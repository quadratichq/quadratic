use crate::grid::RegionMap;

use super::*;

impl Sheet {
    /// Adds this sheet to the CellsAccessedCache.
    pub fn add_sheet_to_cells_accessed_cache(
        &self,
        cells_accessed: &mut RegionMap,
        a1_context: &A1Context,
    ) {
        self.data_tables
            .expensive_iter_code_runs()
            .for_each(|(pos, code_run)| {
                let multi_pos = pos.to_sheet_pos(self.id).into();
                for (sheet_id, rect) in code_run.cells_accessed.iter_rects_unbounded(a1_context) {
                    cells_accessed.insert(multi_pos, (sheet_id, rect));
                }
            });
    }
}
