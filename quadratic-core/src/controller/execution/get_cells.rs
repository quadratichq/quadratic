use crate::controller::{
    transaction_types::{CellsForArray, JsComputeGetCells},
    GridController,
};
impl GridController {
    /// gets cells for use in async calculations
    pub fn get_cells(&mut self, get_cells: JsComputeGetCells) -> Option<CellsForArray> {
        // ensure that the get_cells is not requesting a reference to itself
        let (current_sheet, pos) = if let Some(current_sheet_pos) = self.current_sheet_pos {
            (current_sheet_pos.sheet_id, current_sheet_pos.into())
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
            || Some(self.grid().sheet_from_id(current_sheet)),
            |sheet_name| self.grid().sheet_from_name(sheet_name),
        );

        if let Some(sheet) = sheet {
            // ensure that the current cell ref is not in the get_cells request
            if get_cells.rect().contains(pos) && sheet.id == current_sheet {
                // unable to find sheet by name, generate error
                let msg = if let Some(line_number) = get_cells.line_number() {
                    format!("cell cannot reference itself at line {}", line_number)
                } else {
                    "Sheet not found".to_string()
                };
                self.code_cell_sheet_error(msg, get_cells.line_number());
                self.handle_transactions();
                return Some(CellsForArray::new(vec![], true));
            }

            let rect = get_cells.rect();
            let array = sheet.cell_array(rect);
            self.cells_accessed.insert(rect.to_sheet_rect(sheet.id));
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
            self.code_cell_sheet_error(msg, get_cells.line_number());
            Some(CellsForArray::new(vec![], true))
        }
    }
}
