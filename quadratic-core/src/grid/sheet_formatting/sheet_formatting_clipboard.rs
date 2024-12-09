use crate::{
    grid::{formats::SheetFormatUpdates, Sheet},
    A1Selection, Pos,
};

use super::SheetFormatting;

impl SheetFormatting {
    pub fn to_clipboard(
        &self,
        sheet: &Sheet,
        selection: &A1Selection,
    ) -> Option<SheetFormatUpdates> {
        let mut updates = SheetFormatUpdates::default();

        for rect in sheet.selection_to_rects(selection) {
            for x in rect.x_range() {
                for y in rect.y_range() {
                    updates.set_format_cell(Pos { x, y }, self.format(Pos { x, y }).into());
                }
            }
        }

        if updates.is_default() {
            None
        } else {
            Some(updates)
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {}
