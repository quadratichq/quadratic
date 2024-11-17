use crate::selection::OldSelection;

use super::{BorderStyleCell, BorderStyleCellUpdates, Borders};

impl Borders {
    /// Prepares borders within the selection for copying to the clipboard.
    ///
    /// Returns `None` if there are no borders to copy.
    pub fn to_clipboard(&self, selection: &OldSelection) -> Option<BorderStyleCellUpdates> {
        let mut updates = BorderStyleCellUpdates::default();

        if selection.all {
            updates.push(self.all.override_border(false));
        }
        if let Some(column) = selection.columns.as_ref() {
            for col in column {
                if let Some(border_col) = self.columns.get(col) {
                    updates.push(border_col.override_border(false));
                } else {
                    updates.push(BorderStyleCell::clear());
                }
            }
        }
        if let Some(row) = selection.rows.as_ref() {
            for row in row {
                if let Some(border_row) = self.rows.get(row) {
                    updates.push(border_row.override_border(false));
                } else {
                    updates.push(BorderStyleCell::clear());
                }
            }
        }
        if let Some(rects) = selection.rects.as_ref() {
            for rect in rects {
                for row in rect.min.y..=rect.max.y {
                    for col in rect.min.x..=rect.max.x {
                        updates.push(self.update_override(col, row));
                    }
                }
            }
        }
        if updates.is_empty() {
            None
        } else {
            Some(updates)
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;
    use crate::{
        controller::GridController,
        grid::{BorderSelection, BorderStyle, CellBorderLine},
        SheetRect,
    };

    #[test]
    #[parallel]
    fn to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            OldSelection::sheet_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let copy = sheet
            .borders
            .to_clipboard(&OldSelection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id)));

        dbg!(&copy);
    }

    #[test]
    #[parallel]
    fn simple_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            OldSelection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let copy = sheet
            .borders
            .to_clipboard(&OldSelection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id)))
            .unwrap();

        assert_eq!(copy.size(), 1);
        let first = copy.get_at(0).unwrap();
        assert_eq!(first.top.unwrap().unwrap().line, CellBorderLine::default());
        assert_eq!(
            first.bottom.unwrap().unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(first.left.unwrap().unwrap().line, CellBorderLine::default());
        assert_eq!(
            first.right.unwrap().unwrap().line,
            CellBorderLine::default()
        );
    }
}
