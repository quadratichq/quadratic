use crate::{
    controller::GridController,
    grid::{generate_borders, get_rect_borders, BorderSelection, BorderStyle},
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
        let Some(sheet) = self.try_sheet(sheet_rect.sheet_id) else {
            return vec![];
        };
        let cur_borders = get_rect_borders(sheet, &sheet_rect.into());
        let new_borders = generate_borders(sheet, &sheet_rect.into(), selections.clone(), style);
        let borders = if cur_borders.render_lookup == new_borders.render_lookup {
            generate_borders(sheet, &sheet_rect.into(), selections, None)
        } else {
            new_borders
        };
        vec![Operation::SetBorders {
            sheet_rect,
            borders,
        }]
    }
}
