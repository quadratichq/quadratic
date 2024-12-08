use super::*;

impl RefRangeBounds {
    /// Returns whether `self` might intersect `rect`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub fn might_intersect_rect(self, rect: Rect) -> bool {
        let start = self.start;
        match self.end {
            Some(end) => {
                range_might_intersect(rect.x_range(), start.col, end.col)
                    && range_might_intersect(rect.y_range(), start.row, end.row)
            }
            None => {
                range_might_contain_coord(rect.x_range(), start.col)
                    && range_might_contain_coord(rect.y_range(), start.row)
            }
        }
    }

    /// Returns whether `self` might contain `pos`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub fn might_contain_pos(self, pos: Pos) -> bool {
        self.might_intersect_rect(Rect::single_pos(pos))
    }

    /// Returns whether `self` might include the columns in the range
    /// `start..=end`. Infinite ranges are allowed and return true.
    pub fn might_contain_cols(&self, start: i64, end: i64) -> bool {
        // If the start is past the end, it can't include any columns
        if self
            .start
            .col
            .is_some_and(|start_col| start_col.coord > end)
        {
            return false;
        }
        // If the self.end is before the start, then it includes the range
        if let Some(end_range) = self.end {
            end_range.col.map_or(true, |end_col| end_col.coord >= start)
        } else {
            true
        }
    }

    /// Returns whether `self` might include the rows in the range
    /// `start..=end`. Infinite ranges are allowed and return true.
    pub fn might_contain_rows(&self, start: i64, end: i64) -> bool {
        if self
            .start
            .row
            .is_some_and(|start_row| start_row.coord > end)
        {
            return false;
        }
        if let Some(end_range) = self.end {
            end_range.row.map_or(true, |end_row| end_row.coord >= start)
        } else {
            true
        }
    }

    /// Returns whether `self` contains `pos` regardless of data bounds.
    pub fn contains_pos(self, pos: Pos) -> bool {
        let start = self.start;
        match self.end {
            Some(end) => {
                // For columns: if col is None, it matches any x coordinate
                let x_in_range = match (start.col, end.col) {
                    (None, None) => true,
                    (Some(start_col), None) => pos.x >= start_col.coord,
                    (None, Some(end_col)) => pos.x <= end_col.coord,
                    (Some(start_col), Some(end_col)) => {
                        let min = start_col.coord.min(end_col.coord);
                        let max = start_col.coord.max(end_col.coord);
                        pos.x >= min && pos.x <= max
                    }
                };

                // For rows: if row is None, it matches any y coordinate
                let y_in_range = match (start.row, end.row) {
                    (None, None) => true,
                    (Some(start_row), None) => pos.y >= start_row.coord,
                    (None, Some(end_row)) => pos.y <= end_row.coord,
                    (Some(start_row), Some(end_row)) => {
                        let min = start_row.coord.min(end_row.coord);
                        let max = start_row.coord.max(end_row.coord);
                        pos.y >= min && pos.y <= max
                    }
                };

                x_in_range && y_in_range
            }
            None => {
                // Without an end range, both coordinates must match if specified
                let x_matches = start.col.map_or(true, |col| pos.x == col.coord);
                let y_matches = start.row.map_or(true, |row| pos.y == row.coord);
                x_matches && y_matches
            }
        }
    }

    /// Find intersection between two CellRefRanges.
    pub fn intersection(&self, other: &RefRangeBounds) -> Option<Self> {
        // If either range is empty/invalid, no intersection
        if !self.is_valid() || !other.is_valid() {
            return None;
        }

        // Handle single cell cases first
        if self.is_single_cell() {
            return if other.contains_pos(self.try_to_pos().unwrap()) {
                Some(*self)
            } else {
                None
            };
        }
        if other.is_single_cell() {
            return if self.contains_pos(other.try_to_pos().unwrap()) {
                Some(*other)
            } else {
                None
            };
        }

        // normalize the ranges to make the logic easier
        let mut range = self.clone();
        range.normalize();
        let mut other = other.clone();
        other.normalize();

        // compare full rects and get the intersection
        let range_rect = range.to_rect();
        let other_rect = other.to_rect();
        if let (Some(range_rect), Some(other_rect)) = (range_rect, other_rect) {
            if let Some(intersection) = range_rect.intersection(&other_rect) {
                return Some(RefRangeBounds::new_relative_rect(intersection));
            } else {
                return None;
            }
        }

        // Compare a rect against a column(s) and row(s) since we already
        // covered rects and single pos
        if let Some(range_rect) = range_rect {
            if let Some(_other_end) = other.end {
                todo!()
            } else {
                if let Some(other_col) = other.start.col.map(|c| c.coord) {
                    if range_rect.min.x >= other_col && range_rect.max.x <= other_col {
                        return Some(RefRangeBounds::new_relative_rect(Rect::new(
                            other_col,
                            range_rect.min.y,
                            other_col,
                            range_rect.max.y,
                        )));
                    } else {
                        return None;
                    }
                }
                // compare row range
                else if let Some(other_row) = other.start.row.map(|r| r.coord) {
                    if range_rect.min.y >= other_row && range_rect.max.y <= other_row {
                        return Some(RefRangeBounds::new_relative_rect(Rect::new(
                            range_rect.min.x,
                            other_row,
                            range_rect.max.x,
                            other_row,
                        )));
                    } else {
                        return None;
                    }
                }
            }
        }

        // handle column(s) intersecting column(s)
        if range.is_column_range() && other.is_column_range() {
            if let Some(range_end) = range.end {
                if let Some(other_end) = other.end {
                    // Both ranges have end points - find overlap
                    let range_start = range.start.col.unwrap().coord;
                    let range_end = range_end.col.unwrap().coord;
                    let other_start = other.start.col.unwrap().coord;
                    let other_end = other_end.col.unwrap().coord;

                    let min = range_start.max(other_start);
                    let max = range_end.min(other_end);

                    if min <= max {
                        return Some(RefRangeBounds::new_relative_rect(Rect::new(min, 1, max, 1)));
                    }
                } else {
                    // Other is single column
                    let range_start = range.start.col.unwrap().coord;
                    let range_end = range_end.col.unwrap().coord;
                    let other_col = other.start.col.unwrap().coord;

                    if other_col >= range_start && other_col <= range_end {
                        return Some(RefRangeBounds::new_relative_rect(Rect::new(
                            other_col, 1, other_col, 1,
                        )));
                    }
                }
            } else if let Some(other_end) = other.end {
                // Range is single column
                let range_col = range.start.col.unwrap().coord;
                let other_start = other.start.col.unwrap().coord;
                let other_end = other_end.col.unwrap().coord;

                if range_col >= other_start && range_col <= other_end {
                    return Some(RefRangeBounds::new_relative_rect(Rect::new(
                        range_col, 1, range_col, 1,
                    )));
                }
            }
            // Both are single columns
            else {
                let range_col = range.start.col.unwrap().coord;
                let other_col = other.start.col.unwrap().coord;

                if range_col == other_col {
                    return Some(RefRangeBounds::new_relative_column(range_col));
                } else {
                    return None;
                }
            }
        }

        // handle columns intersecting rows
        if range.is_column_range() && other.is_row_range() {}

        None
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_contains_pos() {
        assert!(RefRangeBounds::test_a1("A1").contains_pos(Pos::new(1, 1)));
        assert!(!RefRangeBounds::test_a1("A1").contains_pos(Pos::new(2, 1)));
        assert!(RefRangeBounds::test_a1("A1:B2").contains_pos(Pos::new(1, 1)));
        assert!(RefRangeBounds::test_a1("A1:B2").contains_pos(Pos::new(2, 2)));
        assert!(!RefRangeBounds::test_a1("A1:B2").contains_pos(Pos::new(3, 3)));

        assert!(RefRangeBounds::test_a1("A").contains_pos(Pos::new(1, 1)));
        assert!(RefRangeBounds::test_a1("A").contains_pos(Pos::new(1, 5)));
        assert!(!RefRangeBounds::test_a1("A").contains_pos(Pos::new(2, 1)));

        assert!(RefRangeBounds::test_a1("1").contains_pos(Pos::new(1, 1)));
        assert!(RefRangeBounds::test_a1("1").contains_pos(Pos::new(5, 1)));
        assert!(!RefRangeBounds::test_a1("1").contains_pos(Pos::new(1, 2)));

        assert!(RefRangeBounds::test_a1("*").contains_pos(Pos::new(10, 145)));

        assert!(RefRangeBounds::test_a1("A1:D10").contains_pos(Pos::new(3, 3)));
        assert!(!RefRangeBounds::test_a1("A1:D10").contains_pos(Pos::new(11, 1)));

        assert!(RefRangeBounds::test_a1("B7:G7").contains_pos(Pos::new(2, 7)));
    }

    #[test]
    fn test_might_contain_cols() {
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_cols(1, 2));
        assert!(!RefRangeBounds::test_a1("A1:B2").might_contain_cols(3, 4));
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_cols(1, 10));
        assert!(RefRangeBounds::test_a1("*").might_contain_cols(1, 10));
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_cols(1, 1));
    }

    #[test]
    fn test_might_contain_rows() {
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_rows(1, 2));
        assert!(!RefRangeBounds::test_a1("A1:B2").might_contain_rows(3, 4));
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_rows(1, 10));
        assert!(RefRangeBounds::test_a1("*").might_contain_rows(1, 10));
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_rows(1, 1));
    }

    #[test]
    fn test_might_intersect_rect() {
        assert!(RefRangeBounds::test_a1("A1:B2").might_intersect_rect(Rect::new(1, 1, 2, 2)));
        assert!(RefRangeBounds::test_a1("A1:B2").might_intersect_rect(Rect::new(1, 1, 2, 2)));
        assert!(!RefRangeBounds::test_a1("A1:B2").might_intersect_rect(Rect::new(3, 3, 4, 4)));
        assert!(RefRangeBounds::test_a1("A").might_intersect_rect(Rect::new(1, 1, 1, 10)));
        assert!(RefRangeBounds::test_a1("*").might_intersect_rect(Rect::new(1, 1, 10, 10)));
    }

    #[test]
    fn test_might_contain_pos() {
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_pos(Pos::new(1, 1)));
        assert!(!RefRangeBounds::test_a1("A1:B2").might_contain_pos(Pos::new(3, 3)));
        assert!(RefRangeBounds::test_a1("A").might_contain_pos(Pos::new(1, 5)));
        assert!(RefRangeBounds::test_a1("*").might_contain_pos(Pos::new(10, 10)));
    }

    #[test]
    fn test_intersection_pos_pos() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").intersection(&RefRangeBounds::test_a1("A1")),
            Some(RefRangeBounds::test_a1("A1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1").intersection(&RefRangeBounds::test_a1("B1")),
            None
        );
    }

    #[test]
    fn test_intersection_pos_rect() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").intersection(&RefRangeBounds::test_a1("A1:B2")),
            Some(RefRangeBounds::test_a1("A1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").intersection(&RefRangeBounds::test_a1("A1")),
            Some(RefRangeBounds::test_a1("A1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("C1").intersection(&RefRangeBounds::test_a1("A1:B2")),
            None
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").intersection(&RefRangeBounds::test_a1("C1")),
            None
        );
    }

    #[test]
    fn test_intersection_rect_rect() {
        // Test range intersections
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("B2:D4")),
            Some(RefRangeBounds::test_a1("B2:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").intersection(&RefRangeBounds::test_a1("C3:D4")),
            None
        );
    }

    #[test]
    fn test_intersection_col_col() {
        assert_eq!(
            RefRangeBounds::test_a1("A").intersection(&RefRangeBounds::test_a1("A")),
            Some(RefRangeBounds::test_a1("A"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:C").intersection(&RefRangeBounds::test_a1("B:D")),
            Some(RefRangeBounds::test_a1("B:C"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:C").intersection(&RefRangeBounds::test_a1("C:D")),
            Some(RefRangeBounds::test_a1("C"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:B").intersection(&RefRangeBounds::test_a1("C:D")),
            None
        );
    }

    #[test]
    fn test_intersection() {
        // Test row range intersections
        assert_eq!(
            RefRangeBounds::test_a1("1:3").intersection(&RefRangeBounds::test_a1("2:4")),
            Some(RefRangeBounds::test_a1("2:3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:2").intersection(&RefRangeBounds::test_a1("3:4")),
            None
        );

        // Test mixed range intersections
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("B:D")),
            Some(RefRangeBounds::test_a1("B1:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("2:4")),
            Some(RefRangeBounds::test_a1("A2:C3"))
        );

        // Test with unbounded ranges
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("*")),
            Some(RefRangeBounds::test_a1("A1:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").intersection(&RefRangeBounds::test_a1("B2:D4")),
            Some(RefRangeBounds::test_a1("B2:D4"))
        );
    }

    #[test]
    fn test_intersection_edge_cases() {
        let end_before_start = RefRangeBounds::test_a1("B2:A1");
        assert_eq!(
            end_before_start.intersection(&RefRangeBounds::test_a1("A1:C3")),
            Some(RefRangeBounds::test_a1("B2:A1"))
        );

        // Test intersection with empty ranges
        assert_eq!(
            RefRangeBounds::test_a1("A").intersection(&RefRangeBounds::test_a1("1")),
            Some(RefRangeBounds::test_a1("A1"))
        );

        // Test intersection with infinite ranges in different directions
        assert_eq!(
            RefRangeBounds::test_a1("A:C").intersection(&RefRangeBounds::test_a1("1:3")),
            Some(RefRangeBounds::test_a1("A1:C3"))
        );
    }
}
