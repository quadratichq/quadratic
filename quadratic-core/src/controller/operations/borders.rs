use crate::{
    controller::GridController,
    grid::{generate_borders, BorderSelection, BorderStyle},
    SheetRect,
};

use super::operation::Operation;

impl GridController {
    pub fn set_borders_operations(
        &mut self,
        sheet_rect: SheetRect,
        selections: Vec<BorderSelection>,
        style: Option<BorderStyle>,
    ) -> Vec<Operation> {
        let sheet = self.sheet(sheet_rect.sheet_id);
        let borders = generate_borders(sheet, &sheet_rect.into(), selections, style);
        vec![Operation::SetBorders {
            sheet_rect,
            borders,
        }]
    }
}
