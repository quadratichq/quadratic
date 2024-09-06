//! Functionality to clear borders when columns, rows, and all are set.

// use crate::controller::operations::operation::Operation;

// use super::Borders;

// impl Borders {
// Clears all cells that are in a column and returns the undo operations.
// pub fn column_clear_cells(&mut self, column: i64) -> Vec<Operation> {
// let bounds = self.bounds
// let mut ops = Vec::new();

// // find all horizontal top cells in the column
// let mut top_to_delete = Vec::new();
// self.top.iter().for_each(|(row, border)| {
//     if self.top.contains_key(row) {
//         top_to_delete.push(*row);
//     }
// });

// top_to_delete.iter().map(|row| {});

// // find all horizontal bottom cells in the column
// self.bottom.iter().for_each(|(row, border)| {
//     if self.bottom.contains_key(row) {
//         cells.push((*row, border.clone()));
//     }
// });

// find all vertical left cells in the column
// self.left.iter().for_each(|(row, border)| {
//     if border.get()
//         .left
//         .get(row)
//         .is_some_and(|border| border.get(column).is_some())
//     {
//         cells.push(*row);
//     }
// });

/*

        if let Some(rects) = selection.rects.as_ref() {
            for rect in rects {
                rect.iter().for_each(|pos| {
                    let Some(border) = borders.get_at(index) else {
                        panic!("Expected a border style for cell {pos:?}");
                    };
                    let mut undo = BorderStyleCellUpdate::default();
                    if let Some(update_top) = border.top {
                        let top = self.top.entry(pos.y).or_default();
                        let original = top.set(pos.x, update_top);
                        undo.top = Some(original);
                    }
                    if let Some(update_bottom) = border.bottom {
                        let bottom = self.bottom.entry(pos.y).or_default();
                        let original = bottom.set(pos.x, update_bottom);
                        undo.bottom = Some(original);
                    }
                    if let Some(update_left) = border.left {
                        let left = self.left.entry(pos.x).or_default();
                        let original = left.set(pos.y, update_left);
                        undo.left = Some(original);
                    }
                    if let Some(update_right) = border.right {
                        let right = self.right.entry(pos.x).or_default();
                        let original = right.set(pos.y, update_right);
                        undo.right = Some(original);
                    }
                    undo_borders.push(undo);
                    index += 1;
                });
            }
        }

*/

//         ops
//     }
// }

// #[cfg(test)]
// mod tests {
//     use serial_test::parallel;

//     use crate::{
//         controller::GridController,
//         grid::{BorderSelection, BorderStyle},
//         selection::Selection,
//         SheetRect,
//     };

//     #[test]
//     #[parallel]
//     fn get_column_cells() {
//         let mut gc = GridController::test();
//         let sheet_id = gc.sheet_ids()[0];
//         gc.set_borders_selection(
//             Selection::sheet_rect(SheetRect::new(2, 2, 10, 10, sheet_id)),
//             BorderSelection::All,
//             Some(BorderStyle::default()),
//             None,
//         );
//         gc.set_borders_selection(
//             Selection::sheet_rect(SheetRect::new(1, 1, 3, 3, sheet_id)),
//             BorderSelection::All,
//             Some(BorderStyle::default()),
//             None,
//         );

//         let sheet = gc.sheet(sheet_id);
//         let cells = sheet.borders.column_clear_cells(1);
//         assert_eq!(cells.len(), 10);
//     }
// }
