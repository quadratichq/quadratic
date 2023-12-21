use crate::{
    controller::{operations::operation::Operation, GridController},
    ArraySize, SheetPos, SheetRect,
};

impl GridController {
    /// Checks whether a change in causes a spill error
    pub fn check_is_spill_error(&self, sheet_pos: SheetPos, size: ArraySize) -> bool {
        match self.grid.try_sheet_from_id(sheet_pos.sheet_id) {
            None => false,
            Some(sheet) => sheet.has_spill_error(sheet_pos.into(), size, Some(sheet_pos.into())),
        }
    }

    /// Changes spill values from an operation
    pub(crate) fn add_spills(&self, sheet_rect: &SheetRect, spill: SheetPos) {
        if let Some(sheet) = self.grid.try_sheet_from_id(sheet_rect.sheet_id) {
            sheet.set_spills(sheet_rect, Some(spill.into()));
            self.forward_operations.push(Operation::SetSpills {
                spill_rect: *sheet_rect,
                code_cell_sheet_pos: Some(spill),
            });
        }
    }

    /// Clears spills for SheetRect from an operation
    pub(crate) fn clear_spills(&mut self, sheet_rects: Vec<SheetRect>) {
        if sheet_rects.len() == 0 {
            return;
        };
        if let Some(sheet) = self.grid.try_sheet_mut_from_id(sheet_rects[0].sheet_id) {
            // Clears spills in sheet_rects
            for sheet_rect in sheet_rects {
                sheet.set_spills(&sheet_rect, None);
                self.forward_operations.push(Operation::SetSpills {
                    spill_rect: sheet_rect,
                    code_cell_sheet_pos: None,
                });
            }

            // checks for released spills in sheet_rects
            for sheet_rect in sheet_rects {
                if let Some((sheet_pos, code_cell_value)) = sheet.spill_error_released(sheet_rect) {
                    self.forward_operations.push(Operation::SetSpills {
                        spill_rect: sheet_rect,
                        code_cell_sheet_pos: Some(sheet_pos),
                    });
                }
            }
        }
    }
}
