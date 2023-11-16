use std::collections::HashSet;

use crate::Pos;

use crate::controller::{
    transaction_types::{CellsForArray, JsComputeGetCells},
    GridController,
};
use crate::grid::CellRef;

use super::TransactionInProgress;

impl TransactionInProgress {
    /// gets cells for use in async calculations
    pub fn get_cells(
        &mut self,
        grid_controller: &mut GridController,
        get_cells: JsComputeGetCells,
    ) -> Option<CellsForArray> {
        // ensure that the get_cells is not requesting a reference to itself
        let (current_sheet, pos) = if let Some(current_cell_ref) = self.current_cell_ref {
            let sheet = grid_controller.sheet(current_cell_ref.sheet);
            let pos = if let Some(pos) = sheet.cell_ref_to_pos(current_cell_ref) {
                pos
            } else {
                // this should only occur after an internal logic error
                crate::util::dbgjs(
                    "Expected current_cell_ref's sheet to be defined in transaction::get_cells",
                );
                return Some(CellsForArray::new(vec![], true));
            };
            (sheet, pos)
        } else {
            // this should only occur after an internal logic error
            crate::util::dbgjs(
                "Expected current_sheet_pos to be defined in transaction::get_cells",
            );
            return Some(CellsForArray::new(vec![], true));
        };

        let sheet_name = get_cells.sheet_name();

        // if sheet_name is None, use the sheet_id from the pos
        let sheet = sheet_name.clone().map_or_else(
            || Some(current_sheet),
            |sheet_name| grid_controller.grid().sheet_from_name(sheet_name),
        );

        if let Some(sheet) = sheet {
            // ensure there's not a cell reference in the get_cells request
            if get_cells.rect().contains(pos) && sheet.id == current_sheet.id {
                // unable to find sheet by name, generate error
                let msg = if let Some(line_number) = get_cells.line_number() {
                    format!("cell cannot reference itself at line {}", line_number)
                } else {
                    "Sheet not found".to_string()
                };
                self.code_cell_sheet_error(grid_controller, msg, get_cells.line_number());
                self.loop_compute(grid_controller);
                return Some(CellsForArray::new(vec![], true));
            }

            let rect = get_cells.rect();
            let array = sheet.cell_array(rect);

            let mut cells_accessed: HashSet<CellRef> = HashSet::new();
            while let Some(cell_ref) = self.cells_accessed.pop() {
                cells_accessed.insert(cell_ref);
            }
            let sheet_id = sheet.id;
            let sheet = grid_controller.grid_mut().sheet_mut_from_id(sheet_id);
            for y in rect.y_range() {
                for x in rect.x_range() {
                    let cell_ref = sheet.get_or_create_cell_ref(Pos { x, y });
                    cells_accessed.insert(cell_ref);
                }
            }
            self.cells_accessed = cells_accessed.into_iter().collect();
            Some(array)
        } else {
            // unable to find sheet by name, generate error
            let msg = if let (Some(sheet_name), Some(line_number)) =
                (sheet_name, get_cells.line_number())
            {
                format!("Sheet '{}' not found at line {}", sheet_name, line_number)
            } else {
                "Sheet not found".to_string()
            };
            self.code_cell_sheet_error(grid_controller, msg, get_cells.line_number());
            Some(CellsForArray::new(vec![], true))
        }
    }
}
