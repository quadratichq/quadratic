use crate::{
    a1::{A1Context, A1Selection},
    grid::{Sheet, formats::SheetFormatUpdates},
};

use super::SheetFormatting;

// todo: this is wrong. it does not properly handle infinite selections (it cuts
// them off at the bounds of the sheet)

impl SheetFormatting {
    /// Returns a format update that applies the formatting from the cells in
    /// the selection.
    pub fn to_clipboard(
        &self,
        selection: &A1Selection,
        sheet: &Sheet,
        a1_context: &A1Context,
    ) -> Option<SheetFormatUpdates> {
        let mut sheet_format_updates = SheetFormatUpdates {
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
        };

        // determine if the selectoin overlaps with a data table
        // if so, get the formats from the data table and merge them with the
        // sheet formats
        let data_tables_within = sheet
            .data_tables_within_rect(selection.largest_rect_finite(&a1_context), false)
            .unwrap();
        for data_table_pos in data_tables_within {
            let data_table = sheet.data_table(data_table_pos).unwrap();
            let formats = &data_table.formats;
            let data_table_formats = SheetFormatUpdates {
                align: Some(data_table.formats.align.get_update_for_selection(selection)),
                vertical_align: Some(formats.vertical_align.get_update_for_selection(selection)),
                wrap: Some(data_table.formats.wrap.get_update_for_selection(selection)),
                numeric_format: Some(formats.numeric_format.get_update_for_selection(selection)),
                numeric_decimals: Some(
                    formats.numeric_decimals.get_update_for_selection(selection),
                ),
                numeric_commas: Some(formats.numeric_commas.get_update_for_selection(selection)),
                bold: Some(data_table.formats.bold.get_update_for_selection(selection)),
                italic: Some(formats.italic.get_update_for_selection(selection)),
                text_color: Some(formats.text_color.get_update_for_selection(selection)),
                fill_color: Some(formats.fill_color.get_update_for_selection(selection)),
                date_time: Some(formats.date_time.get_update_for_selection(selection)),
                underline: Some(formats.underline.get_update_for_selection(selection)),
                strike_through: Some(formats.strike_through.get_update_for_selection(selection)),
            };
            dbgjs!(format!("data_table_formats: {:?}", data_table_formats.bold));
            sheet_format_updates.merge(&data_table_formats);
        }

        Some(sheet_format_updates)
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
            .to_clipboard(&A1Selection::test_a1("A1:C3"), sheet, &a1_context)
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
