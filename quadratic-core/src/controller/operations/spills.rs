use crate::{controller::GridController, grid::CodeCellRun, ArraySize, SheetPos, SheetRect};

use super::operation::Operation;

impl GridController {
    /// Adds operations to set the spill for a CodeCell within a SheetRect
    pub fn add_code_cell_spill_operations(
        &self,
        sheet_pos: SheetPos,
        run: CodeCellRun,
    ) -> Vec<Operation> {
        let rect = run.output_size().unwrap_or(ArraySize::_1X1);
        let spill_rect = SheetRect::from_numbers(
            sheet_pos.x,
            sheet_pos.y,
            rect.w.get() as i64,
            rect.h.get() as i64,
            sheet_pos.sheet_id,
        );
        // add spill operation
        vec![Operation::SetSpill {
            spill_rect,
            code_cell_sheet_pos: Some(sheet_pos),
        }]
    }

    // check if the deletion of a cell_value would release a spill error
    pub fn check_spill_release_operations(&self, sheet_pos: SheetPos) -> Vec<Operation> {
        let mut ops = vec![];

        let sheet_id = sheet_pos.sheet_id;
        let sheet = self.grid.sheet_from_id(sheet_id);
        if let Some((spill_sheet_pos, run)) = sheet.spill_error_released(sheet_pos.into()) {
            let mut run = run.clone();
            run.spill_error = false;
            ops.push(Operation::SetCodeCellRun {
                sheet_pos: spill_sheet_pos.to_sheet_pos(sheet_id),
                code_cell_run: Some(run),
            });
        }
        ops
    }
}
