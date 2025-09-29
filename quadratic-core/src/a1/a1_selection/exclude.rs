//! Handles the logic for removing a rect from the selection. This is used when
//! a user excludes a Rect from the current selection.
//!
//! The logic iterates through each range, and if there is an overlap between
//! the range and the excluded rect, it changes the ranges to remove the
//! excluded rect. The one range may turn into between 0 and 4 ranges: the
//! remaining Top, Bottom, Left, and Right rects (calculated in that order).

use crate::a1::{A1Context, CellRefCoord, CellRefRangeEnd, RefRangeBounds};
use crate::{Pos, Rect};

use super::{A1Selection, CellRefRange};

impl A1Selection {
    /// Finds the remaining rectangles after excluding the given rectangle from a range.
    pub(crate) fn find_excluded_rects(mut range: RefRangeBounds, exclude: Rect) -> Vec<CellRefRange> {
        range.normalize_in_place();

        let mut ranges = Vec::new();

        // Top rectangle - only add if it doesn't overlap with exclude rect horizontally
        let mut top: Option<i64> = None;
        if range.start.row() < exclude.min.y {
            top = Some(exclude.min.y);
            let end = CellRefRangeEnd {
                col: range.end.col,
                row: CellRefCoord::new_rel(exclude.min.y - 1),
            };
            ranges.push(RefRangeBounds {
                start: range.start,
                end,
            });
        }

        // Bottom rectangle - only add if it doesn't overlap with exclude rect horizontally
        let mut bottom: Option<i64> = None;
        if range.end.row() > exclude.max.y {
            bottom = Some(exclude.max.y);
            let start = CellRefRangeEnd {
                col: range.start.col,
                row: CellRefCoord::new_rel(exclude.max.y + 1),
            };
            ranges.push(RefRangeBounds {
                start,
                end: range.end,
            });
        }
        // handle special case where an infinite column is broken by the excluded rect
        else if range.end.is_unbounded() && range.start.row.is_unbounded() {
            bottom = Some(exclude.max.y);
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd {
                    col: range.start.col,
                    row: CellRefCoord::new_rel(exclude.max.y + 1),
                },
                end: CellRefRangeEnd {
                    col: range.start.col,
                    row: CellRefCoord::REL_UNBOUNDED,
                },
            });
        }

        // Left rectangle - only add if there's space to the left of the exclude rect
        if range.start.col() < exclude.min.x {
            let start = CellRefRangeEnd::new_relative_xy(
                range.start.col(),
                top.unwrap_or(range.start.row()),
            );
            let end = CellRefRangeEnd {
                col: CellRefCoord::new_rel(exclude.min.x - 1),
                row: CellRefCoord::new_rel(bottom.unwrap_or(range.end.row())),
            };
            ranges.push(RefRangeBounds { start, end });
        }

        // Right rectangle - only add if there's space to the right of the exclude rect
        if range.end.col() > exclude.max.x {
            let start = CellRefRangeEnd::new_relative_xy(
                exclude.max.x + 1,
                top.unwrap_or(range.start.row()),
            );
            let end = CellRefRangeEnd {
                col: range.end.col,
                row: CellRefCoord::new_rel(bottom.unwrap_or(range.end.row())),
            };
            ranges.push(RefRangeBounds { start, end });
        }

        ranges
            .into_iter()
            .map(|range| CellRefRange::Sheet { range })
            .collect()
    }

    /// Removes the given rectangle from the selection.
    fn remove_rect(
        range: CellRefRange,
        p1: Pos,
        p2: Pos,
        a1_context: &A1Context,
    ) -> Vec<CellRefRange> {
        let mut ranges = Vec::new();
        let exclude_rect = Rect { min: p1, max: p2 };

        match range {
            CellRefRange::Sheet { range } => {
                ranges.extend(A1Selection::find_excluded_rects(range, exclude_rect));
            }
            CellRefRange::Table { range } => {
                if let Some(table_range) =
                    range.convert_to_ref_range_bounds(false, a1_context, false, false)
                {
                    ranges.extend(A1Selection::find_excluded_rects(table_range, exclude_rect));
                }
            }
        }
        ranges
    }

    /// Excludes the given cells from the selection.
    pub(crate) fn exclude_cells(&mut self, p1: Pos, p2: Option<Pos>, a1_context: &A1Context) {
        // normalize p1 and p2
        let (p1, p2) = if let Some(p2) = p2 {
            (
                Pos {
                    x: p1.x.min(p2.x),
                    y: p1.y.min(p2.y),
                },
                Some(Pos {
                    x: p1.x.max(p2.x),
                    y: p1.y.max(p2.y),
                }),
            )
        } else {
            (p1, p2)
        };

        let mut ranges = Vec::new();
        for range in self.ranges.drain(..) {
            // skip range if it's the entire range or the reverse of the entire range
            if !range.is_pos_range(p1, p2, a1_context)
                && (p2.is_none()
                    || p2.is_some_and(|p2| !range.is_pos_range(p2, Some(p1), a1_context)))
            {
                if let Some(p2) = p2 {
                    if range.might_intersect_rect(Rect { min: p1, max: p2 }, a1_context) {
                        ranges.extend(A1Selection::remove_rect(range, p1, p2, a1_context));
                    } else {
                        ranges.push(range);
                    }
                } else if range.might_contain_pos(p1, a1_context) {
                    ranges.extend(A1Selection::remove_rect(range, p1, p1, a1_context));
                } else {
                    ranges.push(range);
                }
            }
        }
        // if there are no ranges left, then add the cursor to the range
        if ranges.is_empty() {
            ranges.push(CellRefRange::Sheet {
                // if range is empty, then we set a range with the start of the excluded rect
                range: RefRangeBounds::new_relative_xy(p1.x, p1.y),
            });
        }
        self.ranges = ranges;

        // if the cursor is no longer in the range, then set the cursor to the last range
        if !self.contains_pos(self.cursor, a1_context) {
            // we find a finite range to set the cursor to, starting at the end and working backwards
            if let Some(cursor) = self.ranges.iter().rev().find_map(|range| match range {
                CellRefRange::Sheet { range } => {
                    // first we check if end is finite
                    if !range.end.is_unbounded() {
                        return Some(Pos::new(range.end.col(), range.end.row()));
                    }
                    // otherwise we use the start if it is finite
                    if !range.start.is_unbounded() {
                        return Some(Pos::new(range.start.col(), range.start.row()));
                    }
                    None
                }
                CellRefRange::Table { .. } => None,
            }) {
                self.cursor = cursor;
            } else {
                // fallback to A1 if range ends up empty
                self.cursor = Pos::new(1, 1);
            }
        }
    }
}

