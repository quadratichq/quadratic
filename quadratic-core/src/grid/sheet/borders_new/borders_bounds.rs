use crate::Rect;

use super::Borders;

impl Borders {
    /// Returns the bounds of the borders. It needs to offset right and bottom by 1
    /// because the borders are rendered by the next cell/row.
    pub(crate) fn bounds(&self) -> Option<Rect> {
        let x_start_left = self.left.keys().min().copied();
        let x_start_right = self.right.keys().min().copied().map(|x| x + 1);
        let x_start_top = self.top.values().flat_map(|col| col.min()).min();
        let x_start_bottom = self.bottom.values().flat_map(|col| col.min()).min();
        let x_start = x_start_left
            .into_iter()
            .chain(x_start_right)
            .chain(x_start_top)
            .chain(x_start_bottom)
            .min();

        let x_end_left = self.left.keys().max().copied();
        let x_end_right = self.right.keys().max().copied().map(|x| x + 1);
        let x_end_top = self.top.values().flat_map(|col| col.max()).max();
        let x_end_bottom = self.bottom.values().flat_map(|col| col.max()).max();
        let x_end = x_end_left
            .into_iter()
            .chain(x_end_right)
            .chain(x_end_top)
            .chain(x_end_bottom)
            .max();

        let y_start_top = self.top.keys().min().copied();
        let y_start_bottom = self.bottom.keys().min().copied().map(|y| y + 1);
        let y_start_left = self.left.values().flat_map(|col| col.min()).min();
        let y_start_right = self.right.values().flat_map(|col| col.min()).min();
        let y_start = y_start_top
            .into_iter()
            .chain(y_start_bottom)
            .chain(y_start_left)
            .chain(y_start_right)
            .min();

        let y_end_top = self.top.keys().max().copied();
        let y_end_bottom = self.bottom.keys().max().copied().map(|y| y + 1);
        let y_end_left = self.left.values().flat_map(|col| col.max()).max();
        let y_end_right = self.right.values().flat_map(|col| col.max()).max();
        let y_end = y_end_top
            .into_iter()
            .chain(y_end_bottom)
            .chain(y_end_left)
            .chain(y_end_right)
            .max();

        match (x_start, y_start, x_end, y_end) {
            (Some(x_start), Some(y_start), Some(x_end), Some(y_end)) => {
                Some(Rect::new(x_start, y_start, x_end, y_end))
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::sheet::borders_new::borders_style::{BorderSelection, BorderStyle, CellBorderLine},
        selection::Selection,
        SheetRect,
    };

    use super::*;

    #[test]
    #[parallel]
    fn bounds_outer() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders_new.bounds();
        assert_eq!(bounds, None);

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 10, 10, sheet_id)),
            BorderSelection::Outer,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders_new.bounds();
        assert_eq!(bounds, Some(Rect::new(0, 0, 11, 11)));
    }

    #[test]
    #[parallel]
    fn bounds_inner() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Inner,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders_new.bounds(), Some(Rect::new(0, 0, 5, 5)));
    }

    #[test]
    #[parallel]
    fn bounds_top() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Top,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders_new.bounds(), Some(Rect::new(0, 0, 5, 0)));
    }

    #[test]
    #[parallel]
    fn bounds_right() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Right,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders_new.bounds(), Some(Rect::new(6, 0, 6, 5)));
    }

    #[test]
    #[parallel]
    fn bounds_left() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Left,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders_new.bounds(), Some(Rect::new(0, 0, 0, 5)));
    }

    #[test]
    #[parallel]
    fn bounds_bottom() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Bottom,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        sheet.borders_new.print_borders();
        assert_eq!(sheet.borders_new.bounds(), Some(Rect::new(0, 6, 5, 6)));
    }

    #[test]
    #[parallel]
    fn bounds_horizontal() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Horizontal,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders_new.bounds(), Some(Rect::new(0, 1, 5, 5)));
    }

    #[test]
    #[parallel]
    fn bounds_vertical() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(0, 0, 5, 5, sheet_id)),
            BorderSelection::Vertical,
            Some(BorderStyle {
                color: Rgba::new(255, 0, 0, 255),
                line: CellBorderLine::Dotted,
            }),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders_new.bounds(), Some(Rect::new(1, 0, 5, 5)));
    }
}
