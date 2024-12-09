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
}
