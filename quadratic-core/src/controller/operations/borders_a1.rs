use crate::{
    controller::GridController,
    grid::sheet::borders_a1::{BorderSelection, BorderStyle, BordersA1Updates},
    A1Selection, CellRefRange, RefRangeBounds,
};

use super::operation::Operation;

impl GridController {
    // gets a border style for Selection.all, rows, or columns
    // fn a1_border_style_sheet(
    //     border_selection: BorderSelection,
    //     style: Option<BorderStyle>,
    //     borders: &mut BorderStyleCellUpdates,
    // ) {
    //     let style = style.map_or(Some(None), |s| Some(Some(s.into())));
    //     let mut border_style = BorderStyleCellUpdate::default();
    //     match border_selection {
    //         // Inner and Outer are not as interesting for sheet-wide borders
    //         BorderSelection::All | BorderSelection::Inner | BorderSelection::Outer => {
    //             border_style.top = style;
    //             border_style.bottom = style;
    //             border_style.left = style;
    //             border_style.right = style;
    //         }
    //         BorderSelection::Horizontal => {
    //             border_style.top = style;
    //             border_style.bottom = style;
    //         }
    //         BorderSelection::Vertical => {
    //             border_style.left = style;
    //             border_style.right = style;
    //         }
    //         BorderSelection::Left => {
    //             border_style.left = style;
    //         }
    //         BorderSelection::Top => {
    //             border_style.top = style;
    //         }
    //         BorderSelection::Right => {
    //             border_style.right = style;
    //         }
    //         BorderSelection::Bottom => {
    //             border_style.bottom = style;
    //         }

    //         // For simplicity, we always set the border to clear and let the
    //         // timestamp comparison handle conflicts. We use the more
    //         // complicated logic for rects so we don't end up with too many
    //         // BorderLineStyle::Clear scattered throughout the sheet (see
    //         // a1_check_sheet--the logic here would be even more complicated).
    //         BorderSelection::Clear => {
    //             border_style.top = Some(Some(BorderStyleTimestamp::clear()));
    //             border_style.bottom = Some(Some(BorderStyleTimestamp::clear()));
    //             border_style.left = Some(Some(BorderStyleTimestamp::clear()));
    //             border_style.right = Some(Some(BorderStyleTimestamp::clear()));
    //         }
    //     }
    //     borders.push(border_style);
    // }

