use indexmap::IndexSet;

use crate::{
    controller::{
        transaction_summary::TransactionSummary, update_code_cell_value::update_code_cell_value,
        GridController,
    },
    grid::{CellRef, RegionRef},
};

use super::operation::Operation;

impl GridController {
    pub fn check_spills(
        &mut self,
        region: RegionRef,
        cells_to_compute: &mut IndexSet<CellRef>,
        summary: &mut TransactionSummary,
        reverse_operations: &mut Vec<Operation>,
    ) {
        region.iter().for_each(|cell_ref| {
            let sheet = self.grid.sheet_from_id(region.sheet);
            if let Some(pos) = sheet.cell_ref_to_pos(cell_ref) {
                if let Some(column) = sheet.get_column(pos.x) {
                    if let Some(code_cell_ref) = column.spills.get(pos.y) {
                        if let Some(code_cell) = sheet.get_code_cell_from_ref(code_cell_ref) {
                            let array_size = code_cell.output_size();
                            let w = array_size.w.into();
                            let h = array_size.h.into();
                            if w > 1 || h > 1 {
                                let should_spill = sheet.spilled(code_cell_ref, w, h);
                                if (should_spill && !code_cell.spill_error())
                                    || (!should_spill && code_cell.spill_error())
                                {
                                    update_code_cell_value(
                                        self,
                                        code_cell_ref,
                                        Some(code_cell.clone()),
                                        cells_to_compute,
                                        reverse_operations,
                                        summary,
                                    );
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}
