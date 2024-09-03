use crate::{
    border_style::{BorderSelection, BorderStyle, BorderStyleCellUpdate},
    controller::GridController,
    selection::Selection,
    Rect, RunLengthEncoding,
};

use super::operation::Operation;

impl GridController {
    // gets a border style for Selection.all, rows, or columns
    fn border_style_sheet(
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        borders: &mut RunLengthEncoding<BorderStyleCellUpdate>,
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
            BorderSelection::Clear => {
                border_style.top = Some(None);
                border_style.bottom = Some(None);
                border_style.left = Some(None);
                border_style.right = Some(None);
            }
        }
        borders.push(border_style);
    }

    /// Gets a border style for a rect
    fn border_style_rect(
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        rect: &Rect,
        borders: &mut RunLengthEncoding<BorderStyleCellUpdate>,
    ) {
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
                }
                BorderSelection::Vertical => {
                    if pos.x < rect.max.x {
                        border_style.right = style;
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
                BorderSelection::Clear => {
                    border_style.top = Some(None);
                    border_style.bottom = Some(None);
                    border_style.left = Some(None);
                    border_style.right = Some(None);
                }
            }
            borders.push(border_style);
        });
    }

    /// Creates border operations. Returns None if selection is empty.
    pub fn set_borders_selection_operations(
        selection: Selection,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
    ) -> Option<Vec<Operation>> {
        let mut borders = RunLengthEncoding::new();

        if selection.all {
            Self::border_style_sheet(border_selection, style, &mut borders);
        }
        if let Some(columns) = selection.columns.as_ref() {
            for _ in columns {
                Self::border_style_sheet(border_selection, style, &mut borders);
            }
        }
        if let Some(rows) = selection.rows.as_ref() {
            for _ in rows {
                Self::border_style_sheet(border_selection, style, &mut borders);
            }
        }
        if let Some(rects) = selection.rects.as_ref() {
            for rect in rects {
                Self::border_style_rect(border_selection, style, rect, &mut borders);
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

    use super::*;

    use crate::grid::SheetId;

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
    fn borders_operations_all() {
        let sheet_id = SheetId::test();
        let selection = Selection::all(sheet_id);
        let ops = GridController::set_borders_selection_operations(
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

        let ops = GridController::set_borders_selection_operations(
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

        let ops = GridController::set_borders_selection_operations(
            selection.clone(),
            BorderSelection::Clear,
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
        assert!(test_border(border, None, None, None, None));
    }

    #[test]
    #[parallel]
    fn borders_operations_columns() {
        let sheet_id = SheetId::test();
        let selection = Selection::columns(&[0, 1], sheet_id);
        let ops = GridController::set_borders_selection_operations(
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

        let ops = GridController::set_borders_selection_operations(
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
        let sheet_id = SheetId::test();
        let selection = Selection::rows(&[0, 1], sheet_id);
        let ops = GridController::set_borders_selection_operations(
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

        let ops = GridController::set_borders_selection_operations(
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
        let sheet_id = SheetId::test();
        let rect = Rect::from_numbers(0, 0, 2, 2);
        let selection = Selection::rect(rect, sheet_id);
        let expected = BorderStyle::default();

        // Test BorderSelection::All
        let ops = GridController::set_borders_selection_operations(
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
        let ops = GridController::set_borders_selection_operations(
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
        let ops = GridController::set_borders_selection_operations(
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
}
