use crate::Rect;

use super::Borders;

impl Borders {
    /// Finds the rect that contains borders that would be overwritten by the column.
    pub(crate) fn bounds_column(
        &self,
        column: i64,
        left_update: bool,
        right_update: bool,
    ) -> Option<Rect> {
        let mut x_min: Option<i64> = None;
        let mut x_max: Option<i64> = None;
        let mut y_min: Option<i64> = None;
        let mut y_max: Option<i64> = None;

        self.left.iter().for_each(|(x, data)| {
            if *x == column || (right_update && *x == column + 1) {
                y_min = Some(
                    y_min
                        .unwrap_or(i64::MAX)
                        .min(data.min().unwrap_or(i64::MAX)),
                );
                y_max = Some(
                    y_max
                        .unwrap_or(i64::MIN)
                        .max(data.max().unwrap_or(i64::MIN)),
                );
                let c = if *x == column { column } else { column + 1 };
                x_min = Some(x_min.unwrap_or(c).min(c));
                x_max = Some(x_max.unwrap_or(c).max(c));
            }
        });
        self.right.iter().for_each(|(x, data)| {
            if *x == column || (left_update && *x == column - 1) {
                y_min = Some(
                    y_min
                        .unwrap_or(i64::MAX)
                        .min(data.min().unwrap_or(i64::MAX)),
                );
                y_max = Some(
                    y_max
                        .unwrap_or(i64::MIN)
                        .max(data.max().unwrap_or(i64::MIN)),
                );
                let c = if *x == column { column } else { column - 1 };
                x_min = Some(x_min.unwrap_or(c).min(c));
                x_max = Some(x_max.unwrap_or(c).max(c));
            }
        });
        self.top.iter().for_each(|(y, data)| {
            if data.get(column).is_some() {
                y_min = Some(y_min.unwrap_or(i64::MAX).min(*y));
                y_max = Some(y_max.unwrap_or(i64::MIN).max(*y));
                x_min = Some(x_min.unwrap_or(column).min(column));
                x_max = Some(x_max.unwrap_or(column).max(column));
            }
        });
        self.bottom.iter().for_each(|(y, data)| {
            if data.get(column).is_some() {
                y_min = Some(y_min.unwrap_or(i64::MAX).min(*y));
                y_max = Some(y_max.unwrap_or(i64::MIN).max(*y));
                x_min = Some(x_min.unwrap_or(column).min(column));
                x_max = Some(x_max.unwrap_or(column).max(column));
            }
        });

        if let (Some(x_min), Some(x_max), Some(y_min), Some(y_max)) = (x_min, x_max, y_min, y_max) {
            Some(Rect::new(x_min, y_min, x_max, y_max))
        } else {
            None
        }
    }

    /// Finds the rect that contains row that would be overwritten by the row.
    pub(crate) fn bounds_row(
        &self,
        row: i64,
        top_update: bool,
        bottom_update: bool,
    ) -> Option<Rect> {
        let mut x_min: Option<i64> = None;
        let mut x_max: Option<i64> = None;
        let mut y_min: Option<i64> = None;
        let mut y_max: Option<i64> = None;

        self.top.iter().for_each(|(y, data)| {
            if *y == row || (top_update && *y == row + 1) {
                x_min = Some(
                    x_min
                        .unwrap_or(i64::MAX)
                        .min(data.min().unwrap_or(i64::MAX)),
                );
                x_max = Some(
                    x_max
                        .unwrap_or(i64::MIN)
                        .max(data.max().unwrap_or(i64::MIN)),
                );
                let c = if *y == row { row } else { row + 1 };
                y_min = Some(y_min.unwrap_or(c).min(c));
                y_max = Some(y_max.unwrap_or(c).max(c));
            }
        });
        self.bottom.iter().for_each(|(y, data)| {
            if *y == row || (bottom_update && *y == row - 1) {
                x_min = Some(
                    x_min
                        .unwrap_or(i64::MAX)
                        .min(data.min().unwrap_or(i64::MAX)),
                );
                x_max = Some(
                    x_max
                        .unwrap_or(i64::MIN)
                        .max(data.max().unwrap_or(i64::MIN)),
                );
                let c = if *y == row { row } else { row - 1 };
                y_min = Some(y_min.unwrap_or(c).min(c));
                y_max = Some(y_max.unwrap_or(c).max(c));
            }
        });
        self.left.iter().for_each(|(x, data)| {
            if data.get(row).is_some() {
                x_min = Some(x_min.unwrap_or(i64::MAX).min(*x));
                x_max = Some(x_max.unwrap_or(i64::MIN).max(*x));
                y_min = Some(y_min.unwrap_or(row).min(row));
                y_max = Some(y_max.unwrap_or(row).max(row));
            }
        });
        self.right.iter().for_each(|(x, data)| {
            if data.get(row).is_some() {
                x_min = Some(x_min.unwrap_or(i64::MAX).min(*x));
                x_max = Some(x_max.unwrap_or(i64::MIN).max(*x));
                y_min = Some(y_min.unwrap_or(row).min(row));
                y_max = Some(y_max.unwrap_or(row).max(row));
            }
        });

        if let (Some(x_min), Some(x_max), Some(y_min), Some(y_max)) = (x_min, x_max, y_min, y_max) {
            Some(Rect::new(x_min, y_min, x_max, y_max))
        } else {
            None
        }
    }

