use super::{BorderStyleCell, BorderStyleCellUpdate, Borders};

impl Borders {
    /// Gets a BorderStyleCellUpdate for a cell that will override the current
    /// cell. This is called by the clipboard.
    pub fn get_update_override(&self, x: i64, y: i64) -> BorderStyleCellUpdate {
        let mut cell = BorderStyleCell::default();

        if self.all.top.is_some() {
            cell.top = self.all.top;
        }
        if self.all.bottom.is_some() {
            cell.bottom = self.all.bottom;
        }
        if self.all.left.is_some() {
            cell.left = self.all.left;
        }
        if self.all.right.is_some() {
            cell.right = self.all.right;
        }

        // for columns and rows, we'll have to compare the timestamps to get the correct value
        let column = self.columns.get(&x);
        let row = self.rows.get(&y);

        match (column, row) {
            (Some(column), Some(row)) => {
                match (column.top, row.top) {
                    (Some(column_top), Some(row_top)) => {
                        if column_top.timestamp > row_top.timestamp {
                            cell.top = Some(column_top);
                        } else {
                            cell.top = Some(row_top);
                        }
                    }
                    (Some(column_top), None) => {
                        cell.top = Some(column_top);
                    }
                    (None, Some(row_top)) => {
                        cell.top = Some(row_top);
                    }
                    (None, None) => {}
                }
                match (column.bottom, row.bottom) {
                    (Some(column_bottom), Some(row_bottom)) => {
                        if column_bottom.timestamp > row_bottom.timestamp {
                            cell.bottom = Some(column_bottom);
                        } else {
                            cell.bottom = Some(row_bottom);
                        }
                    }
                    (Some(column_bottom), None) => {
                        cell.bottom = Some(column_bottom);
                    }
                    (None, Some(row_bottom)) => {
                        cell.bottom = Some(row_bottom);
                    }
                    (None, None) => {}
                }
                match (column.left, row.left) {
                    (Some(column_left), Some(row_left)) => {
                        if column_left.timestamp > row_left.timestamp {
                            cell.left = Some(column_left);
                        } else {
                            cell.left = Some(row_left);
                        }
                    }
                    (Some(column_left), None) => {
                        cell.left = Some(column_left);
                    }
                    (None, Some(row_left)) => {
                        cell.left = Some(row_left);
                    }
                    (None, None) => {}
                }
                match (column.right, row.right) {
                    (Some(column_right), Some(row_right)) => {
                        if column_right.timestamp > row_right.timestamp {
                            cell.right = Some(column_right);
                        } else {
                            cell.right = Some(row_right);
                        }
                    }
                    (Some(column_right), None) => {
                        cell.right = Some(column_right);
                    }
                    (None, Some(row_right)) => {
                        cell.right = Some(row_right);
                    }
                    (None, None) => {}
                }
            }
            (Some(column), None) => {
                if column.top.is_some() {
                    cell.top = column.top;
                }
                if column.bottom.is_some() {
                    cell.bottom = column.bottom;
                }
                if column.left.is_some() {
                    cell.left = column.left;
                }
                if column.right.is_some() {
                    cell.right = column.right;
                }
            }
            (None, Some(row)) => {
                if row.top.is_some() {
                    cell.top = row.top;
                }
                if row.bottom.is_some() {
                    cell.bottom = row.bottom;
                }
                if row.left.is_some() {
                    cell.left = row.left;
                }
                if row.right.is_some() {
                    cell.right = row.right;
                }
            }
            (None, None) => {}
        }

        let c = self.get(x, y);
        if c.top.is_some() {
            cell.top = c.top;
        }
        if c.bottom.is_some() {
            cell.bottom = c.bottom;
        }
        if c.left.is_some() {
            cell.left = c.left;
        }
        if c.right.is_some() {
            cell.right = c.right;
        }

        cell.override_border(false)
    }

    /// Gets the border style for a cell.
    pub fn get(&self, x: i64, y: i64) -> BorderStyleCell {
        let top = self.top.get(&x).and_then(|row| row.get(y));
        let bottom = self.bottom.get(&(y)).and_then(|row| row.get(x));
        let left = self.left.get(&y).and_then(|row| row.get(x));
        let right = self.right.get(&(y)).and_then(|row| row.get(x));

        BorderStyleCell {
            top,
            bottom,
            left,
            right,
        }
    }

    /// Gets an update to undo the border to its current state.
    pub fn try_get_update(&self, x: i64, y: i64) -> Option<BorderStyleCellUpdate> {
        let cell = self.get(x, y);
        if cell.top.is_some()
            || cell.bottom.is_some()
            || cell.left.is_some()
            || cell.right.is_some()
        {
            Some(cell.override_border(false))
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::{BorderSelection, BorderStyle, CellBorderLine},
        selection::Selection,
    };

    #[test]
    #[parallel]
    fn get() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(crate::SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let cell = sheet.borders.get(1, 1);
        assert_eq!(cell.top.unwrap().line, CellBorderLine::default());
        assert_eq!(cell.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(cell.left.unwrap().line, CellBorderLine::default());
        assert_eq!(cell.right.unwrap().line, CellBorderLine::default());
        assert_eq!(cell.top.unwrap().color, Rgba::default());
        assert_eq!(cell.bottom.unwrap().color, Rgba::default());
        assert_eq!(cell.left.unwrap().color, Rgba::default());
        assert_eq!(cell.right.unwrap().color, Rgba::default());
    }

    #[test]
    #[parallel]
    fn get_update_override() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        // Set initial borders
        gc.set_borders_selection(
            Selection::sheet_rect(crate::SheetRect::new(0, 0, 0, 0, sheet_id)),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);

        // Check updated cell
        let updated_cell = sheet.borders.get_update_override(0, 0);
        assert_eq!(
            updated_cell.top.unwrap().unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(updated_cell.bottom, Some(None));
        assert_eq!(updated_cell.left, Some(None));
        assert_eq!(updated_cell.right, Some(None));
    }

    #[test]
    #[parallel]
    fn try_get() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(crate::SheetRect::new(0, 0, 0, 0, sheet_id)),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let cell = sheet.borders.get(0, 0);
        assert_eq!(cell.top.unwrap().line, CellBorderLine::default());
        assert_eq!(cell.bottom, None);
        assert_eq!(cell.left, None);
        assert_eq!(cell.right, None);
    }
}
