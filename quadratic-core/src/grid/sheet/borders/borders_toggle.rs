use crate::{selection::Selection, Rect};

use super::{sides::Sides, BorderSelection, BorderStyle, BorderStyleCell, Borders};

impl Borders {
    fn is_same_sheet(
        border_selection: BorderSelection,
        style: BorderStyle,
        other: &BorderStyleCell,
    ) -> bool {
        match border_selection {
            BorderSelection::All | BorderSelection::Inner | BorderSelection::Outer => {
                if let Some(left) = other.left {
                    if !left.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            BorderSelection::Left => {
                if let Some(left) = other.left {
                    if !left.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            BorderSelection::Right => {
                if let Some(right) = other.right {
                    if !right.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            BorderSelection::Top => {
                if let Some(top) = other.top {
                    if !top.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            BorderSelection::Bottom => {
                if let Some(bottom) = other.bottom {
                    if !bottom.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            BorderSelection::Horizontal => {
                if let Some(top) = other.top {
                    if !top.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
                if let Some(bottom) = other.bottom {
                    if !bottom.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            BorderSelection::Vertical => {
                if let Some(left) = other.left {
                    if !left.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
                if let Some(right) = other.right {
                    if !right.is_equal_to_border_style(&style) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            BorderSelection::Clear => return false,
        }
        true
    }

    fn is_same_style(border: BorderStyleCell, style: &BorderStyle, sides: Sides) -> bool {
        if sides.left {
            if let Some(left) = border.left {
                if !left.is_equal_to_border_style(style) {
                    return false;
                }
            } else {
                return false;
            }
        }
        if sides.right {
            if let Some(right) = border.right {
                if !right.is_equal_to_border_style(style) {
                    return false;
                }
            } else {
                return false;
            }
        }
        if sides.top {
            if let Some(top) = border.top {
                if !top.is_equal_to_border_style(style) {
                    return false;
                }
            } else {
                return false;
            }
        }
        if sides.bottom {
            if let Some(bottom) = border.bottom {
                if !bottom.is_equal_to_border_style(style) {
                    return false;
                }
            } else {
                return false;
            }
        }
        true
    }

    fn is_same_rect(
        &self,
        rect: &Rect,
        border_selection: &BorderSelection,
        style: &BorderStyle,
    ) -> bool {
        for y in rect.y_range() {
            for x in rect.x_range() {
                let cell = self.get(x, y);
                match border_selection {
                    BorderSelection::All => {
                        if !Self::is_same_style(cell, style, Sides::all()) {
                            return false;
                        }
                    }
                    BorderSelection::Inner => {
                        if x > rect.min.x && !Self::is_same_style(cell, style, Sides::left()) {
                            return false;
                        }
                        if y < rect.max.y && !Self::is_same_style(cell, style, Sides::bottom()) {
                            return false;
                        }
                    }
                    BorderSelection::Outer => {
                        if x == rect.min.x && !Self::is_same_style(cell, style, Sides::left()) {
                            return false;
                        }
                        if x == rect.max.x && !Self::is_same_style(cell, style, Sides::right()) {
                            return false;
                        }
                        if y == rect.min.y && !Self::is_same_style(cell, style, Sides::top()) {
                            return false;
                        }
                        if y == rect.max.y && !Self::is_same_style(cell, style, Sides::bottom()) {
                            return false;
                        }
                    }
                    BorderSelection::Horizontal => {
                        if y < rect.max.y && !Self::is_same_style(cell, style, Sides::bottom()) {
                            return false;
                        }
                    }
                    BorderSelection::Vertical => {
                        if x < rect.max.x && !Self::is_same_style(cell, style, Sides::right()) {
                            return false;
                        }
                    }
                    BorderSelection::Left => {
                        if x == rect.min.x && !Self::is_same_style(cell, style, Sides::left()) {
                            return false;
                        }
                    }
                    BorderSelection::Top => {
                        if y == rect.min.y && !Self::is_same_style(cell, style, Sides::top()) {
                            return false;
                        }
                    }
                    BorderSelection::Right => {
                        if x == rect.max.x && !Self::is_same_style(cell, style, Sides::right()) {
                            return false;
                        }
                    }
                    BorderSelection::Bottom => {
                        if y == rect.max.y && !Self::is_same_style(cell, style, Sides::bottom()) {
                            return false;
                        }
                    }
                    BorderSelection::Clear => return false,
                }
            }
        }
        true
    }

    /// Returns true if the borders for the Selection are already set to the
    /// given style.
    pub fn is_toggle_borders(
        &self,
        selection: &Selection,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
    ) -> bool {
        if let Some(style) = style {
            if selection.all {
                if !Self::is_same_sheet(border_selection, style, &self.all) {
                    return false;
                }
            }
            if let Some(columns) = selection.columns.as_ref() {
                for column in columns.iter() {
                    if let Some(column_style) = self.columns.get(column) {
                        if !Self::is_same_sheet(border_selection, style, column_style) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
            }
            if let Some(rows) = selection.rows.as_ref() {
                for row in rows.iter() {
                    if let Some(row_style) = self.rows.get(row) {
                        if !Self::is_same_sheet(border_selection, style, row_style) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
            }
            if let Some(rects) = selection.rects.as_ref() {
                for rect in rects.iter() {
                    if !self.is_same_rect(rect, &border_selection, &style) {
                        return false;
                    }
                }
            }
            true
        } else {
            // If the style is None, then it's already going to clear the borders.
            false
        }
    }
}

#[cfg(test)]
mod test {
    use serial_test::parallel;

    use crate::{color::Rgba, controller::GridController, Rect};

    use super::*;

    #[test]
    #[parallel]
    fn is_toggle_borders_all() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.borders.is_toggle_borders(
            &Selection::all(sheet_id),
            BorderSelection::All,
            None
        ));

        gc.set_borders_selection(
            Selection::all(sheet_id),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.is_toggle_borders(
            &Selection::all(sheet_id),
            BorderSelection::All,
            Some(BorderStyle::default())
        ));

        assert!(!sheet.borders.is_toggle_borders(
            &Selection::all(sheet_id),
            BorderSelection::All,
            Some(BorderStyle {
                color: Rgba::new(10, 11, 12, 13),
                ..Default::default()
            })
        ));
    }

    #[test]
    #[parallel]
    fn is_toggle_borders_columns() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.borders.is_toggle_borders(
            &Selection::columns(&[0, 1, 2], sheet_id),
            BorderSelection::All,
            None
        ));

        gc.set_borders_selection(
            Selection::columns(&[0, 1, 2], sheet_id),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.is_toggle_borders(
            &Selection::columns(&[0, 1, 2], sheet_id),
            BorderSelection::All,
            Some(BorderStyle::default())
        ));

        assert!(!sheet.borders.is_toggle_borders(
            &Selection::columns(&[0, 1, 2], sheet_id),
            BorderSelection::All,
            Some(BorderStyle {
                color: Rgba::new(10, 11, 12, 13),
                ..Default::default()
            })
        ));
    }

    #[test]
    #[parallel]
    fn is_toggle_borders_rows() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet(sheet_id);
        assert!(!sheet.borders.is_toggle_borders(
            &Selection::rows(&[0, 1, 2], sheet_id),
            BorderSelection::All,
            None
        ));

        gc.set_borders_selection(
            Selection::rows(&[0, 1, 2], sheet_id),
            BorderSelection::All,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.is_toggle_borders(
            &Selection::rows(&[0, 1, 2], sheet_id),
            BorderSelection::All,
            Some(BorderStyle::default())
        ));

        assert!(!sheet.borders.is_toggle_borders(
            &Selection::rows(&[0, 1, 2], sheet_id),
            BorderSelection::All,
            Some(BorderStyle {
                color: Rgba::new(10, 11, 12, 13),
                ..Default::default()
            })
        ));
    }

    #[test]
    #[parallel]
    fn is_toggle_borders_rects() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];

        let sheet = gc.sheet(sheet_id);
        let selection = Selection::rects(
            &[Rect::new(1, 1, 2, 2), Rect::new(10, 10, 20, 20)],
            sheet_id,
        );
        assert!(!sheet
            .borders
            .is_toggle_borders(&selection, BorderSelection::Left, None));

        gc.set_borders_selection(
            selection.clone(),
            BorderSelection::Left,
            Some(BorderStyle::default()),
            None,
        );

        let sheet = gc.sheet(sheet_id);
        assert!(sheet.borders.is_toggle_borders(
            &selection,
            BorderSelection::Left,
            Some(BorderStyle::default())
        ));

        assert!(!sheet.borders.is_toggle_borders(
            &selection,
            BorderSelection::Left,
            Some(BorderStyle {
                color: Rgba::new(10, 11, 12, 13),
                ..Default::default()
            })
        ));
    }

    #[test]
    #[parallel]
    fn test_is_same_rect() {
        let mut gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let rect = Rect::new(1, 1, 3, 3);
        let selection = Selection::sheet_rect(rect.to_sheet_rect(sheet_id));
        let style = BorderStyle::default();

        // Test BorderSelection::All
        gc.set_borders_selection(selection.clone(), BorderSelection::All, Some(style), None);
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::All, &style));

        // Test with different style
        let different_style = BorderStyle {
            color: Rgba::new(10, 11, 12, 13),
            ..Default::default()
        };
        assert!(!sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::All, &different_style));
        gc.clear_format(Selection::all(sheet_id), None).unwrap();

        // Test BorderSelection::Inner
        gc.set_borders_selection(selection.clone(), BorderSelection::Inner, Some(style), None);
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::Inner, &style));
        gc.clear_format(Selection::all(sheet_id), None).unwrap();

        // Test BorderSelection::Outer
        gc.set_borders_selection(selection.clone(), BorderSelection::Outer, Some(style), None);
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::Outer, &style));
        gc.clear_format(Selection::all(sheet_id), None).unwrap();

        // Test BorderSelection::Horizontal
        gc.set_borders_selection(
            selection.clone(),
            BorderSelection::Horizontal,
            Some(style),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::Horizontal, &style));
        gc.clear_format(Selection::all(sheet_id), None).unwrap();

        // Test BorderSelection::Vertical
        gc.set_borders_selection(
            selection.clone(),
            BorderSelection::Vertical,
            Some(style),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::Vertical, &style));
        gc.clear_format(Selection::all(sheet_id), None).unwrap();

        // Test BorderSelection::Left
        gc.set_borders_selection(selection.clone(), BorderSelection::Left, Some(style), None);
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::Left, &style));
        gc.clear_format(Selection::all(sheet_id), None).unwrap();

        // Test BorderSelection::Top
        gc.set_borders_selection(selection.clone(), BorderSelection::Top, Some(style), None);
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::Top, &style));
        gc.clear_format(Selection::all(sheet_id), None).unwrap();

        // Test BorderSelection::Right
        gc.set_borders_selection(selection.clone(), BorderSelection::Right, Some(style), None);
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::Right, &style));
        gc.clear_format(Selection::all(sheet_id), None).unwrap();

        // Test BorderSelection::Bottom
        gc.set_borders_selection(
            selection.clone(),
            BorderSelection::Bottom,
            Some(style),
            None,
        );
        let sheet = gc.sheet(sheet_id);
        assert!(sheet
            .borders
            .is_same_rect(&rect, &BorderSelection::Bottom, &style));
    }
}
