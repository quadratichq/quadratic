use super::*;

impl RefRangeBounds {
    /// Returns whether `self` might intersect `rect`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub(crate) fn might_intersect_rect(self, rect: Rect) -> bool {
        range_might_intersect(rect.x_range(), self.start.col, self.end.col)
            && range_might_intersect(rect.y_range(), self.start.row, self.end.row)
    }

    /// Returns whether `self` might contain `pos`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub(crate) fn might_contain_pos(self, pos: Pos) -> bool {
        self.might_intersect_rect(Rect::single_pos(pos))
    }

    /// Returns whether `self` contains `pos` regardless of data bounds.
    pub(crate) fn contains_pos(self, pos: Pos) -> bool {
        if pos.x < self.start.col() || pos.x > self.end.col() {
            return false;
        }

        pos.y >= self.start.row() && pos.y <= self.end.row()
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
