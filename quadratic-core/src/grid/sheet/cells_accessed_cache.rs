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
            .for_each(|(multi_pos, code_run)| {
                for (sheet_id, rect) in code_run.cells_accessed.iter_rects_unbounded(a1_context) {
                    cells_accessed.insert(multi_pos.to_multi_sheet_pos(sheet_id), (sheet_id, rect));
                }
            });
    }
}
