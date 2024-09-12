//! Inserts and removes columns and rows for borders. Also provides fn to get
//! undo operations for these changes.

use itertools::Itertools;

use crate::{controller::operations::operation::Operation, grid::SheetId, selection::Selection};

use super::{BorderStyleCellUpdates, Borders};

impl Borders {
    /// Inserts a new column at the given coordinate.
    pub fn insert_column(&mut self, column: i64) {
        // collect all the columns that need to be incremented
        let to_increment: Vec<i64> = self
            .left
            .iter()
            .filter_map(|(x, _)| if *x >= column { Some(*x) } else { None })
            .sorted()
            .collect();

        // need to work backwards because we're shifting to the right
        for &x in to_increment.iter().rev() {
            if let Some(data) = self.left.remove(&x) {
                self.left.insert(x + 1, data);
            }
        }

        // collect all the columns that need to be incremented
        let to_increment: Vec<i64> = self
            .right
            .iter()
            .filter_map(|(x, _)| if *x >= column { Some(*x) } else { None })
            .sorted()
            .collect();

        // need to work backwards because we're shifting to the right
        for &x in to_increment.iter().rev() {
            if let Some(data) = self.right.remove(&x) {
                self.right.insert(x + 1, data);
            }
        }

        // inserts a column in top and bottom
        self.top.iter_mut().for_each(|(_, data)| {
            // find any blocks that overlap the new column
            data.insert_and_shift_right(column);
        });
        self.bottom.iter_mut().for_each(|(_, data)| {
            // find any blocks that overlap the new column
            data.insert_and_shift_right(column);
        });
    }

    /// Inserts a new row at the given coordinate.
    pub fn insert_row(&mut self, row: i64) {
        // collect all the rows that need to be incremented
        let to_increment: Vec<i64> = self
            .top
            .iter()
            .filter_map(|(y, _)| if *y >= row { Some(*y) } else { None })
            .sorted()
            .collect();

        // increment all rows (backwards because we're shifting down)
        for &y in to_increment.iter().rev() {
            if let Some(data) = self.top.remove(&y) {
                self.top.insert(y + 1, data);
            }
        }

        // collect all the rows that need to be incremented
        let to_increment: Vec<i64> = self
            .bottom
            .iter()
            .filter_map(|(y, _)| if *y >= row { Some(*y) } else { None })
            .sorted()
            .collect();

        // increment all rows (backwards because we're shifting down)
        for &y in to_increment.iter().rev() {
            if let Some(data) = self.bottom.remove(&y) {
                self.bottom.insert(y + 1, data);
            }
        }

        // inserts a row in left and right
        self.left.iter_mut().for_each(|(_, data)| {
            // find any blocks that overlap the new row
            data.insert_and_shift_right(row);
        });
        self.right.iter_mut().for_each(|(_, data)| {
            // find any blocks that overlap the new row
            data.insert_and_shift_right(row);
        });
    }

    /// Removes a column at the given coordinate.
    pub fn remove_column(&mut self, sheet_id: SheetId, column: i64) {
        let mut changed = false;
        self.left.remove(&column);

        // collect all the columns that need to be decremented
        let to_decrement: Vec<i64> = self
            .left
            .iter()
            .filter_map(|(x, _)| if *x >= column { Some(*x) } else { None })
            .sorted()
            .collect();

        changed |= !to_decrement.is_empty();

        // decrement all columns (forwards because we're shifting left)
        for &x in to_decrement.iter() {
            if let Some(data) = self.left.remove(&x) {
                self.left.insert(x - 1, data);
            }
        }

        if self.right.contains_key(&column) {
            changed = true;
            self.right.remove(&column);
        }

        // collect all the columns that need to be decremented
        let to_decrement: Vec<i64> = self
            .right
            .iter()
            .filter_map(|(x, _)| if *x >= column { Some(*x) } else { None })
            .sorted()
            .collect();

        changed |= !to_decrement.is_empty();

        // decrement all columns (forwards because we're shifting left)
        for &x in to_decrement.iter() {
            if let Some(data) = self.right.remove(&x) {
                self.right.insert(x - 1, data);
            }
        }

        // removes a column in top and bottom
        self.top.iter_mut().for_each(|(_, data)| {
            // find any blocks that overlap the new column
            if data.remove_and_shift_left(column) {
                changed = true;
            }
        });
        self.bottom.iter_mut().for_each(|(_, data)| {
            // find any blocks that overlap the new column
            if data.remove_and_shift_left(column) {
                changed = true;
            }
        });

        // todo: this should be a PendingTransaction flag instead of a js call from here
        if (cfg!(target_family = "wasm") || cfg!(test)) && changed {
            self.send_sheet_borders(sheet_id);
        }
    }

