use crate::{
    controller::GridController,
    grid::{
        sheet::borders::{
            BorderSelection, BorderSide, BorderStyle, BorderStyleCellUpdate,
            BorderStyleCellUpdates, BorderStyleTimestamp,
        },
        CellBorderLine, Sheet, SheetId,
    },
    selection::OldSelection,
    Rect,
};

use super::operation::Operation;
impl GridController {
    // gets a border style for Selection.all, rows, or columns
    fn border_style_sheet(
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        borders: &mut BorderStyleCellUpdates,
    ) {
        let style = style.map_or(Some(None), |s| Some(Some(s.into())));
        let mut border_style = BorderStyleCellUpdate::default();
        match border_selection {
            // Inner and Outer are not as interesting for sheet-wide borders
            BorderSelection::All | BorderSelection::Inner | BorderSelection::Outer => {
                border_style.top = style;
                border_style.bottom = style;
                border_style.left = style;
                border_style.right = style;
            }
            BorderSelection::Horizontal => {
                border_style.top = style;
                border_style.bottom = style;
            }
            BorderSelection::Vertical => {
                border_style.left = style;
                border_style.right = style;
            }
            BorderSelection::Left => {
                border_style.left = style;
            }
            BorderSelection::Top => {
                border_style.top = style;
            }
            BorderSelection::Right => {
                border_style.right = style;
            }
            BorderSelection::Bottom => {
                border_style.bottom = style;
            }

            // For simplicity, we always set the border to clear and let the
            // timestamp comparison handle conflicts. We use the more
            // complicated logic for rects so we don't end up with too many
            // BorderLineStyle::Clear scattered throughout the sheet (see
            // check_sheet--the logic here would be even more complicated).
            BorderSelection::Clear => {
                border_style.top = Some(Some(BorderStyleTimestamp::clear()));
                border_style.bottom = Some(Some(BorderStyleTimestamp::clear()));
                border_style.left = Some(Some(BorderStyleTimestamp::clear()));
                border_style.right = Some(Some(BorderStyleTimestamp::clear()));
            }
        }
        borders.push(border_style);
    }

    /// We need to determine how to clear the border based on the sheet's border
    /// settings, and any neighboring borders. We either clear the border, or we
    /// set it to BorderLineStyle::Clear.
    fn check_sheet(
        sheet: &Sheet,
        x: i64,
        y: i64,
        side: BorderSide,
    ) -> Option<Option<BorderStyleTimestamp>> {
        match side {
            BorderSide::Top => {
                if sheet.borders.all.top.is_some()
                    || sheet.borders.all.bottom.is_some()
                    || sheet
                        .borders
                        .columns
                        .get(&x)
                        .is_some_and(|c| c.top.is_some() || c.bottom.is_some())
                    || sheet.borders.rows.get(&y).is_some_and(|r| r.top.is_some())
                    || sheet
                        .borders
                        .rows
                        .get(&(y - 1))
                        .is_some_and(|r| r.bottom.is_some())
                    || sheet.borders.get(x, y - 1).bottom.is_some()
                {
                    Some(Some(BorderStyleTimestamp::clear()))
                } else {
                    Some(None)
                }
            }
            BorderSide::Bottom => {
                if sheet.borders.all.bottom.is_some()
                    || sheet.borders.all.top.is_some()
                    || sheet
                        .borders
                        .columns
                        .get(&x)
                        .is_some_and(|c| c.bottom.is_some() || c.top.is_some())
                    || sheet
                        .borders
                        .rows
                        .get(&y)
                        .is_some_and(|r| r.bottom.is_some())
                    || sheet
                        .borders
                        .rows
                        .get(&(y + 1))
                        .is_some_and(|r| r.top.is_some())
                    || sheet.borders.get(x, y + 1).top.is_some()
                {
                    Some(Some(BorderStyleTimestamp::clear()))
                } else {
                    Some(None)
                }
            }
            BorderSide::Left => {
                if sheet.borders.all.left.is_some()
                    || sheet.borders.all.right.is_some()
                    || sheet
                        .borders
                        .rows
                        .get(&y)
                        .is_some_and(|r| r.left.is_some() || r.right.is_some())
                    || sheet
                        .borders
                        .columns
                        .get(&x)
                        .is_some_and(|c| c.left.is_some())
                    || sheet
                        .borders
                        .columns
                        .get(&(x - 1))
                        .is_some_and(|c| c.right.is_some())
                    || sheet.borders.get(x - 1, y).right.is_some()
                {
                    Some(Some(BorderStyleTimestamp::clear()))
                } else {
                    Some(None)
                }
            }
            BorderSide::Right => {
                if sheet.borders.all.right.is_some()
                    || sheet.borders.all.left.is_some()
                    || sheet
                        .borders
                        .rows
                        .get(&y)
                        .is_some_and(|r| r.right.is_some() || r.left.is_some())
                    || sheet
                        .borders
                        .columns
                        .get(&x)
                        .is_some_and(|c| c.right.is_some())
                    || sheet
                        .borders
                        .columns
                        .get(&(x + 1))
                        .is_some_and(|c| c.left.is_some())
                    || sheet.borders.get(x + 1, y).left.is_some()
                {
                    Some(Some(BorderStyleTimestamp::clear()))
                } else {
                    Some(None)
                }
            }
        }
    }

