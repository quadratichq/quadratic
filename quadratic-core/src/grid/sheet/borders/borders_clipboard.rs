use crate::{a1::A1Selection, grid::Sheet, Pos};

use super::{Borders, BordersUpdates};

impl Borders {
    /// Prepares borders within the selection for copying to the clipboard.
    ///
    /// Returns `None` if there are no borders to copy.
    pub fn to_clipboard(&self, sheet: &Sheet, selection: &A1Selection) -> Option<BordersUpdates> {
        let mut updates = BordersUpdates::default();
        for rect in sheet.selection_to_rects(selection, false) {
            for x in rect.x_range() {
                for y in rect.y_range() {
                    updates.set_style_cell(Pos::new(x, y), self.get_style_cell(Pos::new(x, y)));
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
        grid::sheet::borders::{BorderSelection, BorderStyle, CellBorderLine},
        SheetRect,
    };

    #[test]
    #[parallel]
    fn to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:B2"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let clipboard = gc
            .sheet(sheet_id)
            .borders
            .to_clipboard(sheet, &A1Selection::test_a1("A1:C3"))
            .unwrap();

        assert_eq!(
            clipboard
                .clone()
                .top
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            clipboard
                .clone()
                .top
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .color,
            Rgba::default()
        );
        assert_eq!(
            clipboard
                .clone()
                .left
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            clipboard
                .clone()
                .left
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .color,
            Rgba::default()
        );
        assert_eq!(
            clipboard
                .clone()
                .bottom
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            clipboard
                .clone()
                .bottom
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .color,
            Rgba::default()
        );
        assert_eq!(
            clipboard
                .clone()
                .right
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            clipboard
                .clone()
                .right
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .color,
            Rgba::default()
        );
    }

    #[test]
    #[parallel]
    fn simple_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::from_rect(SheetRect::new(1, 1, 1, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let copy = sheet
            .borders
            .to_clipboard(
                sheet,
                &A1Selection::from_rect(SheetRect::new(1, 1, 1, 1, sheet_id)),
            )
            .unwrap();

        assert_eq!(
            copy.top.unwrap().get(Pos::new(1, 1)).unwrap().unwrap().line,
            CellBorderLine::default()
        );
        assert_eq!(
            copy.bottom
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            copy.left
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            copy.right
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
    }
}
