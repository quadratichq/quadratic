use crate::Pos;

use super::{BorderStyleCell, BorderStyleCellUpdate, Borders};

impl Borders {
    /// Gets a BorderStyleCellUpdate for a cell that will override the current
    /// cell. This is called by the clipboard.
    pub fn update_override(&self, x: i64, y: i64) -> BorderStyleCellUpdate {
        let mut cell = self.all;

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
                cell.top = column.top.or(cell.top);
                cell.bottom = column.bottom.or(cell.bottom);
                cell.left = column.left.or(cell.left);
                cell.right = column.right.or(cell.right);
            }
            (None, Some(row)) => {
                cell.top = row.top.or(cell.top);
                cell.bottom = row.bottom.or(cell.bottom);
                cell.left = row.left.or(cell.left);
                cell.right = row.right.or(cell.right);
            }
            (None, None) => {}
        }

        let c = self.get(x, y);
        cell.top = c.top.or(cell.top);
        cell.bottom = c.bottom.or(cell.bottom);
        cell.left = c.left.or(cell.left);
        cell.right = c.right.or(cell.right);

        cell.override_border(false)
    }

    /// Gets the border style for a cell.
    pub fn get(&self, x: i64, y: i64) -> BorderStyleCell {
        let top = self.top.get(&y).and_then(|row| row.get(x));
        let bottom = self.bottom.get(&(y)).and_then(|row| row.get(x));
        let left = self.left.get(&x).and_then(|row| row.get(y));
        let right = self.right.get(&(x)).and_then(|row| row.get(y));

        BorderStyleCell {
            top,
            bottom,
            left,
            right,
        }
    }

    /// Gets the border style for a cell from an A1 string. Returns None if a1
    /// string is invalid or the border style is empty.
    pub fn try_from_a1(&self, a1: &str) -> Option<BorderStyleCell> {
        if let Some(pos) = Pos::try_a1_string(a1) {
            let border = self.get(pos.x, pos.y);
            if border.is_empty() {
                None
            } else {
                Some(border)
            }
        } else {
            dbgjs!(format!("Invalid A1 string {}", a1));
            None
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
        let updated_cell = sheet.borders.update_override(0, 0);
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

    #[test]
    #[parallel]
    fn one_cell_get() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(crate::SheetRect::new(1, 1, 1, 1, sheet_id)),
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
    }

    #[test]
    #[parallel]
    fn try_from_a1() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        gc.set_borders_selection(
            Selection::sheet_rect(crate::SheetRect::new(1, 1, 1, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let cell = sheet.borders.try_from_a1("A1").unwrap();
        assert_eq!(cell.top.unwrap().line, CellBorderLine::default());
        assert_eq!(cell.bottom.unwrap().line, CellBorderLine::default());
        assert_eq!(cell.left.unwrap().line, CellBorderLine::default());
        assert_eq!(cell.right.unwrap().line, CellBorderLine::default());

        assert_eq!(sheet.borders.try_from_a1("none"), None);
    }
}
