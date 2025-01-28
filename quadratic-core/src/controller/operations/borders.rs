//! Create border operations based on BorderSelection (eg, Inner, Outer). For
//! infinite sheet borders, we do not support BorderSelections like Outer,
//! Right, etc. But for tables, we apply the far-right and far-bottom borders to
//! the UNBOUNDED coordinate, so we can properly render the outside border as necessary.

use crate::{
    a1::{A1Selection, CellRefRange, RefRangeBounds, UNBOUNDED},
    controller::GridController,
    grid::sheet::borders::{BorderSelection, BorderStyle, BordersUpdates},
    ClearOption,
};

use super::operation::Operation;

impl GridController {
    /// Populates the BordersUpdates for a range.
    fn a1_border_style_range(
        &self,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        range: &RefRangeBounds,
        borders: &mut BordersUpdates,
        clear_neighbors: bool,
        table: bool,
    ) {
        // original style is used to determine if we should clear the borders by
        // clearing the neighboring cell. We do not have to do this if we are
        // setting a style since we track timestamps. This is only necessary if
        // we are clearing a style.
        let clear_neighbors = clear_neighbors && style.is_none();

        let style = style.map_or(Some(ClearOption::Clear), |s| {
            Some(ClearOption::Some(s.into()))
        });
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
                if clear_neighbors {
                    if x1 > 1 {
                        borders.right.get_or_insert_default().set_rect(
                            x1 - 1,
                            y1,
                            Some(x1 - 1),
                            y2,
                            Some(ClearOption::Clear),
                        );
                    }
                    if y1 > 1 {
                        borders.bottom.get_or_insert_default().set_rect(
                            x1,
                            y1 - 1,
                            x2,
                            Some(y1 - 1),
                            Some(ClearOption::Clear),
                        );
                    }
                    if let Some(x2) = x2 {
                        borders.left.get_or_insert_default().set_rect(
                            x2 + 1,
                            y1,
                            Some(x2 + 1),
                            y2,
                            Some(ClearOption::Clear),
                        );
                    }
                    if let Some(y2) = y2 {
                        borders.top.get_or_insert_default().set_rect(
                            x1,
                            y2 + 1,
                            x2,
                            Some(y2 + 1),
                            Some(ClearOption::Clear),
                        );
                    }
                }
            }
            BorderSelection::Inner => {
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1 + 1, y1, x2, y2, style);
                if let Some(x2) = x2 {
                    borders.right.get_or_insert_default().set_rect(
                        x1,
                        y1,
                        Some((x2 - 1).max(1)),
                        y2,
                        style,
                    );
                }
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1 + 1, x2, y2, style);
                if let Some(y2) = y2 {
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y1,
                        x2,
                        Some((y2 - 1).max(1)),
                        style,
                    );
                }
            }
            BorderSelection::Outer => {
                // we do not support infinite outer
                if let (Some(x2), Some(y2)) = (x2, y2) {
                    borders.left.get_or_insert_default().set_rect(
                        x1,
                        y1,
                        Some(x1),
                        Some(y2),
                        style,
                    );
                    borders.right.get_or_insert_default().set_rect(
                        x2,
                        y1,
                        Some(x2),
                        Some(y2),
                        style,
                    );
                    borders
                        .top
                        .get_or_insert_default()
                        .set_rect(x1, y1, Some(x2), Some(y1), style);
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y2,
                        Some(x2),
                        Some(y2),
                        style,
                    );
                } else if table {
                    borders.left.get_or_insert_default().set_rect(
                        x1,
                        y1,
                        Some(x1),
                        y2.map(|y2| y2 + 1),
                        style,
                    );
                    borders.right.get_or_insert_default().set_rect(
                        x2.map_or(UNBOUNDED, |x2| x2 + 1),
                        y1,
                        Some(x2.map_or(UNBOUNDED, |x2| x2 + 1)),
                        y2.map(|y2| y2 + 1),
                        style,
                    );
                    borders.top.get_or_insert_default().set_rect(
                        x1,
                        y1,
                        x2.map(|x2| x2 + 1),
                        Some(y1),
                        style,
                    );
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y2.map_or(UNBOUNDED, |y2| y2 + 1),
                        x2.map(|x2| x2 + 1),
                        Some(y2.map_or(UNBOUNDED, |y2| y2 + 1)),
                        style,
                    );
                }

                if clear_neighbors {
                    if x1 > 1 {
                        borders.right.get_or_insert_default().set_rect(
                            x1 - 1,
                            y1,
                            Some(x1 - 1),
                            y2,
                            Some(ClearOption::Clear),
                        );
                    }
                    if y1 > 1 {
                        borders.bottom.get_or_insert_default().set_rect(
                            x1,
                            y1 - 1,
                            x2,
                            Some(y1 - 1),
                            Some(ClearOption::Clear),
                        );
                    }
                    if let Some(x2) = x2 {
                        borders.left.get_or_insert_default().set_rect(
                            x2 + 1,
                            y1,
                            Some(x2 + 1),
                            y2,
                            Some(ClearOption::Clear),
                        );
                    }
                    if let Some(y2) = y2 {
                        borders.top.get_or_insert_default().set_rect(
                            x1,
                            y2 + 1,
                            x2,
                            Some(y2 + 1),
                            Some(ClearOption::Clear),
                        );
                    }
                }
            }
            BorderSelection::Horizontal => {
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1 + 1, x2, y2, style);
                if clear_neighbors {
                    if let Some(y2) = y2 {
                        borders.bottom.get_or_insert_default().set_rect(
                            x1,
                            y1,
                            x2,
                            Some((y2 - 1).max(1)),
                            Some(ClearOption::Clear),
                        );
                    }
                }
            }
            BorderSelection::Vertical => {
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1 + 1, y1, x2, y2, style);
                if clear_neighbors {
                    if let Some(x2) = x2 {
                        borders.right.get_or_insert_default().set_rect(
                            x1,
                            y1,
                            Some((x2 - 1).max(1)),
                            y2,
                            Some(ClearOption::Clear),
                        );
                    }
                }
            }
            BorderSelection::Left => {
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1, y1, Some(x1), y2, style);
                if clear_neighbors && x1 > 1 {
                    borders.right.get_or_insert_default().set_rect(
                        x1 - 1,
                        y1,
                        Some(x1 - 1),
                        y2,
                        Some(ClearOption::Clear),
                    );
                }
            }
            BorderSelection::Top => {
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, Some(y1), style);
                if clear_neighbors && y1 > 1 {
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y1 - 1,
                        x2,
                        Some(y1 - 1),
                        Some(ClearOption::Clear),
                    );
                }
            }
            BorderSelection::Right => {
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x2, y1, Some(x2), y2, style);
                } else if table {
                    borders.right.get_or_insert_default().set_rect(
                        x2.map_or(UNBOUNDED, |x2| x2 + 1),
                        y1,
                        Some(x2.map_or(UNBOUNDED, |x2| x2 + 1)),
                        y2,
                        style,
                    );
                }
                if clear_neighbors {
                    if let Some(x2) = x2 {
                        borders.left.get_or_insert_default().set_rect(
                            x2 + 1,
                            y1,
                            Some(x2 + 1),
                            y2,
                            Some(ClearOption::Clear),
                        );
                    }
                }
            }
            BorderSelection::Bottom => {
                if let Some(y2) = y2 {
                    borders
                        .bottom
                        .get_or_insert_default()
                        .set_rect(x1, y2, x2, Some(y2), style);
                } else if table {
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y2.map_or(UNBOUNDED, |y2| y2 + 1),
                        x2.map(|x2| x2 + 1),
                        Some(y2.map_or(UNBOUNDED, |y2| y2 + 1)),
                        style,
                    );
                }
                if clear_neighbors {
                    if let Some(y2) = y2 {
                        borders.top.get_or_insert_default().set_rect(
                            x1,
                            y2 + 1,
                            x2,
                            Some(y2 + 1),
                            Some(ClearOption::Clear),
                        );
                    }
                }
            }
            // for clear, we need to remove any borders that are at the edges of
            // the range--eg, the left border at the next column to the right of the range
            BorderSelection::Clear => {
                borders.top.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2,
                    y2.map(|y2| y2 + 1),
                    Some(ClearOption::Clear),
                );
                borders.bottom.get_or_insert_default().set_rect(
                    x1,
                    (y1 - 1).max(1),
                    x2,
                    y2,
                    Some(ClearOption::Clear),
                );
                borders.left.get_or_insert_default().set_rect(
                    x1,
                    y1,
                    x2.map(|x2| x2 + 1),
                    y2,
                    Some(ClearOption::Clear),
                );
                borders.right.get_or_insert_default().set_rect(
                    (x1 - 1).max(1),
                    y1,
                    x2,
                    y2,
                    Some(ClearOption::Clear),
                );
            }
        }
    }

    /// Whether the borders should be toggled.
    fn should_toggle_borders(
        &self,
        selection: &A1Selection,
        border_selection: BorderSelection,
        style: BorderStyle,
    ) -> bool {
        let Some(sheet) = self.try_sheet(selection.sheet_id) else {
            return false;
        };

        // If we have a style update, then we check if we should toggle
        // instead of setting the style.
        let mut borders: BordersUpdates = BordersUpdates::default();

        let context = self.grid().a1_context();

        // We compare w/o clear_neighbors since we don't care about the
        // neighbors when toggling.
        for range in selection.ranges.iter() {
            match range {
                CellRefRange::Sheet { range } => {
                    self.a1_border_style_range(
                        border_selection,
                        Some(style),
                        range,
                        &mut borders,
                        false,
                        false,
                    );
                }
                CellRefRange::Table { range } => {
                    if let Some((pos, table)) = sheet.data_table_by_name(range.table_name.clone()) {
                        if let Some(range) =
                            range.convert_to_ref_range_bounds(true, &context, false, true)
                        {
                            let range = range.translate(-pos.x, -pos.y);
                            self.a1_border_style_range(
                                border_selection,
                                Some(style),
                                &range,
                                &mut borders,
                                false,
                                true,
                            );
                            if !table.borders.is_toggle_borders(&borders) {
                                return false;
                            }
                        }
                    }
                }
            }
        }
        sheet.borders.is_toggle_borders(&borders)
    }

    /// Creates border operations. Returns None if selection is empty.
    pub fn set_borders_a1_selection_operations(
        &self,
        selection: A1Selection,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        clear_neighbors: bool,
    ) -> Option<Vec<Operation>> {
        // Mutable so we can clear it if the style is toggled.
        let mut style = style;

        if style
            .is_some_and(|style| self.should_toggle_borders(&selection, border_selection, style))
        {
            style = None;
        }

        let context = self.grid().a1_context();
        let mut ops = vec![];

        let mut sheet_borders = BordersUpdates::default();
        selection.ranges.iter().for_each(|range| match range {
            CellRefRange::Sheet { range } => {
                self.a1_border_style_range(
                    border_selection,
                    style,
                    range,
                    &mut sheet_borders,
                    clear_neighbors,
                    false,
                );
            }
            CellRefRange::Table { range } => {
                if let (Some(entry), Some(range)) = (
                    context.try_table(&range.table_name),
                    range.convert_to_ref_range_bounds(true, &context, false, true),
                ) {
                    // borders are always 1-based
                    let range = range.translate(-entry.bounds.min.x + 1, -entry.bounds.min.y + 1);
                    let mut borders = BordersUpdates::default();
                    self.a1_border_style_range(
                        border_selection,
                        style,
                        &range,
                        &mut borders,
                        clear_neighbors,
                        true,
                    );
                    ops.push(Operation::DataTableBorders {
                        sheet_pos: entry.bounds.min.to_sheet_pos(entry.sheet_id),
                        borders,
                    });
                }
            }
        });

        if !sheet_borders.is_empty() {
            ops.push(Operation::SetBordersA1 {
                sheet_id: selection.sheet_id,
                borders: sheet_borders,
            });
        }

        if ops.is_empty() {
            None
        } else {
            Some(ops)
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {

    use crate::{grid::SheetId, Pos};

    use super::*;

    #[track_caller]
    fn assert_borders(borders: &BordersUpdates, pos: Pos, side: &str) {
        let top = side.contains("top");
        let bottom = side.contains("bottom");
        let left = side.contains("left");
        let right = side.contains("right");
        if top {
            assert!(
                borders.top.as_ref().unwrap().get(pos).is_some(),
                "Expected top border at {} but found none",
                pos.a1_string()
            );
        } else {
            assert!(
                borders.top.is_none() || borders.top.as_ref().unwrap().get(pos).is_none(),
                "Expected no top border at {} but found one",
                pos.a1_string()
            );
        }
        if bottom {
            assert!(
                borders.bottom.as_ref().unwrap().get(pos).is_some(),
                "Expected bottom border at {} but found none",
                pos.a1_string()
            );
        } else {
            assert!(
                borders.bottom.is_none() || borders.bottom.as_ref().unwrap().get(pos).is_none(),
                "Expected no bottom border at {} but found one",
                pos.a1_string()
            );
        }
        if left {
            assert!(
                borders.left.as_ref().unwrap().get(pos).is_some(),
                "Expected left border at {} but found none",
                pos.a1_string()
            );
        } else {
            assert!(
                borders.left.is_none() || borders.left.as_ref().unwrap().get(pos).is_none(),
                "Expected no left border at {} but found one",
                pos.a1_string()
            );
        }
        if right {
            assert!(
                borders.right.as_ref().unwrap().get(pos).is_some(),
                "Expected right border at {} but found none",
                pos.a1_string()
            );
        } else {
            assert!(
                borders.right.is_none() || borders.right.as_ref().unwrap().get(pos).is_none(),
                "Expected no right border at {} but found one",
                pos.a1_string()
            );
        }
    }

    #[test]
    fn test_borders_operations_all_all() {
        let gc = GridController::test();
        let ops = gc
            .set_borders_a1_selection_operations(
                A1Selection::test_a1("*"),
                BorderSelection::All,
                Some(BorderStyle::default()),
                true,
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersA1 { sheet_id, borders } = ops[0].clone() else {
            panic!("Expected SetBordersA1")
        };
        assert_eq!(sheet_id, SheetId::TEST);
        assert_borders(&borders, pos![A1], "top,bottom,left,right");
        assert_borders(&borders, pos![ZZZZ10000], "top,bottom,left,right");
    }

    #[test]
    fn test_borders_operations_all_left() {
        let gc = GridController::test();
        let ops = gc
            .set_borders_a1_selection_operations(
                A1Selection::test_a1("*"),
                BorderSelection::Left,
                Some(BorderStyle::default()),
                true,
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersA1 { sheet_id, borders } = ops[0].clone() else {
            panic!("Expected SetBordersA1")
        };
        assert_eq!(sheet_id, SheetId::TEST);
        assert_borders(&borders, pos![A1], "left");
        assert_borders(&borders, pos![A100000], "left");
        assert!(borders.right.is_none());
        assert!(borders.top.is_none());
        assert!(borders.bottom.is_none());
    }

    #[test]
    fn test_borders_operations_columns() {
        let gc = GridController::test();
        let ops = gc
            .set_borders_a1_selection_operations(
                A1Selection::test_a1("C:E"),
                BorderSelection::Right,
                Some(BorderStyle::default()),
                true,
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersA1 { sheet_id, borders } = ops[0].clone() else {
            panic!("Expected SetBordersA1")
        };
        assert_eq!(sheet_id, SheetId::TEST);
        assert_borders(&borders, pos![E1], "right");
        assert_borders(&borders, pos![E100000], "right");
        assert_borders(&borders, pos![A1], "");
        assert!(borders.left.is_none());
        assert!(borders.top.is_none());
        assert!(borders.bottom.is_none());
    }

    #[test]
    fn test_borders_operations_rows() {
        let gc = GridController::test();
        let ops = gc
            .set_borders_a1_selection_operations(
                A1Selection::test_a1("2:4"),
                BorderSelection::Bottom,
                Some(BorderStyle::default()),
                true,
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersA1 { sheet_id, borders } = ops[0].clone() else {
            panic!("Expected SetBordersA1")
        };
        assert_eq!(sheet_id, SheetId::TEST);
        assert_borders(&borders, pos![A1], "");
        assert_borders(&borders, pos![A2], "");
        assert_borders(&borders, pos![A3], "");
        assert_borders(&borders, pos![A4], "bottom");
        assert_borders(&borders, pos![ZZZZZ4], "bottom");
        assert!(borders.left.is_none());
        assert!(borders.right.is_none());
        assert!(borders.top.is_none());
    }

    #[test]
    fn test_borders_operations_rects() {
        let gc = GridController::test();
        let ops = gc
            .set_borders_a1_selection_operations(
                A1Selection::test_a1("B3:D5"),
                BorderSelection::Outer,
                Some(BorderStyle::default()),
                true,
            )
            .unwrap();
        assert_eq!(ops.len(), 1);
        let Operation::SetBordersA1 { sheet_id, borders } = ops[0].clone() else {
            panic!("Expected SetBordersA1")
        };
        assert_eq!(sheet_id, SheetId::TEST);
        assert_borders(&borders, pos![B3], "left,top");
        assert_borders(&borders, pos![C3], "top");
        assert_borders(&borders, pos![D5], "right,bottom");
        assert_borders(&borders, pos![C5], "bottom");
    }
}
