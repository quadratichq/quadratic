use anyhow::Result;
use csv::Writer;

use super::GridController;
use crate::selection::Selection;

impl GridController {
    /// exports a CSV string from a selection on the grid.
    ///
    /// Returns a [`String`].
    pub fn export_csv_selection(&self, selection: Selection) -> Result<String> {
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return Ok("".to_string());
        };
        let Some(rect) = sheet.clipboard_selection(&selection) else {
            return Ok("".to_string());
        };

        let values = sheet
            .cell_values_in_rect(&(rect.into()), false)?
            .into_cell_values_vec()
            .iter()
            .map(|record| record.to_string())
            .collect::<Vec<String>>();
        let width = rect.width();
        let mut writer = Writer::from_writer(vec![]);

        values.chunks(width).for_each(|row| {
            writer.write_record(row).unwrap_or_default();
        });

        let output = String::from_utf8(writer.into_inner()?)?;

        Ok(output)
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::Rect;

    #[test]
    fn exports_a_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let selected = Selection {
            sheet_id,
            rects: Some(vec![Rect::from_numbers(0, 0, 4, 4)]),
            ..Default::default()
        };
        let vals = vec![
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16",
        ];
        let mut count = 0;

        let sheet = gc.sheet_mut(sheet_id);
        for y in 0..4 {
            for x in 0..4 {
                sheet.test_set_value_number(x, y, vals[count]);
                count += 1;
            }
        }

        let result = gc.export_csv_selection(selected).unwrap();
        let expected = "1,2,3,4\n5,6,7,8\n9,10,11,12\n13,14,15,16\n";

        assert_eq!(&result, expected);
    }
}