    /// We need to determine how to clear the border based on the sheet's border
    /// settings, and any neighboring borders. We either clear the border, or we
    /// set it to BorderLineStyle::Clear.
    // fn a1_check_sheet(
    //     sheet: &Sheet,
    //     x: i64,
    //     y: i64,
    //     side: BorderSide,
    // ) -> Option<Option<BorderStyleTimestamp>> {
    //     match side {
    //         BorderSide::Top => {
    //             if sheet.borders.all.top.is_some()
    //                 || sheet.borders.all.bottom.is_some()
    //                 || sheet
    //                     .borders
    //                     .columns
    //                     .get(&x)
    //                     .is_some_and(|c| c.top.is_some() || c.bottom.is_some())
    //                 || sheet.borders.rows.get(&y).is_some_and(|r| r.top.is_some())
    //                 || sheet
    //                     .borders
    //                     .rows
    //                     .get(&(y - 1))
    //                     .is_some_and(|r| r.bottom.is_some())
    //                 || sheet.borders.get(x, y - 1).bottom.is_some()
    //             {
    //                 Some(Some(BorderStyleTimestamp::clear()))
    //             } else {
    //                 Some(None)
    //             }
    //         }
    //         BorderSide::Bottom => {
    //             if sheet.borders.all.bottom.is_some()
    //                 || sheet.borders.all.top.is_some()
    //                 || sheet
    //                     .borders
    //                     .columns
    //                     .get(&x)
    //                     .is_some_and(|c| c.bottom.is_some() || c.top.is_some())
    //                 || sheet
    //                     .borders
    //                     .rows
    //                     .get(&y)
    //                     .is_some_and(|r| r.bottom.is_some())
    //                 || sheet
    //                     .borders
    //                     .rows
    //                     .get(&(y + 1))
    //                     .is_some_and(|r| r.top.is_some())
    //                 || sheet.borders.get(x, y + 1).top.is_some()
    //             {
    //                 Some(Some(BorderStyleTimestamp::clear()))
    //             } else {
    //                 Some(None)
    //             }
    //         }
    //         BorderSide::Left => {
    //             if sheet.borders.all.left.is_some()
    //                 || sheet.borders.all.right.is_some()
    //                 || sheet
    //                     .borders
    //                     .rows
    //                     .get(&y)
    //                     .is_some_and(|r| r.left.is_some() || r.right.is_some())
    //                 || sheet
    //                     .borders
    //                     .columns
    //                     .get(&x)
    //                     .is_some_and(|c| c.left.is_some())
    //                 || sheet
    //                     .borders
    //                     .columns
    //                     .get(&(x - 1))
    //                     .is_some_and(|c| c.right.is_some())
    //                 || sheet.borders.get(x - 1, y).right.is_some()
    //             {
    //                 Some(Some(BorderStyleTimestamp::clear()))
    //             } else {
    //                 Some(None)
    //             }
    //         }
    //         BorderSide::Right => {
    //             if sheet.borders.all.right.is_some()
    //                 || sheet.borders.all.left.is_some()
    //                 || sheet
    //                     .borders
    //                     .rows
    //                     .get(&y)
    //                     .is_some_and(|r| r.right.is_some() || r.left.is_some())
    //                 || sheet
    //                     .borders
    //                     .columns
    //                     .get(&x)
    //                     .is_some_and(|c| c.right.is_some())
    //                 || sheet
    //                     .borders
    //                     .columns
    //                     .get(&(x + 1))
    //                     .is_some_and(|c| c.left.is_some())
    //                 || sheet.borders.get(x + 1, y).left.is_some()
    //             {
    //                 Some(Some(BorderStyleTimestamp::clear()))
    //             } else {
    //                 Some(None)
    //             }
    //         }
    //     }
    // }

