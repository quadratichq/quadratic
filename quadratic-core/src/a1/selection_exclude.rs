//! Handles the logic for removing cells from a selection.

use crate::{Pos, Rect};

use super::{A1Selection, CellRefRange, CellRefRangeEnd, RefRangeBounds};

impl A1Selection {
    /// Finds the remaining rectangles after excluding the given rectangle from a rectangle.
    fn find_excluded_rects(range: Rect, exclude: Rect) -> Vec<CellRefRange> {
        let mut ranges = Vec::new();

        // Top rectangle
        let mut top: Option<u64> = None;
        if range.min.y < exclude.min.y {
            top = Some(exclude.min.y as u64);
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd::new_relative_pos(range.min),
                end: Some(CellRefRangeEnd::new_relative_xy(
                    range.max.x as u64,
                    exclude.min.y as u64 - 1,
                )),
            });
        }

        // Bottom rectangle
        let mut bottom: Option<u64> = None;
        if range.max.y > exclude.max.y {
            bottom = Some(exclude.max.y as u64);
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(
                    range.min.x as u64,
                    exclude.max.y as u64 + 1,
                ),
                end: Some(CellRefRangeEnd::new_relative_pos(range.max)),
            });
        }

        // Left rectangle
        if range.min.x < exclude.min.x {
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(
                    range.min.x as u64,
                    top.unwrap_or(exclude.min.y as u64),
                ),
                end: Some(CellRefRangeEnd::new_relative_xy(
                    exclude.min.x as u64 - 1,
                    bottom.unwrap_or(range.max.y as u64),
                )),
            });
        }

        // Right rectangle
        if range.max.x > exclude.max.x {
            ranges.push(RefRangeBounds {
                start: CellRefRangeEnd::new_relative_xy(
                    exclude.max.x as u64 + 1,
                    top.unwrap_or(range.min.y as u64),
                ),
                end: Some(CellRefRangeEnd::new_relative_xy(
                    range.max.x as u64,
                    bottom.unwrap_or(range.max.y as u64),
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

        match range {
            CellRefRange::Sheet { range } => {
                if let (Some(start_col), Some(start_row)) = (range.start.col, range.start.row) {
                    if let (Some(end_col), Some(end_row)) = (
                        range.end.as_ref().and_then(|end| end.col),
                        range.end.as_ref().and_then(|end| end.row),
                    ) {
                        let range_rect = Rect {
                            min: Pos::new(start_col.coord as i64, start_row.coord as i64),
                            max: Pos::new(end_col.coord as i64, end_row.coord as i64),
                        };
                        let exclude_rect = Rect { min: p1, max: p2 };
                        ranges.extend(A1Selection::find_excluded_rects(range_rect, exclude_rect));
                    }
                }
            }
        }

        ranges
    }

    /// Excludes the given cells from the selection.
    pub fn exclude_cells(&mut self, p1: Pos, p2: Option<Pos>) {
        let mut ranges = Vec::new();
        while let Some(range) = self.ranges.drain(..).next_back() {
            // skip range if it's the entire range or the reverse of the entire range
            if !range.is_pos_range(p1, p2) && p2.is_some_and(|p2| !range.is_pos_range(p2, Some(p1)))
            {
                if let Some(p2) = p2 {
                    if range.might_intersect_rect(Rect { min: p1, max: p2 }) {
                        ranges.extend(A1Selection::remove_rect(range, p1, p2));
                    }
                } else if range.might_contain_pos(p1) {
                    ranges.extend(A1Selection::remove_rect(range, p1, p1));
                } else {
                    ranges.push(range);
                }
            }
        }
        self.ranges = ranges;
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod test {
    use crate::CellRefRange;

    use super::*;

    #[test]
    fn test_find_excluded_rects_exclude_inside_rect() {
        let rects = A1Selection::find_excluded_rects(Rect::new(1, 1, 6, 6), Rect::new(2, 2, 4, 4));
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
        let rects = A1Selection::find_excluded_rects(Rect::new(2, 2, 6, 6), Rect::new(1, 1, 3, 8));
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
        let rects = A1Selection::find_excluded_rects(Rect::new(1, 1, 6, 6), Rect::new(5, 1, 8, 8));
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
        let rects =
            A1Selection::find_excluded_rects(Rect::new(1, 1, 6, 6), Rect::new(1, 3, 10, 10));
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
        let rects = A1Selection::find_excluded_rects(Rect::new(1, 1, 6, 6), Rect::new(1, 1, 10, 3));
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
    fn test_exclude_cells() {
        let mut selection = A1Selection::test("A1,B2:C3");
        selection.exclude_cells(Pos { x: 2, y: 2 }, Some(Pos { x: 3, y: 3 }));
        assert_eq!(selection.ranges, vec![CellRefRange::test("A1")]);

        selection = A1Selection::test("B2:C3");
        selection.exclude_cells(Pos { x: 2, y: 2 }, Some(Pos { x: 3, y: 3 }));
        assert_eq!(selection.cursor, Pos { x: 2, y: 2 });

        selection = A1Selection::test("A1:C3");
        selection.exclude_cells("B2".into(), None);
        assert_eq!(
            selection.ranges,
            vec![CellRefRange::test("A1"), CellRefRange::test("C3")]
        );
    }
}
