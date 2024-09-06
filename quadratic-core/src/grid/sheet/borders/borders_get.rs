use super::{BorderSide, BorderStyleCell, BorderStyleCellUpdate, Borders};

impl Borders {
    /// Gets a BorderStyleCellUpdate for a cell that will override the current
    /// cell. This is called by the clipboard.
    pub fn get_update_override(&self, x: i64, y: i64) -> BorderStyleCellUpdate {
        let mut cell = self.get(x, y);

        if !cell.top.is_some() && self.all.top.is_some() {
            cell.top = self.all.top.into();
        }
        if !cell.bottom.is_some() && self.all.bottom.is_some() {
            cell.bottom = self.all.bottom.into();
        }
        if !cell.left.is_some() && self.all.left.is_some() {
            cell.left = self.all.left.into();
        }
        if !cell.right.is_some() && self.all.right.is_some() {
            cell.right = self.all.right.into();
        }

        if let Some(column) = self.columns.get(&x) {
            if !cell.top.is_some() && column.top.is_some() {
                cell.top = column.top.into();
            }
            if !cell.bottom.is_some() && column.bottom.is_some() {
                cell.bottom = column.bottom.into();
            }
            if !cell.left.is_some() && column.left.is_some() {
                cell.left = column.left.into();
            }
            if !cell.right.is_some() && column.right.is_some() {
                cell.right = column.right.into();
            }
        }

        if let Some(row) = self.rows.get(&y) {
            if !cell.top.is_some() && row.top.is_some() {
                cell.top = row.top.into();
            }
            if !cell.bottom.is_some() && row.bottom.is_some() {
                cell.bottom = row.bottom.into();
            }
            if !cell.left.is_some() && row.left.is_some() {
                cell.left = row.left.into();
            }
            if !cell.right.is_some() && row.right.is_some() {
                cell.right = row.right.into();
            }
        }

        cell.override_border(false)
    }

    /// Gets the border style for a cell used in tests.
    pub fn get(&self, x: i64, y: i64) -> BorderStyleCell {
        let top = self.top.get(&x).and_then(|row| row.get(y));
        let bottom = self.bottom.get(&(y)).and_then(|row| row.get(x));
        let left = self.left.get(&y).and_then(|row| row.get(x));
        let right = self.right.get(&(y)).and_then(|row| row.get(x));

        super::BorderStyleCell {
            top,
            bottom,
            left,
            right,
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
}
