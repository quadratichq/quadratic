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

        // if let Some(self.start_col)
        // // Get the bounds for both ranges
        // let (self_start_col, self_start_row, self_end_col, self_end_row) =
        //     self.to_contiguous2d_coords();
        // let (other_start_col, other_start_row, other_end_col, other_end_row) =
        //     other.to_contiguous2d_coords();

        // // Calculate intersection bounds using min/max to handle reverse ranges
        // let min_col = self_start_col
        //     .min(self_end_col.unwrap_or(self_start_col))
        //     .max(other_start_col.min(other_end_col.unwrap_or(other_start_col)));
        // let max_col = self_start_col
        //     .max(self_end_col.unwrap_or(self_start_col))
        //     .min(other_start_col.max(other_end_col.unwrap_or(other_start_col)));

        // let min_row = self_start_row
        //     .min(self_end_row.unwrap_or(self_start_row))
        //     .max(other_start_row.min(other_end_row.unwrap_or(other_start_row)));
        // let max_row = self_start_row
        //     .max(self_end_row.unwrap_or(self_start_row))
        //     .min(other_start_row.max(other_end_row.unwrap_or(other_start_row)));

        // // Check if there is no intersection
        // if max_col < min_col || max_row < min_row {
        //     return None;
        // }

        // // Create the intersection range
        // let start = if self.start.row.is_none() && other.start.row.is_none() {
        //     CellRefRangeEnd::new_relative_column(min_col)
        // } else if self.start.col.is_none() && other.start.col.is_none() {
        //     CellRefRangeEnd::new_relative_row(min_row)
        // } else {
        //     CellRefRangeEnd::new_relative_xy(min_col, min_row)
        // };

        // let end = if max_col.is_some() || max_row.is_some() {
        //     Some(CellRefRangeEnd::new_relative_xy(
        //         max_col.unwrap_or(min_col),
        //         end_row.unwrap_or(start_row),
        //     ))
        // } else {
        //     None
        // };

        // Some(RefRangeBounds { start, end })
        None
    }

    fn is_reversed_cols(&self) -> bool {
        if let Some(end) = self.end {
            self.start.col.is_some_and(|start_col| {
                end.col
                    .is_some_and(|end_col| start_col.coord > end_col.coord)
            })
        } else {
            false
        }
    }

    fn is_reversed_rows(&self) -> bool {
        if let Some(end) = self.end {
            self.start.row.is_some_and(|start_row| {
                end.row
                    .is_some_and(|end_row| start_row.coord > end_row.coord)
            })
        } else {
            false
        }
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
    fn test_intersection() {
        // Test single cell intersections
        assert_eq!(
            RefRangeBounds::test_a1("A1").intersection(&RefRangeBounds::test_a1("A1:B2")),
            Some(RefRangeBounds::test_a1("A1"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("C3").intersection(&RefRangeBounds::test_a1("A1:B2")),
            None
        );

        // Test range intersections
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").intersection(&RefRangeBounds::test_a1("B2:D4")),
            Some(RefRangeBounds::test_a1("B2:C3"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").intersection(&RefRangeBounds::test_a1("C3:D4")),
            None
        );

        // Test column range intersections
        assert_eq!(
            RefRangeBounds::test_a1("A:C").intersection(&RefRangeBounds::test_a1("B:D")),
            Some(RefRangeBounds::test_a1("B:C"))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:B").intersection(&RefRangeBounds::test_a1("C:D")),
            None
        );

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
