use crate::{
    a1::A1Selection,
    grid::{formats::SheetFormatUpdates, Sheet},
    Pos,
};

use super::SheetFormatting;

impl SheetFormatting {
    pub fn to_clipboard(
        &self,
        sheet: &Sheet,
        selection: &A1Selection,
    ) -> Option<SheetFormatUpdates> {
        let mut updates = SheetFormatUpdates::default();

        for rect in sheet.selection_to_rects(selection, false, false) {
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
mod tests {
    use super::*;
    use crate::controller::GridController;
    use crate::ClearOption;

    #[test]
    fn test_to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let _ = gc.set_bold(&A1Selection::test_a1("A1:B2"), Some(true), None);

        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet
            .formats
            .to_clipboard(sheet, &A1Selection::test_a1("A1:C3"))
            .unwrap();

        assert_eq!(
            clipboard.clone().bold.unwrap().get(Pos::new(1, 1)).unwrap(),
            ClearOption::Some(true)
        );
        assert_eq!(
            clipboard.clone().bold.unwrap().get(Pos::new(1, 2)).unwrap(),
            ClearOption::Some(true)
        );
        assert_eq!(
            clipboard.clone().bold.unwrap().get(Pos::new(2, 1)).unwrap(),
            ClearOption::Some(true)
        );
        assert_eq!(
            clipboard.clone().bold.unwrap().get(Pos::new(2, 2)).unwrap(),
            ClearOption::Some(true)
        );
        assert_eq!(clipboard.bold.unwrap().get(Pos::new(3, 3)), None);
    }
}