    /// Gets a border style for a rect
    fn border_style_rect(
        &self,
        sheet_id: SheetId,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        rect: &Rect,
        borders: &mut BorderStyleCellUpdates,
    ) {
        let Some(sheet) = self.try_sheet(sheet_id) else {
            return;
        };

        let style = style.map_or(Some(None), |s| Some(Some(s.into())));
        rect.iter().for_each(|pos| {
            let mut border_style = BorderStyleCellUpdate::default();
            match border_selection {
                BorderSelection::All => {
                    border_style.top = style;
                    border_style.bottom = style;
                    border_style.left = style;
                    border_style.right = style;
                }
                BorderSelection::Inner => {
                    if pos.x > rect.min.x {
                        border_style.left = style;
                    }
                    if pos.x < rect.max.x {
                        border_style.right = style;
                    }
                    if pos.y > rect.min.y {
                        border_style.top = style;
                    }
                    if pos.y < rect.max.y {
                        border_style.bottom = style;
                    }
                }
                BorderSelection::Outer => {
                    if pos.x == rect.min.x {
                        border_style.left = style;
                    }
                    if pos.x == rect.max.x {
                        border_style.right = style;
                    }
                    if pos.y == rect.min.y {
                        border_style.top = style;
                    }
                    if pos.y == rect.max.y {
                        border_style.bottom = style;
                    }
                }
                BorderSelection::Horizontal => {
                    if pos.y < rect.max.y {
                        border_style.bottom = style;
                    }
                    if pos.y > rect.min.y {
                        border_style.top = style;
                    }
                }
                BorderSelection::Vertical => {
                    if pos.x < rect.max.x {
                        border_style.right = style;
                    }
                    if pos.x > rect.min.x {
                        border_style.left = style;
                    }
                }
                BorderSelection::Left => {
                    if pos.x == rect.min.x {
                        border_style.left = style;
                    }
                }
                BorderSelection::Top => {
                    if pos.y == rect.min.y {
                        border_style.top = style;
                    }
                }
                BorderSelection::Right => {
                    if pos.x == rect.max.x {
                        border_style.right = style;
                    }
                }
                BorderSelection::Bottom => {
                    if pos.y == rect.max.y {
                        border_style.bottom = style;
                    }
                }

                // For clear, we need to do a bit more work to check whether we
                // can clear the border or if we have to use
                // BorderCellLine::Clear (which will override neighboring borders).
                BorderSelection::Clear => {
                    border_style.top = Self::check_sheet(sheet, pos.x, pos.y, BorderSide::Top);
                    border_style.bottom =
                        Self::check_sheet(sheet, pos.x, pos.y, BorderSide::Bottom);
                    border_style.left = Self::check_sheet(sheet, pos.x, pos.y, BorderSide::Left);
                    border_style.right = Self::check_sheet(sheet, pos.x, pos.y, BorderSide::Right);
                }
            }
            borders.push(border_style);
        });
    }

