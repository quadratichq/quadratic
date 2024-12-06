use crate::{A1Selection, Pos};

use super::{BordersA1, BordersA1Updates};

impl BordersA1 {
    /// Prepares borders within the selection for copying to the clipboard.
    ///
    /// Returns `None` if there are no borders to copy.
    pub fn to_clipboard(&self, selection: &A1Selection) -> Option<BordersA1Updates> {
        let mut updates = BordersA1Updates::default();

        for range in selection.ranges.iter() {
            if let Some(rect) = range.to_rect() {
                for x in rect.x_range() {
                    for y in rect.y_range() {
                        updates.set_style_cell(Pos::new(x, y), self.get_style_cell(Pos::new(x, y)));
                    }
                }
            }
        }

        // TODO(ddimaria): remove, just using this as a reference for now
        // if selection.all {
        //     updates.push(self.all.override_border(false));
        // }
        // if let Some(column) = selection.columns.as_ref() {
        //     for col in column {
        //         if let Some(border_col) = self.columns.get(col) {
        //             updates.push(border_col.override_border(false));
        //         } else {
        //             updates.push(BorderStyleCell::clear());
        //         }
        //     }
        // }
        // if let Some(row) = selection.rows.as_ref() {
        //     for row in row {
        //         if let Some(border_row) = self.rows.get(row) {
        //             updates.push(border_row.override_border(false));
        //         } else {
        //             updates.push(BorderStyleCell::clear());
        //         }
        //     }
        // }
        // if let Some(rects) = selection.rects.as_ref() {
        //     for rect in rects {
        //         for row in rect.min.y..=rect.max.y {
        //             for col in rect.min.x..=rect.max.x {
        //                 updates.push(self.update_override(col, row));
        //             }
        //         }
        //     }
        // }
        // if updates.is_empty() {
        //     None
        // } else {
        //     Some(updates)
        // }

        Some(updates)
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;
    use crate::{
        controller::GridController,
        grid::sheet::borders_a1::{BorderSelection, BorderStyle, CellBorderLine},
        SheetRect,
    };

    #[test]
    #[parallel]
    fn to_clipboard() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders(
            A1Selection::from_rect(SheetRect::new(1, 1, 10, 10, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        let copy = sheet
            .borders_a1
            .to_clipboard(&A1Selection::from_rect(SheetRect::new(
                1, 1, 1, 1, sheet_id,
            )));

        dbg!(&copy);
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
            .borders_a1
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
