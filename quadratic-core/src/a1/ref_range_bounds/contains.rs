use super::*;

impl RefRangeBounds {
    /// Returns whether `self` might intersect `rect`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub fn might_intersect_rect(self, rect: Rect) -> bool {
        range_might_intersect(rect.x_range(), self.start.col, self.end.col)
            && range_might_intersect(rect.y_range(), self.start.row, self.end.row)
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
        self.start.col() <= end && self.end.col() >= start
    }

    /// Returns whether `self` might include the rows in the range
    /// `start..=end`. Infinite ranges are allowed and return true.
    pub fn might_contain_rows(&self, start: i64, end: i64) -> bool {
        self.start.row() <= end && self.end.row() >= start
    }

    /// Returns whether `self` contains `pos` regardless of data bounds.
    /// Works for both normalized (A1:B10) and denormalized (B1:A10) ranges.
    pub fn contains_pos(self, pos: Pos) -> bool {
        let min_col = self.start.col().min(self.end.col());
        let max_col = self.start.col().max(self.end.col());
        let min_row = self.start.row().min(self.end.row());
        let max_row = self.start.row().max(self.end.row());

        (pos.x >= min_col && pos.x <= max_col) && (pos.y >= min_row && pos.y <= max_row)
    }
}

#[cfg(test)]
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

        // Denormalized range B1:A10 is the same as A1:B10
        assert!(RefRangeBounds::test_a1("B1:A10").contains_pos(Pos::new(1, 1)));
        assert!(RefRangeBounds::test_a1("B1:A10").contains_pos(Pos::new(2, 10)));
        assert!(RefRangeBounds::test_a1("B1:A10").contains_pos(Pos::new(1, 5)));
        assert!(!RefRangeBounds::test_a1("B1:A10").contains_pos(Pos::new(3, 5)));
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
