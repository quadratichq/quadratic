use crate::{a1::A1Selection, grid::formats::SheetFormatUpdates};

use super::SheetFormatting;

// todo: this is wrong. it does not properly handle infinite selections (it cuts
// them off at the bounds of the sheet)

impl SheetFormatting {
    /// Returns a format update that applies the formatting from the cells in
    /// the selection.
    pub fn to_clipboard(&self, selection: &A1Selection) -> Option<SheetFormatUpdates> {
        Some(SheetFormatUpdates {
            align: Some(self.align.get_update_for_selection(selection)),
            vertical_align: Some(self.vertical_align.get_update_for_selection(selection)),
            wrap: Some(self.wrap.get_update_for_selection(selection)),
            numeric_format: Some(self.numeric_format.get_update_for_selection(selection)),
            numeric_decimals: Some(self.numeric_decimals.get_update_for_selection(selection)),
            numeric_commas: Some(self.numeric_commas.get_update_for_selection(selection)),
            bold: Some(self.bold.get_update_for_selection(selection)),
            italic: Some(self.italic.get_update_for_selection(selection)),
            text_color: Some(self.text_color.get_update_for_selection(selection)),
            fill_color: Some(self.fill_color.get_update_for_selection(selection)),
            date_time: Some(self.date_time.get_update_for_selection(selection)),
            underline: Some(self.underline.get_update_for_selection(selection)),
            strike_through: Some(self.strike_through.get_update_for_selection(selection)),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{ClearOption, Pos};
    use crate::controller::GridController;

    #[test]
    fn test_to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let _ = gc.set_bold(&A1Selection::test_a1("A1:B2"), Some(true), None);

        let sheet = gc.sheet(sheet_id);
        let clipboard = sheet
            .formats
            .to_clipboard(&A1Selection::test_a1("A1:C3"))
            .unwrap();

        assert_eq!(
            clipboard.bold.as_ref().unwrap().get(Pos::new(1, 1)),
            Some(ClearOption::Some(true)),
        );
        assert_eq!(
            clipboard.bold.as_ref().unwrap().get(Pos::new(1, 2)),
            Some(ClearOption::Some(true)),
        );
        assert_eq!(
            clipboard.bold.as_ref().unwrap().get(Pos::new(2, 1)),
            Some(ClearOption::Some(true)),
        );
        assert_eq!(
            clipboard.bold.as_ref().unwrap().get(Pos::new(2, 2)),
            Some(ClearOption::Some(true)),
        );
        assert_eq!(
            clipboard.bold.as_ref().unwrap().get(Pos::new(3, 3)),
            Some(ClearOption::Clear),
        );

        assert_eq!(clipboard.bold.as_ref().unwrap().get(Pos::new(3, 4)), None);
    }
}
