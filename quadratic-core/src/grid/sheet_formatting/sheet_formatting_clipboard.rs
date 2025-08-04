use crate::{
    a1::{A1Context, A1Selection},
    grid::{Sheet, formats::SheetFormatUpdates},
};

use super::SheetFormatting;

use anyhow::Result;

impl SheetFormatting {
    /// Returns a format update that applies the formatting from the cells in
    /// the selection.
    pub fn to_clipboard(
        &self,
        selection: &A1Selection,
        sheet: &Sheet,
        a1_context: &A1Context,
    ) -> Result<SheetFormatUpdates> {
        // first, get formats for the sheet of the selection
        let mut sheet_format_updates =
            SheetFormatUpdates::from_sheet_formatting_selection(selection, self);

        // get the largest rect that is finite of the selection
        for rect in sheet.selection_to_rects(selection, false, false, false, a1_context, None) {
            // get the formats from the data table and merge them with the sheet formats
            for (output_rect, intersection_rect, data_table) in
                sheet.iter_data_tables_intersects_rect(rect)
            {
                data_table.transfer_formats_to_sheet(
                    output_rect.min,
                    intersection_rect,
                    &mut sheet_format_updates,
                );
            }
        }

        Ok(sheet_format_updates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::controller::GridController;
    use crate::{ClearOption, Pos};

    #[test]
    fn test_to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let _ = gc.set_bold(&A1Selection::test_a1("A1:B2"), Some(true), None);

        let sheet = gc.sheet(sheet_id);
        let a1_context = gc.a1_context();
        let clipboard = sheet
            .formats
            .to_clipboard(&A1Selection::test_a1("A1:C3"), sheet, a1_context)
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