    /// Gets a border style for a rect
    fn a1_border_style_range(
        &self,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        range: &RefRangeBounds,
        borders: &mut BordersA1Updates,
    ) {
        let style = style.map_or(Some(None), |s| Some(Some(s.into())));
        let (x1, y1, x2, y2) = range.to_contiguous2d_coords();
        match border_selection {
            BorderSelection::All => {
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, style);
                borders
                    .bottom
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, style);
                borders
                    .left
                    .get_or_insert_with(Default::default)
                    .set_rect(x1, y1, x2, y2, style);
                borders
                    .right
                    .get_or_insert_with(Default::default)
                    .set_rect(x1, y1, x2, y2, style);
            }
            BorderSelection::Inner => {
                // if pos.x > rect.min.x {
                //     border_style.left = style;
                // }
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1 + 1, y1, x2, y2, style);
                // if pos.x < rect.max.x {
                //     border_style.right = style;
                // }
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x1, y1, Some(x2 - 1), y2, style);
                }
                // if pos.y > rect.min.y {
                //     border_style.top = style;
                // }
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1 + 1, x2, y2, style);
                // if pos.y < rect.max.y {
                //     border_style.bottom = style;
                // }
                if let Some(y2) = y2 {
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y1,
                        x2,
                        Some(y2 - 1),
                        style,
                    );
                }
            }
            BorderSelection::Outer => {
                // if pos.x == rect.min.x {
                //     border_style.left = style;
                // }
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1, y1, Some(x1), y2, style);
                // if pos.x == rect.max.x {
                //     border_style.right = style;
                // }
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x2, y1, Some(x2), y2, style);
                }
                // if pos.y == rect.min.y {
                //     border_style.top = style;
                // }
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, Some(y1), style);
                // if pos.y == rect.max.y {
                //     border_style.bottom = style;
                // }
                if let Some(y2) = y2 {
                    borders
                        .bottom
                        .get_or_insert_default()
                        .set_rect(x1, y2, x2, Some(y2), style);
                }
            }
            BorderSelection::Horizontal => {
                // if pos.y < rect.max.y {
                //     border_style.bottom = style;
                // }
                if let Some(y2) = y2 {
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y2,
                        x2,
                        Some(y2 - 1),
                        style,
                    );
                }
                // if pos.y > rect.min.y {
                //     border_style.top = style;
                // }
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1 + 1, x2, y2, style);
            }
            BorderSelection::Vertical => {
                // if pos.x < rect.max.x {
                //     border_style.right = style;
                // }
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x2, y1, Some(x2 - 1), y2, style);
                }
                // if pos.x > rect.min.x {
                //     border_style.left = style;
                // }
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1 + 1, y1, x2, y2, style);
            }
            BorderSelection::Left => {
                // if pos.x == rect.min.x {
                //     border_style.left = style;
                // }
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1, y1, Some(x1), y2, style);
            }
            BorderSelection::Top => {
                // if pos.y == rect.min.y {
                //     border_style.top = style;
                // }
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, Some(y1), style);
            }
            BorderSelection::Right => {
                // if pos.x == rect.max.x {
                //     border_style.right = style;
                // }
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x2, y1, Some(x2), y2, style);
                }
            }
            BorderSelection::Bottom => {
                // if pos.y == rect.max.y {
                //     border_style.bottom = style;
                // }
                if let Some(y2) = y2 {
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y2,
                        x2,
                        Some(y2 - 1),
                        style,
                    );
                }
            }
            BorderSelection::Clear => {
                // border_style.top = Self::a1_check_sheet(sheet, pos.x, pos.y, BorderSide::Top);
                // border_style.bottom = Self::a1_check_sheet(sheet, pos.x, pos.y, BorderSide::Bottom);
                // border_style.left = Self::a1_check_sheet(sheet, pos.x, pos.y, BorderSide::Left);
                // border_style.right = Self::a1_check_sheet(sheet, pos.x, pos.y, BorderSide::Right);
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, None);
                borders
                    .bottom
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, None);
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, None);
                borders
                    .right
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, y2, None);
            }
        }
    }

    /// Creates border operations. Returns None if selection is empty.
    pub fn set_borders_a1_selection_operations(
        &self,
        selection: A1Selection,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
    ) -> Option<Vec<Operation>> {
        // Check if the borders are already set to the same style. If they are,
        // toggle them off.
        // let sheet = self.try_sheet(selection.sheet_id)?;
        // let (style_sheet, style_rect) =
        // todo...
        // if sheet
        //     .borders
        //     .is_toggle_borders(&selection, border_selection, style)
        // {
        //     (
        //         None,
        //         Some(BorderStyle {
        //             line: CellBorderLine::Clear,
        //             ..Default::default()
        //         }),
        //     )
        // } else {
        // (style, style);
        // };

        let mut borders: BordersA1Updates = BordersA1Updates::default();

        selection.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                self.a1_border_style_range(border_selection, style, range, &mut borders);
            }
        });

        // if selection.all {
        //     Self::a1_border_style_sheet(border_selection, style_sheet, &mut borders);
        // }
        // if let Some(columns) = selection.columns.as_ref() {
        //     for _ in columns {
        //         Self::a1_border_style_sheet(border_selection, style_sheet, &mut borders);
        //     }
        // }
        // if let Some(rows) = selection.rows.as_ref() {
        //     for _ in rows {
        //         Self::a1_border_style_sheet(border_selection, style_sheet, &mut borders);
        //     }
        // }
        // if let Some(rects) = selection.rects.as_ref() {
        //     for rect in rects {
        //         self.a1_border_style_rect(
        //             selection.sheet_id,
        //             border_selection,
        //             style_rect,
        //             rect,
        //             &mut borders,
        //         );
        //     }
        // }
        if !borders.is_default() {
            Some(vec![Operation::SetBordersA1 {
                sheet_id: selection.sheet_id,
                borders,
            }])
        } else {
            None
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {

    use crate::grid::SheetId;

    use super::*;

    #[test]
    fn test_borders_operations_all_all() {
        let gc = GridController::test();
        let ops = gc
            .set_borders_a1_selection_operations(
                A1Selection::test_a1("*"),
                BorderSelection::All,
                Some(BorderStyle::default()),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersA1 { sheet_id, borders } = ops[0].clone() else {
            panic!("Expected SetBordersA1")
        };
        assert_eq!(sheet_id, SheetId::TEST);
        let left = borders.left.as_ref().unwrap();
        assert!(left.get(pos![A1]).is_some());
        assert!(left.get(pos![ZZZZ10000]).is_some());
        let right = borders.right.as_ref().unwrap();
        assert!(right.get(pos![A1]).is_some());
        assert!(right.get(pos![ZZZZ10000]).is_some());
        let top = borders.top.as_ref().unwrap();
        assert!(top.get(pos![A1]).is_some());
        assert!(top.get(pos![ZZZZ10000]).is_some());
        let bottom = borders.bottom.as_ref().unwrap();
        assert!(bottom.get(pos![A1]).is_some());
        assert!(bottom.get(pos![ZZZZ10000]).is_some());
    }

    #[test]
    fn test_borders_operations_all_left() {
        let gc = GridController::test();
        let ops = gc
            .set_borders_a1_selection_operations(
                A1Selection::test_a1("*"),
                BorderSelection::Left,
                Some(BorderStyle::default()),
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersA1 { sheet_id, borders } = ops[0].clone() else {
            panic!("Expected SetBordersA1")
        };
        assert_eq!(sheet_id, SheetId::TEST);
        let left = borders.left.as_ref().unwrap();
        assert!(left.get(pos![A1]).is_some());
        assert!(left.get(pos![A100000]).is_some());
        assert!(left.get(pos![ZZZZ10000]).is_none());
    }

    //     #[test]
    //     #[parallel]
    //     fn borders_operations_columns() {
    //         let gc = GridController::test();
    //         let sheet_id = gc.sheet_ids()[0];
    //         let selection = OldSelection::columns(&[0, 1], sheet_id);
    //         let ops = gc
    //             .set_borders_a1_selection_operations(
    //                 selection.clone(),
    //                 BorderSelection::All,
    //                 Some(BorderStyle::default()),
    //             )
    //             .unwrap();
    //         assert_eq!(ops.len(), 1);
    //         let Operation::SetBordersSelection {
    //             selection: selection_op,
    //             borders,
    //         } = ops[0].clone()
    //         else {
    //             panic!("Expected SetBordersSelection")
    //         };
    //         assert_eq!(selection_op, selection);
    //         assert_eq!(borders.size(), 2);
    //         let column_1 = borders.get_at(0).unwrap();
    //         let expected = BorderStyle::default();
    //         assert!(test_border(
    //             column_1,
    //             Some(expected),
    //             Some(expected),
    //             Some(expected),
    //             Some(expected)
    //         ));
    //         let column_2 = borders.get_at(1).unwrap();
    //         assert!(test_border(
    //             column_2,
    //             Some(expected),
    //             Some(expected),
    //             Some(expected),
    //             Some(expected)
    //         ));

    //         let ops = gc
    //             .set_borders_a1_selection_operations(
    //                 selection.clone(),
    //                 BorderSelection::Vertical,
    //                 Some(BorderStyle::default()),
    //             )
    //             .unwrap();
    //         assert_eq!(ops.len(), 1);
    //         let Operation::SetBordersSelection {
    //             selection: selection_op,
    //             borders,
    //         } = ops[0].clone()
    //         else {
    //             panic!("Expected SetBordersSelection")
    //         };
    //         assert_eq!(selection_op, selection);
    //         assert_eq!(borders.size(), 2);
    //         let column_1 = borders.get_at(0).unwrap();
    //         let column_2 = borders.get_at(1).unwrap();
    //         assert!(test_border(
    //             column_1,
    //             None,
    //             None,
    //             Some(expected),
    //             Some(expected)
    //         ));
    //         assert!(test_border(
    //             column_2,
    //             None,
    //             None,
    //             Some(expected),
    //             Some(expected)
    //         ));
    //     }

    //     #[test]
    //     #[parallel]
    //     fn borders_operations_rows() {
    //         let gc = GridController::test();
    //         let sheet_id = gc.sheet_ids()[0];
    //         let selection = OldSelection::rows(&[0, 1], sheet_id);
    //         let ops = gc
    //             .set_borders_a1_selection_operations(
    //                 selection.clone(),
    //                 BorderSelection::All,
    //                 Some(BorderStyle::default()),
    //             )
    //             .unwrap();
    //         assert_eq!(ops.len(), 1);
    //         let Operation::SetBordersSelection {
    //             selection: selection_op,
    //             borders,
    //         } = ops[0].clone()
    //         else {
    //             panic!("Expected SetBordersSelection")
    //         };
    //         assert_eq!(selection_op, selection);
    //         assert_eq!(borders.size(), 2);
    //         let row_1 = borders.get_at(0).unwrap();
    //         let row_2 = borders.get_at(1).unwrap();
    //         let expected = BorderStyle::default();
    //         assert!(test_border(
    //             row_1,
    //             Some(expected),
    //             Some(expected),
    //             Some(expected),
    //             Some(expected)
    //         ));
    //         assert!(test_border(
    //             row_2,
    //             Some(expected),
    //             Some(expected),
    //             Some(expected),
    //             Some(expected)
    //         ));

    //         let ops = gc
    //             .set_borders_a1_selection_operations(
    //                 selection.clone(),
    //                 BorderSelection::Horizontal,
    //                 Some(BorderStyle::default()),
    //             )
    //             .unwrap();
    //         assert_eq!(ops.len(), 1);
    //         let Operation::SetBordersSelection {
    //             selection: selection_op,
    //             borders,
    //         } = ops[0].clone()
    //         else {
    //             panic!("Expected SetBordersSelection")
    //         };
    //         assert_eq!(selection_op, selection);
    //         assert_eq!(borders.size(), 2);
    //         let row_1 = borders.get_at(0).unwrap();
    //         let row_2 = borders.get_at(1).unwrap();
    //         assert!(test_border(
    //             row_1,
    //             Some(expected),
    //             Some(expected),
    //             None,
    //             None
    //         ));
    //         assert!(test_border(
    //             row_2,
    //             Some(expected),
    //             Some(expected),
    //             None,
    //             None
    //         ));
    //     }

    //     #[test]
    //     #[parallel]
    //     fn borders_operations_rects() {
    //         let gc = GridController::test();
    //         let sheet_id = gc.sheet_ids()[0];
    //         let rect = Rect::from_numbers(0, 0, 2, 2);
    //         let selection = OldSelection::rect(rect, sheet_id);
    //         let expected = BorderStyle::default();

    //         // Test BorderSelection::All
    //         let ops = gc
    //             .set_borders_a1_selection_operations(
    //                 selection.clone(),
    //                 BorderSelection::All,
    //                 Some(expected),
    //             )
    //             .unwrap();
    //         assert_eq!(ops.len(), 1);
    //         let Operation::SetBordersSelection {
    //             selection: selection_op,
    //             borders,
    //         } = ops[0].clone()
    //         else {
    //             panic!("Expected SetBordersSelection")
    //         };
    //         assert_eq!(selection_op, selection);
    //         assert_eq!(borders.size(), 4);
    //         for i in 0..4 {
    //             let border = borders.get_at(i).unwrap();
    //             assert!(test_border(
    //                 border,
    //                 Some(expected),
    //                 Some(expected),
    //                 Some(expected),
    //                 Some(expected)
    //             ));
    //         }

    //         // Test BorderSelection::Outer
    //         let ops = gc
    //             .set_borders_a1_selection_operations(
    //                 selection.clone(),
    //                 BorderSelection::Outer,
    //                 Some(expected),
    //             )
    //             .unwrap();
    //         assert_eq!(ops.len(), 1);
    //         let Operation::SetBordersSelection {
    //             selection: selection_op,
    //             borders,
    //         } = ops[0].clone()
    //         else {
    //             panic!("Expected SetBordersSelection")
    //         };
    //         assert_eq!(selection_op, selection);
    //         assert_eq!(borders.size(), 4);
    //         let top_left = borders.get_at(0).unwrap();
    //         let top_right = borders.get_at(1).unwrap();
    //         let bottom_left = borders.get_at(2).unwrap();
    //         let bottom_right = borders.get_at(3).unwrap();
    //         assert!(test_border(
    //             top_left,
    //             Some(expected),
    //             None,
    //             Some(expected),
    //             None
    //         ));
    //         assert!(test_border(
    //             top_right,
    //             Some(expected),
    //             None,
    //             None,
    //             Some(expected)
    //         ));
    //         assert!(test_border(
    //             bottom_left,
    //             None,
    //             Some(expected),
    //             Some(expected),
    //             None
    //         ));
    //         assert!(test_border(
    //             bottom_right,
    //             None,
    //             Some(expected),
    //             None,
    //             Some(expected)
    //         ));

    //         // Test BorderSelection::Inner
    //         let ops = gc
    //             .set_borders_a1_selection_operations(
    //                 selection.clone(),
    //                 BorderSelection::Inner,
    //                 Some(expected),
    //             )
    //             .unwrap();
    //         assert_eq!(ops.len(), 1);
    //         let Operation::SetBordersSelection {
    //             selection: selection_op,
    //             borders,
    //         } = ops[0].clone()
    //         else {
    //             panic!("Expected SetBordersSelection")
    //         };
    //         assert_eq!(selection_op, selection);
    //         assert_eq!(borders.size(), 4);
    //         let top_left = borders.get_at(0).unwrap();
    //         let top_right = borders.get_at(1).unwrap();
    //         let bottom_left = borders.get_at(2).unwrap();
    //         let bottom_right = borders.get_at(3).unwrap();
    //         assert!(test_border(
    //             top_left,
    //             None,
    //             Some(expected),
    //             None,
    //             Some(expected)
    //         ));
    //         assert!(test_border(
    //             top_right,
    //             None,
    //             Some(expected),
    //             Some(expected),
    //             None
    //         ));
    //         assert!(test_border(
    //             bottom_left,
    //             Some(expected),
    //             None,
    //             None,
    //             Some(expected)
    //         ));
    //         assert!(test_border(
    //             bottom_right,
    //             Some(expected),
    //             None,
    //             Some(expected),
    //             None
    //         ));
    //     }

    //     #[test]
    //     #[parallel]
    //     fn a1_check_sheet() {
    //         let mut sheet = Sheet::test();

    //         // Test for Top border
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Top),
    //             Some(None)
    //         );
    //         sheet.borders.all.top = Some(BorderStyleTimestamp::default());
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Top),
    //             Some(Some(BorderStyleTimestamp::clear()))
    //         );

    //         // Test for Bottom border
    //         let mut sheet = Sheet::test();
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Bottom),
    //             Some(None)
    //         );
    //         sheet.borders.all.bottom = Some(BorderStyleTimestamp::default());
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Bottom),
    //             Some(Some(BorderStyleTimestamp::clear()))
    //         );

    //         // Test for Left border
    //         let mut sheet = Sheet::test();
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Left),
    //             Some(None)
    //         );
    //         sheet.borders.all.left = Some(BorderStyleTimestamp::default());
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Left),
    //             Some(Some(BorderStyleTimestamp::clear()))
    //         );

    //         // Test for Right border
    //         let mut sheet = Sheet::test();
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Right),
    //             Some(None)
    //         );
    //         sheet.borders.all.right = Some(BorderStyleTimestamp::default());
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Right),
    //             Some(Some(BorderStyleTimestamp::clear()))
    //         );

    //         // Test for column-specific borders
    //         let mut sheet = Sheet::test();
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Top),
    //             Some(None)
    //         );
    //         sheet.borders.columns.insert(0, BorderStyleCell::all());
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Top),
    //             Some(Some(BorderStyleTimestamp::clear()))
    //         );

    //         // Test for row-specific borders
    //         let mut sheet = Sheet::test();
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Bottom),
    //             Some(None)
    //         );
    //         sheet.borders.rows.insert(0, BorderStyleCell::all());
    //         assert_eq!(
    //             GridController::a1_check_sheet(&sheet, 0, 0, BorderSide::Top),
    //             Some(Some(BorderStyleTimestamp::clear()))
    //         );
    //     }
}