#[cfg(test)]
mod test {
    use crate::a1::{CellRefRange, CellRefRangeEnd, UNBOUNDED};

    use super::*;

    #[test]
    fn test_find_excluded_rects_exclude_inside_rect() {
        let rects = A1Selection::find_excluded_rects(
            RefRangeBounds::new_relative_rect(Rect::new(1, 1, 6, 6)),
            Rect::new(2, 2, 4, 4),
        );
        assert_eq!(
            rects,
            vec![
                // top
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(1, 1),
                        end: CellRefRangeEnd::new_relative_xy(6, 1)
                    }
                },
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(1, 5),
                        end: CellRefRangeEnd::new_relative_xy(6, 6)
                    }
                },
                // left
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(1, 2),
                        end: CellRefRangeEnd::new_relative_xy(1, 4)
                    }
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(5, 2),
                        end: CellRefRangeEnd::new_relative_xy(6, 4)
                    }
                },
            ]
        );
    }

    #[test]
    fn test_exclude_left_of_rect() {
        let rects = A1Selection::find_excluded_rects(
            RefRangeBounds::new_relative_rect(Rect::new(2, 2, 6, 6)),
            Rect::new(1, 1, 3, 8),
        );
        assert_eq!(
            rects,
            vec![CellRefRange::Sheet {
                range: RefRangeBounds {
                    start: CellRefRangeEnd::new_relative_xy(4, 2),
                    end: CellRefRangeEnd::new_relative_xy(6, 6)
                }
            }]
        );
    }

    #[test]
    fn test_exclude_right_of_rect() {
        let rects = A1Selection::find_excluded_rects(
            RefRangeBounds::new_relative_rect(Rect::new(1, 1, 6, 6)),
            Rect::new(5, 1, 8, 8),
        );
        assert_eq!(
            rects,
            vec![CellRefRange::Sheet {
                range: RefRangeBounds {
                    start: CellRefRangeEnd::new_relative_xy(1, 1),
                    end: CellRefRangeEnd::new_relative_xy(4, 6)
                }
            }]
        );
    }

    #[test]
    fn test_exclude_bottom_of_rect() {
        let rects = A1Selection::find_excluded_rects(
            RefRangeBounds::new_relative_rect(Rect::new(1, 1, 6, 6)),
            Rect::new(1, 3, 10, 10),
        );
        assert_eq!(
            rects,
            vec![CellRefRange::Sheet {
                range: RefRangeBounds {
                    start: CellRefRangeEnd::new_relative_xy(1, 1),
                    end: CellRefRangeEnd::new_relative_xy(6, 2)
                }
            }]
        );
    }

    #[test]
    fn test_exclude_top_of_rect() {
        let rects = A1Selection::find_excluded_rects(
            RefRangeBounds::new_relative_rect(Rect::new(1, 1, 6, 6)),
            Rect::new(1, 1, 10, 3),
        );
        assert_eq!(
            rects,
            vec![CellRefRange::Sheet {
                range: RefRangeBounds {
                    start: CellRefRangeEnd::new_relative_xy(1, 4),
                    end: CellRefRangeEnd::new_relative_pos(Pos::new(6, 6))
                }
            }]
        );
    }

    #[test]
    fn test_exclude_all() {
        let rects = A1Selection::find_excluded_rects(RefRangeBounds::ALL, Rect::test_a1("B2:D4"));
        assert_eq!(
            rects,
            vec![
                // top
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("1")
                },
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("5:")
                },
                // left
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("A2:A4")
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("E2:4"),
                },
            ]
        );
    }

    #[test]
    fn test_exclude_all_from_left_top() {
        let rects = A1Selection::find_excluded_rects(RefRangeBounds::ALL, Rect::test_a1("A1:C3"));
        assert_eq!(
            rects,
            vec![
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("A4:")
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("D1:3")
                },
            ]
        );
    }

    #[test]
    fn test_exclude_all_from_top() {
        let rects = A1Selection::find_excluded_rects(RefRangeBounds::ALL, Rect::test_a1("C1:F6"));
        assert_eq!(
            rects,
            vec![
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("7:")
                },
                // left
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("A1:B6")
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds::test_a1("G1:6")
                },
            ]
        );
    }

    #[test]
    fn test_exclude_all_from_left() {
        let rects = A1Selection::find_excluded_rects(RefRangeBounds::ALL, Rect::new(1, 3, 6, 6));
        assert_eq!(
            rects,
            vec![
                // top
                CellRefRange::Sheet {
                    range: RefRangeBounds::new_infinite_rows(1, 2)
                },
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds::new_infinite_rows(7, UNBOUNDED)
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(7, 3),
                        end: CellRefRangeEnd::new_relative_xy(UNBOUNDED, 6)
                    }
                },
            ]
        );
    }

    #[test]
    fn test_exclude_cells() {
        let mut selection = A1Selection::test_a1("A1,B2:C3");
        let context = A1Context::default();
        selection.exclude_cells(Pos { x: 2, y: 2 }, Some(Pos { x: 3, y: 3 }), &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A1")]);

        let mut selection = A1Selection::test_a1("B2:C3");
        selection.exclude_cells(pos![B2], Some(pos![C3]), &context);
        assert_eq!(selection.cursor, Pos { x: 2, y: 2 });

        selection = A1Selection::test_a1("A1:C3");
        selection.exclude_cells(pos![B2], None, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A1:C1"),
                CellRefRange::test_a1("A3:C3"),
                CellRefRange::test_a1("A2"),
                CellRefRange::test_a1("C2"),
            ]
        );
    }
    #[test]
    fn test_exclude_cells_from_top_left() {
        let mut selection = A1Selection::test_a1("A1:C3");
        let context = A1Context::default();
        selection.exclude_cells(pos![A1], Some(pos![C2]), &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("A3:C3")]);
    }

    #[test]
    fn test_exclude_cells_multiple() {
        let mut selection = A1Selection::test_a1("A1:C3,E5:F7");
        let context = A1Context::default();
        selection.exclude_cells("B2".into(), None, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A1:C1"),
                CellRefRange::test_a1("A3:C3"),
                CellRefRange::test_a1("A2"),
                CellRefRange::test_a1("C2"),
                CellRefRange::test_a1("E5:F7"),
            ]
        );
        selection.exclude_cells(pos![A2], Some(pos![C3]), &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A1:C1"),
                CellRefRange::test_a1("E5:F7")
            ]
        );
    }

    #[test]
    fn test_exclude_cells_column() {
        let mut selection = A1Selection::test_a1("C");
        let context = A1Context::default();
        selection.exclude_cells(pos![C1], None, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("C2:C")]);

        let mut selection = A1Selection::test_a1("C");
        selection.exclude_cells(pos![C1], Some(pos![D5]), &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("C6:C")]);

        let mut selection = A1Selection::test_a1("C");
        selection.exclude_cells(pos![C2], Some(pos![E5]), &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("C1"), CellRefRange::test_a1("C6:C")]
        );
    }

    #[test]
    fn test_exclude_cells_column_range() {
        let mut selection = A1Selection::test_a1("C:E");
        let context = A1Context::default();
        selection.exclude_cells(pos![C1], None, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("C2:E"),
                CellRefRange::test_a1("D1:E1")
            ]
        );

        let mut selection = A1Selection::test_a1("C:F");
        selection.exclude_cells(pos![D2], Some(pos![E3]), &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("C1:F1"),
                CellRefRange::test_a1("C4:F"),
                CellRefRange::test_a1("C2:C3"),
                CellRefRange::test_a1("F2:F3")
            ]
        );
    }

    #[test]
    fn test_exclude_cells_row() {
        let mut selection = A1Selection::test_a1("1");
        let context = A1Context::default();
        selection.exclude_cells(pos![A1], None, &context);
        assert_eq!(selection.ranges, vec![CellRefRange::test_a1("B1:1")]);

        let mut selection = A1Selection::test_a1("2");
        selection.exclude_cells(pos![B1], Some(pos![C5]), &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("A2"), CellRefRange::test_a1("D2:2")]
        );
    }

    #[test]
    fn test_exclude_cells_rows() {
        let mut selection = A1Selection::test_a1("2:5");
        let context = A1Context::default();
        selection.exclude_cells(pos![B2], None, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("3:5"),
                CellRefRange::test_a1("A2"),
                CellRefRange::test_a1("C2:2")
            ]
        );

        let mut selection = A1Selection::test_a1("2:5");
        selection.exclude_cells(pos![B3], Some(pos![C4]), &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("2"),
                CellRefRange::test_a1("5"),
                CellRefRange::test_a1("A3:A4"),
                CellRefRange::test_a1("D3:4")
            ]
        );

        let mut selection = A1Selection::test_a1("2:5");
        selection.exclude_cells(pos![B3], Some(pos![C5]), &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("2"),
                CellRefRange::test_a1("A3:A5"),
                CellRefRange::test_a1("D3:5"),
            ]
        );
    }

    #[test]
    fn test_exclude_cells_column_single_middle() {
        let mut selection = A1Selection::test_a1("C");
        let context = A1Context::default();
        selection.exclude_cells(pos![C4], None, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("C1:C3"),
                CellRefRange::test_a1("C5:C")
            ]
        );
    }

    #[test]
    fn test_exclude_cells_rows_single_middle() {
        let mut selection = A1Selection::test_a1("2");
        let context = A1Context::default();
        selection.exclude_cells(pos![D2], None, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A2:C2"),
                CellRefRange::test_a1("E2:2")
            ]
        );
    }

    #[test]
    fn test_exclude_cells_table() {
        let context = A1Context::test(
            &[],
            &[("Table1", &["Col1", "Col2"], Rect::test_a1("A1:B2"))],
        );
        let mut selection = A1Selection::test_a1_context("Table1[#ALL]", &context);
        selection.exclude_cells(pos![A1], None, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A2:B2"),
                CellRefRange::test_a1("B2:B1")
            ]
        );
    }

    #[test]
    fn test_top_right_cell_failure() {
        let mut selection = A1Selection::test_a1("B7:C8");
        let context = A1Context::default();
        selection.exclude_cells(pos![C7], None, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("B8:C8"), CellRefRange::test_a1("B7")]
        );
    }

    #[test]
    fn test_bottom_right_cell_failure() {
        let mut selection = A1Selection::test_a1("B7:C8");
        let context = A1Context::default();
        selection.exclude_cells(pos![C8], None, &context);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test_a1("B7:C7"), CellRefRange::test_a1("B8")]
        );
    }

    #[test]
    fn test_3x3_exclude_middle() {
        let mut selection = A1Selection::test_a1("A1:C3");
        let context = A1Context::default();
        selection.exclude_cells(pos![B2], None, &context);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test_a1("A1:C1"),
                CellRefRange::test_a1("A3:C3"),
                CellRefRange::test_a1("A2"),
                CellRefRange::test_a1("C2"),
            ]
        );
    }
}
