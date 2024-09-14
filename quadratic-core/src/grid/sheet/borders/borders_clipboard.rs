use crate::selection::Selection;

use super::{BorderStyleCell, BorderStyleCellUpdates, Borders};

impl Borders {
    /// Prepares borders within the selection for copying to the clipboard.
    ///
    /// Returns `None` if there are no borders to copy.
    pub fn to_clipboard(&self, selection: &Selection) -> Option<BorderStyleCellUpdates> {
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
                        updates.push(self.get_update_override(col, row));
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
        color::Rgba,
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
    fn simple_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let copy = sheet
            .borders
            .to_clipboard(&Selection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id)))
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
