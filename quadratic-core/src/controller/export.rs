use anyhow::{Context, Result};
use csv::Writer;
use itertools::PeekingNext;

use super::GridController;
use crate::{
    Pos,
    a1::{A1Selection, CellRefRange},
};

impl GridController {
    /// exports a CSV string from a selection on the grid.
    ///
    /// Returns a [`String`].
    pub fn export_csv_selection(&self, selection: &mut A1Selection) -> Result<String> {
        let sheet = self
            .grid
            .try_sheet(selection.sheet_id)
            .context("Sheet not found")?;

        if let Some(CellRefRange::Table { range }) = selection.ranges.first_mut() {
            range.headers = true;
        }

        let bounds = sheet
            .selection_bounds(selection, false, false, &self.a1_context)
            .context("No values")?;

        let values = sheet.selection_sorted_vec(selection, false, &self.a1_context);
        let mut writer = Writer::from_writer(vec![]);
        let mut iter = values.iter();
        let context = self.a1_context();
        for y in bounds.min.y..=bounds.max.y {
            let mut line = vec![];
            for x in bounds.min.x..=bounds.max.x {
                // we need to ignore unselected columns or rows
                if selection.might_contain_pos(Pos { x, y }, context) {
                    if let Some((_, value)) = iter.peeking_next(|(pos, _)| pos.x == x && pos.y == y)
                    {
                        line.push(value.to_string());
                    } else {
                        line.push("".to_string());
                    }
                }
            }
            if !line.is_empty() {
                writer.write_record(line)?;
            }
        }
        let output = String::from_utf8(writer.into_inner()?)?;
        Ok(output)
    }
}

#[cfg(test)]
mod tests {

    use super::*;

    use crate::{Array, controller::user_actions::import::tests::simple_csv};

    #[test]
    fn exports_a_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let mut selected = A1Selection::test_a1("A1:D4");
        let vals = vec![
            vec!["1", "2", "3", "4"],
            vec!["5", "6", "7", "8"],
            vec!["9", "10", "11", "12"],
            vec!["13", "14", "15", "16"],
        ];

        let sheet = gc.sheet_mut(sheet_id);
        sheet.set_cell_values(crate::Rect::new(1, 1, 4, 4), &Array::from(vals));

        let result = gc.export_csv_selection(&mut selected).unwrap();
        let expected = "1,2,3,4\n5,6,7,8\n9,10,11,12\n13,14,15,16\n";

        assert_eq!(&result, expected);
    }

    #[test]
    fn exports_a_csv_with_a_data_table() {
        let (mut gc, sheet_id, pos, _) = simple_csv();
        let sheet = gc.sheet_mut(sheet_id);
        let data_table = sheet.data_table_mut(pos).unwrap();
        data_table.apply_first_row_as_header();

        let mut selected = A1Selection::test_a1("A1:D13");
        let result = gc.export_csv_selection(&mut selected).unwrap();
        println!("{}", result);
    }
}
