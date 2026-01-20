use crate::{CellValue, Value, grid::{CodeCellLocation, RegionMap}};

use super::*;

impl Sheet {
    /// Adds this sheet to the CellsAccessedCache.
    pub fn add_sheet_to_cells_accessed_cache(
        &self,
        cells_accessed: &mut RegionMap,
        a1_context: &A1Context,
    ) {
        // Add cells_accessed from DataTables (code_run-based tables)
        self.data_tables
            .expensive_iter_code_runs()
            .for_each(|(pos, code_run)| {
                let sheet_pos = pos.to_sheet_pos(self.id);
                let loc = CodeCellLocation::Sheet(sheet_pos);
                for (sheet_id, rect) in code_run.cells_accessed.iter_rects_unbounded(a1_context) {
                    cells_accessed.insert(loc, (sheet_id, rect));
                }
            });

        // Add cells_accessed from CellValue::Code cells in sheet columns
        for pos in self.iter_code_cells_positions() {
            if let Some(CellValue::Code(code_cell)) = self.cell_value_ref(pos) {
                let sheet_pos = pos.to_sheet_pos(self.id);
                let loc = CodeCellLocation::Sheet(sheet_pos);
                for (sheet_id, rect) in code_cell
                    .code_run
                    .cells_accessed
                    .iter_rects_unbounded(a1_context)
                {
                    cells_accessed.insert(loc, (sheet_id, rect));
                }
            }
        }

        // Add cells_accessed from CellValue::Code cells embedded in DataTable arrays
        // These are tracked using their precise location (table_pos + array offset)
        for (pos, data_table) in self.data_tables.expensive_iter() {
            let table_pos = pos.to_sheet_pos(self.id);
            if let Value::Array(array) = &data_table.value {
                for (x, y) in array.size().iter() {
                    if let Ok(CellValue::Code(code_cell)) = array.get(x, y) {
                        let loc = CodeCellLocation::embedded(table_pos, x, y);
                        for (sheet_id, rect) in code_cell
                            .code_run
                            .cells_accessed
                            .iter_rects_unbounded(a1_context)
                        {
                            cells_accessed.insert(loc, (sheet_id, rect));
                        }
                    }
                }
            }
        }
    }
}
