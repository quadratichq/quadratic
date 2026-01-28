use crate::{CellValue, grid::RegionMap};

use super::*;

impl Sheet {
    /// Adds this sheet to the CellsAccessedCache.
    pub fn add_sheet_to_cells_accessed_cache(
        &self,
        cells_accessed: &mut RegionMap,
        a1_context: &A1Context,
    ) {
        // Add cells_accessed from DataTables
        self.data_tables
            .expensive_iter_code_runs()
            .for_each(|(pos, code_run)| {
                let sheet_pos = pos.to_sheet_pos(self.id);
                for (sheet_id, rect) in code_run.cells_accessed.iter_rects_unbounded(a1_context) {
                    cells_accessed.insert(sheet_pos, (sheet_id, rect));
                }
            });

        // Add cells_accessed from CellValue::Code cells
        for pos in self.iter_code_cells_positions() {
            if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(pos) {
                let sheet_pos = pos.to_sheet_pos(self.id);
                for (sheet_id, rect) in code_cell
                    .code_run
                    .cells_accessed
                    .iter_rects_unbounded(a1_context)
                {
                    cells_accessed.insert(sheet_pos, (sheet_id, rect));
                }
            }
        }
    }
}
