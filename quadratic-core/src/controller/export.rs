use anyhow::Result;
use csv::Writer;

use super::GridController;
use crate::{grid::SheetId, Rect};

impl GridController {
    /// exports a CSV string from a selection on the grid.
    ///
    /// Returns a [`String`].
    pub fn export_csv_selection(&self, sheet_id: SheetId, selection: &Rect) -> Result<String> {
        // todo: handle this better
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return Ok("".to_string());
        };
        let values = sheet
            .cell_values_in_rect(selection)?
            .into_cell_values_vec()
            .iter()
            .map(|record| record.to_string())
            .collect::<Vec<String>>();
        let width = selection.width() as usize;
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

    fn test_setup(selection: &Rect, vals: &[&str]) -> (GridController, SheetId) {
        let mut grid_controller = GridController::test();
        let sheet_id = grid_controller.grid.sheets()[0].id;
        let mut count = 0;

        for y in selection.y_range() {
            for x in selection.x_range() {
                grid_controller.set_cell_value((x, y, sheet_id).into(), vals[count].into(), None);
                count += 1;
            }
        }

        (grid_controller, sheet_id)
    }

    #[test]
    fn exports_a_csv() {
        let selected: Rect = Rect::new_span((0, 0).into(), (3, 3).into());
        let vals = vec![
            "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16",
        ];
        let (grid_controller, sheet_id) = test_setup(&selected, &vals);
        let sheet = grid_controller.sheet(sheet_id);
        let result = grid_controller
            .export_csv_selection(sheet.id, &selected)
            .unwrap();
        let expected = "1,2,3,4\n5,6,7,8\n9,10,11,12\n13,14,15,16\n";

        assert_eq!(&result, expected);
    }
}
