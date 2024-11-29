//! Handles the logic for removing a rect from the selection.

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
        let mut top: Option<u64> = None;
        if start_row.is_some_and(|r| r.coord < exclude.min.y as u64) {
            top = Some(exclude.min.y as u64);
            let start = CellRefRangeEnd {
                col: start_col,
                row: start_row,
            };
            let end = CellRefRangeEnd {
                col: end_col,
                row: Some(CellRefCoord::new_rel(exclude.min.y as u64 - 1)),
            };
            ranges.push(RefRangeBounds {
                start,
                end: if start != end { Some(end) } else { None },
            });
        } else if start_row.is_none() && exclude.min.y > 1 {
            top = Some(exclude.min.y as u64);
            let end = if exclude.min.y - 1 == 1 {
                None
            } else {
                if exclude.min.y - 1 != 1 {
                    Some(CellRefRangeEnd::new_infinite_row(exclude.min.y as u64 - 1))
                } else {
                    None
                }
            };
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd::new_infinite_row(1),
                end,
            });
        }

        // Bottom rectangle - only add if it doesn't overlap with exclude rect horizontally
        let mut bottom: Option<u64> = None;
        if end_row.is_some_and(|r| r.coord > exclude.max.y as u64) {
            bottom = Some(exclude.max.y as u64);
            let start = CellRefRangeEnd::new_relative_xy(
                start_col.map_or(1, |c| c.coord as u64),
                exclude.max.y as u64 + 1,
            );
            let end = CellRefRangeEnd {
                col: end_col,
                row: end_row,
            };
            ranges.push(RefRangeBounds {
                start,
                end: if start != end { Some(end) } else { None },
            });
        } else if range.end.is_some() && end_row.is_none() {
            bottom = Some(exclude.max.y as u64);
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd::new_infinite_row(exclude.max.y as u64 + 1),
                end: Some(CellRefRangeEnd::UNBOUNDED),
            });
        }

        // Left rectangle - only add if there's space to the left of the exclude rect
        if start_col.is_some_and(|c| c.coord < exclude.min.x as u64) {
            let start = CellRefRangeEnd::new_relative_xy(
                exclude.max.x as u64 - 1,
                top.unwrap_or(start_row.map_or(1, |r| r.coord as u64)),
            );
            let end = CellRefRangeEnd {
                col: Some(CellRefCoord::new_rel(exclude.min.x as u64 - 1)),
                row: Some(CellRefCoord::new_rel(
                    bottom.unwrap_or(end_row.map_or(1, |r| r.coord as u64)),
                )),
            };
            ranges.push(RefRangeBounds {
                start,
                end: if start != end { Some(end) } else { None },
            });
        }
        // also add a left rectangle if the there is no start_col and the
        // excluded rect is to the right of 1
        else if start_col.is_none() && exclude.min.x > 1 {
            let left_end_x = exclude.min.x as u64;
            if left_end_x >= start_col.map_or(1, |c| c.coord as i64) as u64 {
                let start =
                    CellRefRangeEnd::new_relative_xy(1, top.unwrap_or(exclude.min.y as u64));
                let end = CellRefRangeEnd::new_relative_xy(
                    left_end_x - 1,
                    bottom.unwrap_or(exclude.max.y as u64),
                );
                ranges.push(RefRangeBounds {
                    start,
                    end: if start != end { Some(end) } else { None },
                });
            }
        }

        // Right rectangle - only add if there's space to the right of the exclude rect
        if end_col.is_some_and(|c| c.coord > exclude.max.x as u64) {
            let start = CellRefRangeEnd::new_relative_xy(
                exclude.max.x as u64 + 1,
                top.unwrap_or(start_row.map_or(1, |r| r.coord as u64)),
            );
            let end = CellRefRangeEnd {
                col: end_col,
                row: Some(CellRefCoord::new_rel(
                    bottom.unwrap_or(end_row.map_or(1, |r| r.coord as u64)),
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
                    exclude.max.x as u64 + 1,
                    top.unwrap_or(start_row.map_or(1, |r| r.coord as u64)),
                ),
                end: Some(CellRefRangeEnd {
                    col: None,
                    row: bottom.map(|b| CellRefCoord::new_rel(b)),
                }),
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
        dbgjs!(&p1);
        dbgjs!(&p2);
        let mut ranges = Vec::new();
        while let Some(range) = self.ranges.drain(..).next() {
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
            self.ranges.push(CellRefRange::Sheet {
                range: RefRangeBounds::new_relative_xy(self.cursor.x as u64, self.cursor.y as u64),
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
                            return Some(Pos::new(end_col.coord as i64, end_row.coord as i64));
                        }
                    }
                    // otherwise we use the start if it is finite
                    if let (Some(start_col), Some(start_row)) = (range.start.col, range.start.row) {
                        return Some(Pos::new(start_col.coord as i64, start_row.coord as i64));
                    }
                    None
                }
            }) {
                self.cursor = cursor;
            } else {
                // we use A1 as the fallback (eg, when ALL is the only range)
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
        let rects = A1Selection::find_excluded_rects(RefRangeBounds::ALL, Rect::new(2, 2, 4, 4));
        assert_eq!(
            rects,
            vec![
                // top
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_infinite_row(1),
                        end: None
                    }
                },
                // bottom
                CellRefRange::Sheet {
                    range: RefRangeBounds {
                        start: CellRefRangeEnd::new_infinite_row(5),
                        end: Some(CellRefRangeEnd::UNBOUNDED)
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
                        end: Some(CellRefRangeEnd {
                            col: None,
                            row: Some(CellRefCoord::new_rel(4)),
                        })
                    }
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
        let mut selection = A1Selection::test("A1,B2:C3");
        selection.exclude_cells(Pos { x: 2, y: 2 }, Some(Pos { x: 3, y: 3 }));
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1")]);

        selection = A1Selection::test("B2:C3");
        selection.exclude_cells(Pos { x: 2, y: 2 }, Some(Pos { x: 3, y: 3 }));
        assert_eq!(selection.cursor, Pos { x: 2, y: 2 });

        selection = A1Selection::test("A1:C3");
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
}
