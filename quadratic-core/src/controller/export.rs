use anyhow::{Context, Result};
use csv::Writer;
use itertools::PeekingNext;

use super::GridController;
use crate::{A1Selection, Pos};

impl GridController {
    /// exports a CSV string from a selection on the grid.
    ///
    /// Returns a [`String`].
    pub fn export_csv_selection(&self, selection: A1Selection) -> Result<String> {
        todo!()
        // let sheet = self
        //     .try_sheet(selection.sheet_id)
        //     .context("Sheet not found")?;
        // let bounds = sheet.selection_bounds(&selection).context("No values")?;
        // let values = sheet.selection_sorted_vec(&selection, false);
        // let mut writer = Writer::from_writer(vec![]);
        // let mut iter = values.iter();
        // for y in bounds.min.y..=bounds.max.y {
        //     let mut line = vec![];
        //     for x in bounds.min.x..=bounds.max.x {
        //         // we need to ignore unselected columns or rows
        //         if selection.rects.is_some() || selection.contains_pos(Pos { x, y }) {
        //             if let Some((_, value)) = iter.peeking_next(|(pos, _)| pos.x == x && pos.y == y)
        //             {
        //                 line.push(value.to_string());
        //             } else {
        //                 line.push("".to_string());
        //             }
        //         }
        //     }
        //     if !line.is_empty() {
        //         writer.write_record(line)?;
        //     }
        // }

        // let output = String::from_utf8(writer.into_inner()?)?;

        // Ok(output)
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
    fn exports_a_csv() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let selected = A1Selection::test("A1:E4");
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