    /// Removes a row at the given coordinate.
    pub fn remove_row(&mut self, row: i64) {
        self.top.remove(&row);

        // collect all the rows that need to be decremented
        let to_decrement: Vec<i64> = self
            .top
            .iter()
            .filter_map(|(y, _)| if *y >= row { Some(*y) } else { None })
            .sorted()
            .collect();

        // decrement all rows (forwards because we're shifting up)
        for &y in to_decrement.iter() {
            if let Some(data) = self.top.remove(&y) {
                self.top.insert(y - 1, data);
            }
        }

        self.bottom.remove(&row);

        // collect all the rows that need to be decremented
        let to_decrement: Vec<i64> = self
            .bottom
            .iter()
            .filter_map(|(y, _)| if *y >= row { Some(*y) } else { None })
            .sorted()
            .collect();

        // decrement all rows (forwards because we're shifting up)
        for &y in to_decrement.iter() {
            if let Some(data) = self.bottom.remove(&y) {
                self.bottom.insert(y - 1, data);
            }
        }

        // removes a row in left and right
        self.left.iter_mut().for_each(|(_, data)| {
            // find any blocks that overlap the new row
            data.remove_and_shift_left(row);
        });
        self.right.iter_mut().for_each(|(_, data)| {
            // find any blocks that overlap the new row
            data.remove_and_shift_left(row);
        });
    }

    /// Gets an operation to recreate the column's borders.
    pub fn get_column_ops(&self, sheet_id: SheetId, column: i64) -> Vec<Operation> {
        let mut borders = BorderStyleCellUpdates::default();
        let mut selection = Selection::new(sheet_id);
        if self.columns.contains_key(&column) {
            selection.columns = Some(vec![column]);
            borders.push(self.columns[&column].override_border(false));
        }

        if let Some(bounds) = self.bounds_column(column, false, false) {
            dbg!(&bounds);
            for row in bounds.min.y..=bounds.max.y {
                let border = self.get(column, row).override_border(false);
                borders.push(border);
            }
            selection.rects = Some(vec![bounds]);
        }

        if selection.is_empty() {
            vec![]
        } else {
            vec![Operation::SetBordersSelection { selection, borders }]
        }
    }

