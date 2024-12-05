use crate::{
    controller::GridController,
    grid::sheet::borders_a1::{BorderSelection, BorderStyle, BordersA1Updates},
    A1Selection, CellRefRange, RefRangeBounds,
};

use super::operation::Operation;

impl GridController {
    /// Populates the BordersA1Updates for a range.
    fn a1_border_style_range(
        &self,
        border_selection: BorderSelection,
        style: Option<BorderStyle>,
        range: &RefRangeBounds,
        borders: &mut BordersA1Updates,
    ) {
        let style = style.map(|s| Some(s.into()));
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
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1 + 1, y1, x2, y2, style);
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x1, y1, Some(x2 - 1), y2, style);
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
                        Some(y2 - 1),
                        style,
                    );
                }
            }
            BorderSelection::Outer => {
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1, y1, Some(x1), y2, style);
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x2, y1, Some(x2), y2, style);
                }
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, Some(y1), style);
                if let Some(y2) = y2 {
                    borders
                        .bottom
                        .get_or_insert_default()
                        .set_rect(x1, y2, x2, Some(y2), style);
                }
            }
            BorderSelection::Horizontal => {
                if let Some(y2) = y2 {
                    borders.bottom.get_or_insert_default().set_rect(
                        x1,
                        y2,
                        x2,
                        Some(y2 - 1),
                        style,
                    );
                }
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1 + 1, x2, y2, style);
            }
            BorderSelection::Vertical => {
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x2, y1, Some(x2 - 1), y2, style);
                }
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1 + 1, y1, x2, y2, style);
            }
            BorderSelection::Left => {
                borders
                    .left
                    .get_or_insert_default()
                    .set_rect(x1, y1, Some(x1), y2, style);
            }
            BorderSelection::Top => {
                borders
                    .top
                    .get_or_insert_default()
                    .set_rect(x1, y1, x2, Some(y1), style);
            }
            BorderSelection::Right => {
                if let Some(x2) = x2 {
                    borders
                        .right
                        .get_or_insert_default()
                        .set_rect(x2, y1, Some(x2), y2, style);
                }
            }
            BorderSelection::Bottom => {
                if let Some(y2) = y2 {
                    borders
                        .bottom
                        .get_or_insert_default()
                        .set_rect(x1, y2, x2, Some(y2), style);
                }
            }
            BorderSelection::Clear => {
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
        let mut borders: BordersA1Updates = BordersA1Updates::default();

        let sheet = self.try_sheet(selection.sheet_id)?;
        selection.ranges.iter().for_each(|range| {
            let style = if sheet
                .borders_a1
                .is_toggle_borders(border_selection, style, range)
            {
                None
            } else {
                style
            };
            match range {
                CellRefRange::Sheet { range } => {
                    self.a1_border_style_range(border_selection, style, range, &mut borders);
                }
            }
        });

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

    use crate::{grid::SheetId, Pos};

    use super::*;

    fn assert_borders(borders: &BordersA1Updates, pos: Pos, side: &str) {
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