    /// Creates border operations. Returns None if selection is empty.
    pub fn set_borders_selection_operations(
        &self,
        selection: OldSelection,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
    ) -> Option<Vec<Operation>> {
        // Check if the borders are already set to the same style. If they are,
        // toggle them off.
        let sheet = self.try_sheet(selection.sheet_id)?;
        let (style_sheet, style_rect) =
            if sheet
                .borders
                .is_toggle_borders(&selection, border_selection, style)
            {
                (
                    None,
                    Some(BorderStyle {
                        line: CellBorderLine::Clear,
                        ..Default::default()
                    }),
                )
            } else {
                (style, style)
            };

        let mut borders = BorderStyleCellUpdates::default();

        if selection.all {
            Self::border_style_sheet(border_selection, style_sheet, &mut borders);
        }
        if let Some(columns) = selection.columns.as_ref() {
            for _ in columns {
                Self::border_style_sheet(border_selection, style_sheet, &mut borders);
            }
        }
        if let Some(rows) = selection.rows.as_ref() {
            for _ in rows {
                Self::border_style_sheet(border_selection, style_sheet, &mut borders);
            }
        }
        if let Some(rects) = selection.rects.as_ref() {
            for rect in rects {
                self.border_style_rect(
                    selection.sheet_id,
                    border_selection,
                    style_rect,
                    rect,
                    &mut borders,
                );
            }
        }
        if !borders.is_empty() {
            Some(vec![Operation::SetBordersSelection { selection, borders }])
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use crate::grid::sheet::borders::BorderStyleCell;

    use super::*;

    fn test_border(
        update: &BorderStyleCellUpdate,
        top: Option<BorderStyle>,
        bottom: Option<BorderStyle>,
        left: Option<BorderStyle>,
        right: Option<BorderStyle>,
    ) -> bool {
        let top_match = match (update.top, top) {
            (Some(Some(u)), Some(t)) => u.color == t.color && u.line == t.line,
            (Some(None), None) => true,
            (None, _) => true,
            _ => false,
        };

        let bottom_match = match (update.bottom, bottom) {
            (Some(Some(u)), Some(b)) => u.color == b.color && u.line == b.line,
            (Some(None), None) => true,
            (None, _) => true,
            _ => false,
        };

        let left_match = match (update.left, left) {
            (Some(Some(u)), Some(l)) => u.color == l.color && u.line == l.line,
            (Some(None), None) => true,
            (None, _) => true,
            _ => false,
        };

        let right_match = match (update.right, right) {
            (Some(Some(u)), Some(r)) => u.color == r.color && u.line == r.line,
            (Some(None), None) => true,
            (None, _) => true,
            _ => false,
        };

        top_match && bottom_match && left_match && right_match
    }

    #[test]
    #[parallel]
    fn test_borders_operations_all() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = OldSelection::all(sheet_id);
        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::All,
                Some(BorderStyle::default()),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 1);
        let expected = BorderStyle::default();
        let border = borders.get_at(0).unwrap();
        assert!(test_border(
            border,
            Some(expected),
            Some(expected),
            Some(expected),
            Some(expected)
        ));

        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::Left,
                Some(BorderStyle::default()),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 1);
        let border = borders.get_at(0).unwrap();
        assert!(test_border(border, None, None, Some(expected), None));
    }

    #[test]
    #[parallel]
    fn borders_operations_columns() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = OldSelection::columns(&[0, 1], sheet_id);
        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::All,
                Some(BorderStyle::default()),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 2);
        let column_1 = borders.get_at(0).unwrap();
        let expected = BorderStyle::default();
        assert!(test_border(
            column_1,
            Some(expected),
            Some(expected),
            Some(expected),
            Some(expected)
        ));
        let column_2 = borders.get_at(1).unwrap();
        assert!(test_border(
            column_2,
            Some(expected),
            Some(expected),
            Some(expected),
            Some(expected)
        ));

        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::Vertical,
                Some(BorderStyle::default()),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 2);
        let column_1 = borders.get_at(0).unwrap();
        let column_2 = borders.get_at(1).unwrap();
        assert!(test_border(
            column_1,
            None,
            None,
            Some(expected),
            Some(expected)
        ));
        assert!(test_border(
            column_2,
            None,
            None,
            Some(expected),
            Some(expected)
        ));
    }

    #[test]
    #[parallel]
    fn borders_operations_rows() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let selection = OldSelection::rows(&[0, 1], sheet_id);
        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::All,
                Some(BorderStyle::default()),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 2);
        let row_1 = borders.get_at(0).unwrap();
        let row_2 = borders.get_at(1).unwrap();
        let expected = BorderStyle::default();
        assert!(test_border(
            row_1,
            Some(expected),
            Some(expected),
            Some(expected),
            Some(expected)
        ));
        assert!(test_border(
            row_2,
            Some(expected),
            Some(expected),
            Some(expected),
            Some(expected)
        ));

        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::Horizontal,
                Some(BorderStyle::default()),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 2);
        let row_1 = borders.get_at(0).unwrap();
        let row_2 = borders.get_at(1).unwrap();
        assert!(test_border(
            row_1,
            Some(expected),
            Some(expected),
            None,
            None
        ));
        assert!(test_border(
            row_2,
            Some(expected),
            Some(expected),
            None,
            None
        ));
    }

    #[test]
    #[parallel]
    fn borders_operations_rects() {
        let gc = GridController::test();
        let sheet_id = gc.sheet_ids()[0];
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let selection = OldSelection::rect(rect, sheet_id);
        let expected = BorderStyle::default();

        // Test BorderSelection::All
        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::All,
                Some(expected),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 4);
        for i in 0..4 {
            let border = borders.get_at(i).unwrap();
            assert!(test_border(
                border,
                Some(expected),
                Some(expected),
                Some(expected),
                Some(expected)
            ));
        }

        // Test BorderSelection::Outer
        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::Outer,
                Some(expected),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 4);
        let top_left = borders.get_at(0).unwrap();
        let top_right = borders.get_at(1).unwrap();
        let bottom_left = borders.get_at(2).unwrap();
        let bottom_right = borders.get_at(3).unwrap();
        assert!(test_border(
            top_left,
            Some(expected),
            None,
            Some(expected),
            None
        ));
        assert!(test_border(
            top_right,
            Some(expected),
            None,
            None,
            Some(expected)
        ));
        assert!(test_border(
            bottom_left,
            None,
            Some(expected),
            Some(expected),
            None
        ));
        assert!(test_border(
            bottom_right,
            None,
            Some(expected),
            None,
            Some(expected)
        ));

        // Test BorderSelection::Inner
        let ops = gc
            .set_borders_selection_operations(
                selection.clone(),
                BorderSelection::Inner,
                Some(expected),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersSelection {
            selection: selection_op,
            borders,
        } = ops[0].clone()
        else {
            panic!("Expected SetBordersSelection")
        };
        assert_eq!(selection_op, selection);
        assert_eq!(borders.size(), 4);
        let top_left = borders.get_at(0).unwrap();
        let top_right = borders.get_at(1).unwrap();
        let bottom_left = borders.get_at(2).unwrap();
        let bottom_right = borders.get_at(3).unwrap();
        assert!(test_border(
            top_left,
            None,
            Some(expected),
            None,
            Some(expected)
        ));
        assert!(test_border(
            top_right,
            None,
            Some(expected),
            Some(expected),
            None
        ));
        assert!(test_border(
            bottom_left,
            Some(expected),
            None,
            None,
            Some(expected)
        ));
        assert!(test_border(
            bottom_right,
            Some(expected),
            None,
            Some(expected),
            None
        ));
    }

    #[test]
    #[parallel]
    fn check_sheet() {
        let mut sheet = Sheet::test();

        // Test for Top border
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Top),
            Some(None)
        );
        sheet.borders.all.top = Some(BorderStyleTimestamp::default());
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Top),
            Some(Some(BorderStyleTimestamp::clear()))
        );

        // Test for Bottom border
        let mut sheet = Sheet::test();
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Bottom),
            Some(None)
        );
        sheet.borders.all.bottom = Some(BorderStyleTimestamp::default());
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Bottom),
            Some(Some(BorderStyleTimestamp::clear()))
        );

        // Test for Left border
        let mut sheet = Sheet::test();
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Left),
            Some(None)
        );
        sheet.borders.all.left = Some(BorderStyleTimestamp::default());
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Left),
            Some(Some(BorderStyleTimestamp::clear()))
        );

        // Test for Right border
        let mut sheet = Sheet::test();
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Right),
            Some(None)
        );
        sheet.borders.all.right = Some(BorderStyleTimestamp::default());
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Right),
            Some(Some(BorderStyleTimestamp::clear()))
        );

        // Test for column-specific borders
        let mut sheet = Sheet::test();
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Top),
            Some(None)
        );
        sheet.borders.columns.insert(0, BorderStyleCell::all());
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Top),
            Some(Some(BorderStyleTimestamp::clear()))
        );

        // Test for row-specific borders
        let mut sheet = Sheet::test();
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Bottom),
            Some(None)
        );
        sheet.borders.rows.insert(0, BorderStyleCell::all());
        assert_eq!(
            GridController::check_sheet(&sheet, 0, 0, BorderSide::Top),
            Some(Some(BorderStyleTimestamp::clear()))
        );
    }
}
