//! Handles the logic for removing a rect from the selection. This is used when
//! a user excludes a Rect from the current selection.
//!
//! The logic iterates through each range, and if there is an overlap between
//! the range and the excluded rect, it changes the ranges to remove the
//! excluded rect. The one range may turn into between 0 and 4 ranges: the
//! remaining Top, Bottom, Left, and Right rects (calculated in that order).

use std::mem::swap;

use crate::{Pos, Rect};

use super::{A1Selection, CellRefCoord, CellRefRange, CellRefRangeEnd, RefRangeBounds};

impl A1Selection {
    /// Finds the remaining rectangles after excluding the given rectangle from a range.
    fn find_excluded_rects(range: RefRangeBounds, exclude: Rect) -> Vec<CellRefRange> {
        let mut ranges = Vec::new();

        let mut start_col = range.start.col;
        let mut start_row = range.start.row;
        let mut end_col = range.end.as_ref().and_then(|end| end.col);
        let mut end_row = range.end.as_ref().and_then(|end| end.row);

        // need to normalize start and end so start < end and start is defined and end is not
        if start_col.is_some_and(|c| end_col.is_some_and(|e| c.coord > e.coord)) {
            swap(&mut start_col, &mut end_col);
        }
        if start_col.is_none() && end_col.is_some() {
            swap(&mut start_col, &mut end_col);
        }
        if start_row.is_some_and(|r| end_row.is_some_and(|e| r.coord > e.coord)) {
            swap(&mut start_row, &mut end_row);
        }
        if start_row.is_none() && end_row.is_some() {
            swap(&mut start_row, &mut end_row);
        }

        // Top rectangle - only add if it doesn't overlap with exclude rect horizontally
        let mut top: Option<i64> = None;
        if start_row.is_some_and(|r| r.coord < exclude.min.y) {
            top = Some(exclude.min.y);
            let start = CellRefRangeEnd {
                col: start_col,
                row: start_row,
            };
            let end = if range.end.is_none() {
                // if there's no end, then we use the start so it'll be removed
                start
            } else {
                CellRefRangeEnd {
                    col: end_col,
                    row: Some(CellRefCoord::new_rel(exclude.min.y - 1)),
                }
            };
            ranges.push(RefRangeBounds {
                start,
                end: if start != end { Some(end) } else { None },
            });
        } else if start_row.is_none() && exclude.min.y > 1 {
            top = Some(exclude.min.y);
            let start = CellRefRangeEnd {
                col: start_col,
                row: Some(CellRefCoord::new_rel(1)),
            };
            let end = if range.end.is_none() {
                CellRefRangeEnd {
                    col: start_col,
                    row: Some(CellRefCoord::new_rel(exclude.min.y - 1)),
                }
            } else {
                CellRefRangeEnd {
                    col: end_col,
                    row: Some(CellRefCoord::new_rel(exclude.min.y - 1)),
                }
            };
            ranges.push(RefRangeBounds {
                start,
                end: if end == start { None } else { Some(end) },
            });
        }

        // Bottom rectangle - only add if it doesn't overlap with exclude rect horizontally
        let mut bottom: Option<i64> = None;
        if end_row.is_some_and(|r| r.coord > exclude.max.y) {
            bottom = Some(exclude.max.y);
            let start = CellRefRangeEnd {
                col: start_col,
                row: Some(CellRefCoord::new_rel(exclude.max.y + 1)),
            };
            let end = CellRefRangeEnd {
                col: end_col,
                row: end_row,
            };
            ranges.push(RefRangeBounds {
                start,
                end: if start != end { Some(end) } else { None },
            });
        } else if range.end.is_some() && end_row.is_none() {
            bottom = Some(exclude.max.y);
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd {
                    col: start_col,
                    row: Some(CellRefCoord::new_rel(exclude.max.y + 1)),
                },
                end: Some(CellRefRangeEnd {
                    col: range.end.unwrap().col,
                    row: None,
                }),
            });
        }
        // handle special case where an infinite column is broken by the excluded rect
        else if range.end.is_none() && range.start.row.is_none() {
            bottom = Some(exclude.max.y);
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd {
                    col: start_col,
                    row: Some(CellRefCoord::new_rel(exclude.max.y + 1)),
                },
                end: Some(CellRefRangeEnd {
                    col: start_col,
                    row: None,
                }),
            });
        }

        // Left rectangle - only add if there's space to the left of the exclude rect
        if start_col.is_some_and(|c| c.coord < exclude.min.x) {
            let start_col = start_col.map_or(1, |c| c.coord);
            let start = CellRefRangeEnd::new_relative_xy(
                start_col,
                top.unwrap_or(range.start.row.map_or(1, |r| r.coord)),
            );
            let end = CellRefRangeEnd {
                col: Some(CellRefCoord::new_rel(exclude.min.x - 1)),
                row: Some(CellRefCoord::new_rel(
                    bottom.unwrap_or(end_row.map_or(start_col, |r| r.coord)),
                )),
            };
            ranges.push(RefRangeBounds {
                start,
                end: if start != end { Some(end) } else { None },
            });
        }
        // also add a left rectangle if the there is no start_col
        else if start_col.is_none() && exclude.min.x > 1 {
            let start = CellRefRangeEnd::new_relative_xy(
                1,
                top.unwrap_or(start_row.map_or(1, |r| r.coord)),
            );
            let end = CellRefRangeEnd::new_relative_xy(
                exclude.min.x - 1,
                bottom.unwrap_or(end_row.map_or(start_row.map_or(1, |r| r.coord), |r| r.coord)),
            );
            ranges.push(RefRangeBounds {
                start,
                end: if start != end { Some(end) } else { None },
            });
        }

        // Right rectangle - only add if there's space to the right of the exclude rect
        if end_col.is_some_and(|c| c.coord > exclude.max.x) {
            let start = CellRefRangeEnd::new_relative_xy(
                exclude.max.x + 1,
                top.unwrap_or(start_row.map_or(1, |r| r.coord)),
            );
            let end = CellRefRangeEnd {
                col: end_col,
                row: Some(CellRefCoord::new_rel(
                    bottom.unwrap_or(end_row.map_or(1, |r| r.coord)),
                )),
            };
            ranges.push(RefRangeBounds {
                start,
                end: if start != end { Some(end) } else { None },
            });
        }
        // we'll need a right rect if there is no end_col
        else if range.end.is_some() && end_col.is_none() {
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(
                    exclude.max.x + 1,
                    top.unwrap_or(start_row.map_or(1, |r| r.coord)),
                ),
                end: Some(CellRefRangeEnd {
                    col: None,
                    row: Some(CellRefCoord::new_rel(
                        bottom.unwrap_or(range.end.unwrap().row.map_or(1, |r| r.coord)),
                    )),
                }),
            });
        } else if range.end.is_none() && range.start.col.is_none() {
            // handle an infinite column that's broken by the excluded rect
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(
                    exclude.max.x + 1,
                    start_row.map_or(1, |r| r.coord),
                ),
                end: Some(CellRefRangeEnd::new_infinite_row(
                    start_row.map_or(1, |r| r.coord),
                )),
            });
        }

        ranges
            .into_iter()
            .map(|range| CellRefRange::Sheet { range })
            .collect()
    }

    /// Removes the given rectangle from the selection.
    fn remove_rect(range: CellRefRange, p1: Pos, p2: Pos) -> Vec<CellRefRange> {
        let mut ranges = Vec::new();
        let exclude_rect = Rect { min: p1, max: p2 };

        match range {
            CellRefRange::Sheet { range } => {
                ranges.extend(A1Selection::find_excluded_rects(range, exclude_rect));
            }
        }

        ranges
    }

    /// Excludes the given cells from the selection.
    pub fn exclude_cells(&mut self, p1: Pos, p2: Option<Pos>) {
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
            if !range.is_pos_range(p1, p2)
                && (p2.is_none() || p2.is_some_and(|p2| !range.is_pos_range(p2, Some(p1))))
            {
                if let Some(p2) = p2 {
                    if range.might_intersect_rect(Rect { min: p1, max: p2 }) {
                        ranges.extend(A1Selection::remove_rect(range, p1, p2));
                    } else {
                        ranges.push(range);
                    }
                } else if range.might_contain_pos(p1) {
                    ranges.extend(A1Selection::remove_rect(range, p1, p1));
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
        if !self.contains_pos(self.cursor) {
            // we find a finite range to se the cursor to, starting at the end and working backwards
            if let Some(cursor) = self.ranges.iter().rev().find_map(|range| match range {
                CellRefRange::Sheet { range } => {
                    // first we check if end is finite
                    if let Some(end) = range.end {
                        if let (Some(end_col), Some(end_row)) = (end.col, end.row) {
                            return Some(Pos::new(end_col.coord, end_row.coord));
                        }
                    }
                    // otherwise we use the start if it is finite
                    if let (Some(start_col), Some(start_row)) = (range.start.col, range.start.row) {
                        return Some(Pos::new(start_col.coord, start_row.coord));
                    }
                    None
                }
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
#[serial_test::parallel]
mod test {
    use crate::CellRefRange;

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
                        end: Some(CellRefRangeEnd::new_relative_xy(6, 1))
                    }
                },
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(1, 5),
                        end: Some(CellRefRangeEnd::new_relative_xy(6, 6))
                    }
                },
                // left
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(1, 2),
                        end: Some(CellRefRangeEnd::new_relative_xy(1, 4))
                    }
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(5, 2),
                        end: Some(CellRefRangeEnd::new_relative_xy(6, 4))
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
                    end: Some(CellRefRangeEnd::new_relative_xy(6, 6))
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
                    end: Some(CellRefRangeEnd::new_relative_xy(4, 6))
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
                    end: Some(CellRefRangeEnd::new_relative_xy(6, 2))
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
                    end: Some(CellRefRangeEnd::new_relative_pos(Pos::new(6, 6)))
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
        let rects = A1Selection::find_excluded_rects(RefRangeBounds::ALL, Rect::new(1, 1, 3, 3));
        assert_eq!(
            rects,
            vec![
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_infinite_row(4),
                        end: Some(CellRefRangeEnd::UNBOUNDED)
                    }
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(4, 1),
                        end: Some(CellRefRangeEnd {
                            col: None,
                            row: Some(CellRefCoord::new_rel(3))
                        })
                    }
                },
            ]
        );
    }

    #[test]
    fn test_exclude_all_from_top() {
        let rects = A1Selection::find_excluded_rects(RefRangeBounds::ALL, Rect::new(3, 1, 6, 6));
        assert_eq!(
            rects,
            vec![
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_infinite_row(7),
                        end: Some(CellRefRangeEnd::UNBOUNDED)
                    }
                },
                // left
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(1, 1),
                        end: Some(CellRefRangeEnd::new_relative_xy(2, 6))
                    }
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(7, 1),
                        end: Some(CellRefRangeEnd::new_infinite_row(6))
                    }
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
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_infinite_row(1),
                        end: Some(CellRefRangeEnd::new_infinite_row(2)),
                    }
                },
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_infinite_row(7),
                        end: Some(CellRefRangeEnd::UNBOUNDED),
                    }
                },
                // right
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_relative_xy(7, 3),
                        end: Some(CellRefRangeEnd::new_infinite_row(6))
                    }
                },
            ]
        );
    }

    #[test]
    fn test_exclude_cells() {
        // let mut selection = A1Selection::test("A1,B2:C3");
        // selection.exclude_cells(Pos { x: 2, y: 2 }, Some(Pos { x: 3, y: 3 }));
        // assert_eq!(selection.ranges, vec![CellRefRange::test("A1")]);

        let mut selection = A1Selection::test_a1("B2:C3");
        selection.exclude_cells(pos![B2], Some(pos![C3]));
        assert_eq!(selection.cursor, Pos { x: 2, y: 2 });

        selection = A1Selection::test_a1("A1:C3");
        selection.exclude_cells(pos![B2], None);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("A1:C1"),
                CellRefRange::test("A3:C3"),
                CellRefRange::test("A2"),
                CellRefRange::test("C2"),
            ]
        );
    }
    #[test]
    fn test_exclude_cells_from_top_left() {
        let mut selection = A1Selection::test_a1("A1:C3");
        selection.exclude_cells(pos![A1], Some(pos![C2]));
        assert_eq!(selection.ranges, vec![CellRefRange::test("A3:C3")]);
    }

    #[test]
    fn test_exclude_cells_multiple() {
        let mut selection = A1Selection::test_a1("A1:C3,E5:F7");
        selection.exclude_cells("B2".into(), None);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("A1:C1"),
                CellRefRange::test("A3:C3"),
                CellRefRange::test("A2"),
                CellRefRange::test("C2"),
                CellRefRange::test("E5:F7"),
            ]
        );
        selection.exclude_cells(pos![A2], Some(pos![C3]));
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A1:C1"), CellRefRange::test("E5:F7")]
        );
    }

    #[test]
    fn test_exclude_cells_column() {
        let mut selection = A1Selection::test_a1("C");
        selection.exclude_cells(pos![C1], None);
        assert_eq!(selection.ranges, vec![CellRefRange::test("C2:C")]);

        let mut selection = A1Selection::test_a1("C");
        selection.exclude_cells(pos![C1], Some(pos![D5]));
        assert_eq!(selection.ranges, vec![CellRefRange::test("C6:C")]);

        let mut selection = A1Selection::test_a1("C");
        selection.exclude_cells(pos![C2], Some(pos![E5]));
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("C1"), CellRefRange::test("C6:C")]
        );
    }

    #[test]
    fn test_exclude_cells_column_range() {
        let mut selection = A1Selection::test_a1("C:E");
        selection.exclude_cells(pos![C1], None);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("C2:E"), CellRefRange::test("D1:E1")]
        );

        let mut selection = A1Selection::test_a1("C:F");
        selection.exclude_cells(pos![D2], Some(pos![E3]));
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("C1:F1"),
                CellRefRange::test("C4:F"),
                CellRefRange::test("C2:C3"),
                CellRefRange::test("F2:F3")
            ]
        );
    }

    #[test]
    fn test_exclude_cells_row() {
        let mut selection = A1Selection::test_a1("1");
        selection.exclude_cells(pos![A1], None);
        assert_eq!(selection.ranges, vec![CellRefRange::test("B1:1")]);

        let mut selection = A1Selection::test_a1("2");
        selection.exclude_cells(pos![B1], Some(pos![C5]));
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A2"), CellRefRange::test("D2:2")]
        );
    }

    #[test]
    fn test_exclude_cells_rows() {
        let mut selection = A1Selection::test_a1("2:5");
        selection.exclude_cells(pos![B2], None);
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("3:5"),
                CellRefRange::test("A2"),
                CellRefRange::test("C2:2")
            ]
        );

        let mut selection = A1Selection::test_a1("2:5");
        selection.exclude_cells(pos![B3], Some(pos![C4]));
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("2"),
                CellRefRange::test("5"),
                CellRefRange::test("A3:A4"),
                CellRefRange::test("D3:4")
            ]
        );

        let mut selection = A1Selection::test_a1("2:5");
        selection.exclude_cells(pos![B3], Some(pos![C5]));
        assert_eq!(
            selection.ranges,
            vec![
                CellRefRange::test("2"),
                CellRefRange::test("A3:A5"),
                CellRefRange::test("D3:5"),
            ]
        );
    }

    #[test]
    fn test_exclude_cells_column_single_middle() {
        let mut selection = A1Selection::test_a1("C");
        selection.exclude_cells(pos![C4], None);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("C1:C3"), CellRefRange::test("C5:C")]
        );
    }

    #[test]
    fn test_exclude_cells_rows_single_middle() {
        let mut selection = A1Selection::test_a1("2");
        selection.exclude_cells(pos![D2], None);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A2:C2"), CellRefRange::test("E2:2")]
        );
    }

    #[test]
    fn test_top_right_cell_failure() {
        let mut selection = A1Selection::test_a1("B7:C8");
        selection.exclude_cells(pos![C7], None);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("B8:C8"), CellRefRange::test("B7")]
        );
    }

    #[test]
    fn test_bottom_right_cell_failure() {
        let mut selection = A1Selection::test_a1("B7:C8");
        selection.exclude_cells(pos![C8], None);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("B7:C7"), CellRefRange::test("B8")]
        );
    }
}
