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
                let sheet_pos = pos.to_sheet_pos(self.id);
                for (sheet_id, ranges) in code_run.cells_accessed.cells.iter() {
                    for range in ranges {
                        if let Some(rect) = range.to_rect(a1_context) {
                            cells_accessed.insert(sheet_pos, (sheet_id.to_owned(), rect));
                        }
                    }
                }
            });
    }
}
