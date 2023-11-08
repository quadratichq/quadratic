use indexmap::IndexSet;

use crate::{controller::operation::Operation, grid::CellRef, CellValue};

use super::Sheet;

impl Sheet {
    pub fn check_spills(
        &mut self,
        cell_ref: CellRef,
        value: CellValue,
        cells_to_compute: &mut IndexSet<CellRef>,
    ) -> Vec<Operation> {
        let reverse_ops = vec![];

        reverse_ops
    }
}