    /// Returns the bounds of the borders.
    ///
    /// It offsets right and bottom by 1 because the borders are rendered by the
    /// next cell/row. For example, if there is a full border at (1, 1), then
    /// the bounds are (1, 1, 2, 2) so the border is rendered at (1, 1) and (2,
    /// 2).
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

    use super::*;

    use crate::{
        color::Rgba,
        controller::GridController,
        grid::sheet::borders::{BorderSelection, BorderStyle, CellBorderLine},
        selection::Selection,
        SheetRect,
    };

    #[test]
    #[parallel]
    fn bounds_single() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 1, 1, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.bounds(), Some(Rect::new(1, 1, 2, 2)))
    }

    #[test]
    #[parallel]
    fn bounds_outer() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let sheet = gc.sheet(sheet_id);
        let bounds = sheet.borders.bounds();
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
        let bounds = sheet.borders.bounds();
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
        assert_eq!(sheet.borders.bounds(), Some(Rect::new(0, 0, 5, 5)));
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
        assert_eq!(sheet.borders.bounds(), Some(Rect::new(0, 0, 5, 0)));
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
        assert_eq!(sheet.borders.bounds(), Some(Rect::new(6, 0, 6, 5)));
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
        assert_eq!(sheet.borders.bounds(), Some(Rect::new(0, 0, 0, 5)));
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
        sheet.borders.print();
        assert_eq!(sheet.borders.bounds(), Some(Rect::new(0, 6, 5, 6)));
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
        assert_eq!(sheet.borders.bounds(), Some(Rect::new(0, 1, 5, 5)));
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
        assert_eq!(sheet.borders.bounds(), Some(Rect::new(1, 0, 5, 5)));
    }

    #[test]
    #[parallel]
    fn bounds_column_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 5, 5, sheet_id)),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);

        assert_eq!(sheet.borders.bounds_column(10, true, true), None);
        assert_eq!(
            sheet.borders.bounds_column(1, true, true),
            Some(Rect::new(1, 1, 2, 5))
        );
        assert_eq!(
            sheet.borders.bounds_column(0, true, true),
            Some(Rect::new(1, 1, 1, 5))
        );
    }

    #[test]
    #[parallel]
    fn bounds_column_left() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 5, 5, sheet_id)),
            BorderSelection::Left,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(
            sheet.borders.bounds_column(0, true, true),
            Some(Rect::new(1, 1, 1, 5))
        );
        assert_eq!(
            sheet.borders.bounds_column(1, true, true),
            Some(Rect::new(1, 1, 1, 5))
        );
        assert_eq!(sheet.borders.bounds_column(2, true, true), None);
    }

    #[test]
    #[parallel]
    fn bounds_column_right() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 1, 5, sheet_id)),
            BorderSelection::Right,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.bounds_column(0, true, true), None);
        assert_eq!(
            sheet.borders.bounds_column(1, true, true),
            Some(Rect::new(1, 1, 1, 5))
        );
        assert_eq!(
            sheet.borders.bounds_column(2, true, true),
            Some(Rect::new(1, 1, 1, 5))
        );
    }

    #[test]
    #[parallel]
    fn bounds_column_top() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 5, 5, sheet_id)),
            BorderSelection::Top,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.bounds_column(0, true, true), None);
        assert_eq!(
            sheet.borders.bounds_column(1, true, true),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            sheet.borders.bounds_column(2, true, true),
            Some(Rect::new(2, 1, 2, 1))
        );
    }

    #[test]
    #[parallel]
    fn bounds_column_bottom() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 5, 5, sheet_id)),
            BorderSelection::Bottom,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.bounds_column(0, true, true), None);
        assert_eq!(
            sheet.borders.bounds_column(1, true, true),
            Some(Rect::new(1, 5, 1, 5))
        );
        assert_eq!(
            sheet.borders.bounds_column(5, true, true),
            Some(Rect::new(5, 5, 5, 5))
        );
        assert_eq!(sheet.borders.bounds_column(6, true, true), None);
    }

    #[test]
    #[parallel]
    fn bounds_row_left() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 5, 5, sheet_id)),
            BorderSelection::Left,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.bounds_row(0, true, true), None);
        assert_eq!(
            sheet.borders.bounds_row(1, true, true),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            sheet.borders.bounds_row(2, true, true),
            Some(Rect::new(1, 2, 1, 2))
        );
        assert_eq!(
            sheet.borders.bounds_row(5, true, true),
            Some(Rect::new(1, 5, 1, 5))
        );
        assert_eq!(sheet.borders.bounds_row(6, true, true), None);
    }

    #[test]
    #[parallel]
    fn bounds_row_right() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        gc.set_borders_selection(
            Selection::sheet_rect(SheetRect::new(1, 1, 5, 5, sheet_id)),
            BorderSelection::Right,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert_eq!(sheet.borders.bounds_row(0, true, true), None);
        assert_eq!(
            sheet.borders.bounds_row(1, true, true),
            Some(Rect::new(5, 1, 5, 1))
        );
        assert_eq!(
            sheet.borders.bounds_row(3, true, true),
            Some(Rect::new(5, 3, 5, 3))
        );
        assert_eq!(
            sheet.borders.bounds_row(5, true, true),
            Some(Rect::new(5, 5, 5, 5))
        );
        assert_eq!(sheet.borders.bounds_row(6, true, true), None);
    }
}