    /// Gets an operation to recreate the row's borders.
    pub fn get_row_ops(&self, sheet_id: SheetId, row: i64) -> Vec<Operation> {
        let mut borders = BorderStyleCellUpdates::default();
        let mut selection = Selection::new(sheet_id);
        if self.rows.contains_key(&row) {
            selection.rows = Some(vec![row]);
            borders.push(self.rows[&row].override_border(false));
        }

        if let Some(bounds) = self.bounds_row(row, false, false) {
            for col in bounds.min.x..=bounds.max.x {
                let border = self.get(col, row).override_border(false);
                borders.push(border);
            }
            selection.rects = Some(vec![bounds]);
        }

        if selection.is_empty() {
            vec![]
        } else {
            vec![Operation::SetBordersSelection { selection, borders }]
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{
            sheet::borders::BorderStyleCellUpdate, BorderSelection, BorderStyle, CellBorderLine,
        },
        selection::Selection,
        Rect, SheetRect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn insert_column_empty() {
        let mut borders = Borders::default();
        borders.insert_column(0);
        assert_eq!(borders, Borders::default());
    }

    #[test]
    #[parallel]
    fn delete_column_empty() {
        let mut borders = Borders::default();
        borders.remove_column(SheetId::test(), 0);
        assert_eq!(borders, Borders::default());
    }

    #[test]
    #[parallel]
    fn insert_column_start() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_column(1);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(2, 1, 11, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn insert_column_middle() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_column(5);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 4, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(6, 1, 11, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn insert_column_end() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_column(11);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn remove_column_start() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_column(sheet_id, 1);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 9, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn remove_column_middle() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_column(sheet_id, 5);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 9, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(
            sheet.borders.borders_in_sheet(),
            sheet_expected.borders.borders_in_sheet()
        );
    }

    #[test]
    #[parallel]
    fn remove_column_end() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_column(sheet_id, 10);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 9, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn insert_row_empty() {
        let mut borders = Borders::default();
        borders.insert_row(0);
        assert_eq!(borders, Borders::default());
    }

    #[test]
    #[parallel]
    fn insert_row_start() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_row(1);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 2, 10, 11, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn insert_row_middle() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_row(5);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 4, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 6, 10, 11, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn insert_row_end() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.insert_row(11);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn remove_row_empty() {
        let mut borders = Borders::default();
        borders.remove_row(0);
        assert_eq!(borders, Borders::default());
    }

    #[test]
    #[parallel]
    fn remove_row_start() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_row(1);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 9, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(sheet.borders, sheet_expected.borders);
    }

    #[test]
    #[parallel]
    fn remove_row_middle() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_row(5);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 9, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(
            sheet.borders.borders_in_sheet(),
            sheet_expected.borders.borders_in_sheet()
        );
    }

    #[test]
    #[parallel]
    fn remove_row_end() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet_mut(sheet_id);
        sheet.borders.remove_row(10);

        let mut gc_expected = GridController::test();
        let sheet_id = gc_expected.sheet_ids()[0];
        gc_expected.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 10, 9, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );
        let sheet_expected = gc_expected.sheet(sheet_id);
        assert_eq!(
            sheet.borders.borders_in_sheet(),
            sheet_expected.borders.borders_in_sheet()
        );
    }

    #[test]
    #[parallel]
    fn to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(crate::SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let clipboard = gc
            .sheet(sheet_id)
            .borders
            .to_clipboard(&Selection::sheet_rect(crate::SheetRect::new(
                0, 0, 3, 3, sheet_id,
            )))
            .unwrap();

        let entry = clipboard.get_at(6).unwrap();
        assert_eq!(entry.top.unwrap().unwrap().line, CellBorderLine::default());
        assert_eq!(entry.top.unwrap().unwrap().color, Rgba::default());
        assert_eq!(entry.left.unwrap().unwrap().line, CellBorderLine::default());
        assert_eq!(entry.left.unwrap().unwrap().color, Rgba::default());
        assert_eq!(
            entry.bottom.unwrap().unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(entry.bottom.unwrap().unwrap().color, Rgba::default());
        assert_eq!(
            entry.right.unwrap().unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(entry.right.unwrap().unwrap().color, Rgba::default());
    }

    #[test]
    #[parallel]
    fn get_column_ops() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let ops = sheet.borders.get_column_ops(sheet_id, 1);
        assert_eq!(ops.len(), 1);

        let mut selection = Selection::default();
        selection.sheet_id = sheet_id;
        selection.rects = Some(vec![Rect::new(1, 1, 1, 2)]);
        assert_eq!(
            ops[0],
            Operation::SetBordersSelection {
                selection,
                borders: BorderStyleCellUpdates::repeat(BorderStyleCellUpdate::all(), 2),
            }
        );
    }

    #[test]
    #[parallel]
    fn get_row_ops() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 2, 2, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let ops = sheet.borders.get_row_ops(sheet_id, 1);
        assert_eq!(ops.len(), 1);

        let mut selection = Selection::default();
        selection.sheet_id = sheet_id;
        selection.rects = Some(vec![Rect::new(1, 1, 2, 1)]);
        assert_eq!(
            ops[0],
            Operation::SetBordersSelection {
                selection,
                borders: BorderStyleCellUpdates::repeat(BorderStyleCellUpdate::all(), 2),
            }
        );
    }
}
