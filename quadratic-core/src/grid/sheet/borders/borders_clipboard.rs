use crate::a1::A1Selection;

use super::{Borders, BordersUpdates};

// todo: this is wrong. it does not properly handle infinite selections (it cuts
// them off at the bounds of the sheet)

impl Borders {
    /// Prepares borders within the selection for copying to the clipboard.
    ///
    /// Returns `None` if there are no borders to copy.
    pub(crate) fn to_clipboard(&self, selection: &A1Selection) -> Option<BordersUpdates> {
        Some(BordersUpdates {
            left: Some(self.left.get_update_for_selection(selection)),
            right: Some(self.right.get_update_for_selection(selection)),
            top: Some(self.top.get_update_for_selection(selection)),
            bottom: Some(self.bottom.get_update_for_selection(selection)),
        })
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::{
        Pos, SheetRect,
        color::Rgba,
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle, CellBorderLine},
    };

    #[test]
    fn to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::test_a1("A1:B2"),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let clipboard = gc
            .sheet(sheet_id)
            .borders
            .to_clipboard(&A1Selection::test_a1("A1:C3"))
            .unwrap();

        assert_eq!(
            clipboard
                .top
                .as_ref()
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            clipboard
                .top
                .as_ref()
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .color,
            Rgba::default()
        );
        assert_eq!(
            clipboard
                .left
                .as_ref()
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            clipboard
                .left
                .as_ref()
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .color,
            Rgba::default()
        );
        assert_eq!(
            clipboard
                .bottom
                .as_ref()
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            clipboard
                .bottom
                .as_ref()
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .color,
            Rgba::default()
        );
        assert_eq!(
            clipboard
                .right
                .as_ref()
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .line,
            CellBorderLine::default()
        );
        assert_eq!(
            clipboard
                .right
                .as_ref()
                .unwrap()
                .get(Pos::new(1, 1))
                .unwrap()
                .unwrap()
                .color,
            Rgba::default()
        );
    }

    #[test]
    fn simple_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::from_rect(SheetRect::new(1, 1, 1, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
            false,
        );

        let sheet = gc.sheet(sheet_id);
        let copy = sheet
            .borders
            .to_clipboard(&A1Selection::from_rect(SheetRect::new(
                1, 1, 1, 1, sheet_id,
            )))
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
