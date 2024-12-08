use super::*;

impl FromStr for RefRangeBounds {
    type Err = A1Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s.is_empty() {
            return Err(A1Error::InvalidRange(s.to_string()));
        }

        if s == "*" {
            return Ok(Self::ALL);
        }

        match s.split_once(':') {
            Some((left, right)) => {
                let start = left.parse::<CellRefRangeEnd>()?;
                let end = right.parse::<CellRefRangeEnd>()?;

                if start == end {
                    Ok(RefRangeBounds { start, end: None })
                } else {
                    Ok(RefRangeBounds {
                        start: left.parse()?,
                        end: Some(right.parse()?),
                    })
                }
            }
            None => Ok(RefRangeBounds {
                start: s.parse()?,
                end: None,
            }),
        }
    }
}

impl RefRangeBounds {
    pub fn new_relative_all_from(pos: Pos) -> Self {
        let start = CellRefRangeEnd::new_relative_pos(pos);
        RefRangeBounds {
            start,
            end: Some(CellRefRangeEnd::UNBOUNDED),
        }
    }

    pub fn new_relative_xy(x: i64, y: i64) -> Self {
        let start = CellRefRangeEnd::new_relative_xy(x, y);
        RefRangeBounds { start, end: None }
    }

    pub fn new_relative_pos(pos: Pos) -> Self {
        Self::new_relative_xy(pos.x, pos.y)
    }

    pub fn new_relative_column(x: i64) -> Self {
        let start = CellRefRangeEnd::new_relative_column(x);
        Self { start, end: None }
    }

    pub fn new_relative_row(y: i64) -> Self {
        let start = CellRefRangeEnd::new_relative_row(y);
        Self { start, end: None }
    }

    pub fn new_relative_column_range(x1: i64, x2: i64) -> Self {
        if x1 == x2 {
            return Self::new_relative_column(x1);
        }
        Self {
            start: CellRefRangeEnd::new_relative_column(x1),
            end: Some(CellRefRangeEnd::new_relative_column(x2)),
        }
    }

    pub fn new_relative_row_range(y1: i64, y2: i64) -> Self {
        if y1 == y2 {
            return Self::new_relative_row(y1);
        }
        Self {
            start: CellRefRangeEnd::new_relative_row(y1),
            end: Some(CellRefRangeEnd::new_relative_row(y2)),
        }
    }

    // Creates a range from a rectangle. Be careful as this will normalize the
    // CellRefRange, which is not always what the user wants.
    pub fn new_relative_rect(rect: Rect) -> Self {
        Self {
            start: CellRefRangeEnd::new_relative_pos(rect.min),
            end: Some(CellRefRangeEnd::new_relative_pos(rect.max)),
        }
    }

    /// Normalizes the range bounds so that the start is less than the end.
    ///
    /// Note: It may not maintain the is_absolute flag as values may be swapped.
    pub fn normalize(&mut self) {
        // nothing to do if there is no end
        if self.end.is_none() {
            return;
        }

        let start_col = self.start.col.map(|col| col.coord);
        let end_col = self
            .end
            .as_ref()
            .and_then(|end| end.col.map(|col| col.coord));
        let start_row = self.start.row.map(|row| row.coord);
        let end_row = self
            .end
            .as_ref()
            .and_then(|end| end.row.map(|row| row.coord));

        // we cannot swap if there is an unbalance in start and end
        let start_count = start_col.is_some() as i64 + start_row.is_some() as i64;
        let end_count = end_col.is_some() as i64 + end_row.is_some() as i64;
        if start_count < end_count {
            std::mem::swap(&mut self.start, &mut self.end.as_mut().unwrap());
            return;
        } else if start_count != end_count {
            return;
        }

        if let (Some(start_col), Some(end_col)) = (start_col, end_col) {
            if start_col > end_col {
                std::mem::swap(&mut self.start.col, &mut self.end.as_mut().unwrap().col);
            }
        }
        if let (Some(start_row), Some(end_row)) = (start_row, end_row) {
            if start_row > end_row {
                std::mem::swap(&mut self.start.row, &mut self.end.as_mut().unwrap().row);
            }
        }
    }

    /// Returns a test range from the A1-string.
    #[cfg(test)]
    pub fn test_a1(a1: &str) -> Self {
        Self::from_str(a1).unwrap()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_new_relative_all_from() {
        let range = RefRangeBounds::new_relative_all_from(Pos { x: 1, y: 2 });
        assert_eq!(range.to_string(), "A2:");
    }

    #[test]
    fn test_new_relative_xy() {
        let range = RefRangeBounds::new_relative_xy(2, 3);
        assert_eq!(range.to_string(), "B3");
    }

    #[test]
    fn test_new_relative_pos() {
        let range = RefRangeBounds::new_relative_pos(Pos { x: 3, y: 4 });
        assert_eq!(range.to_string(), "C4");
    }

    #[test]
    fn test_new_relative_column() {
        let range = RefRangeBounds::new_relative_column(4);
        assert_eq!(range.to_string(), "D");
    }

    #[test]
    fn test_new_relative_row() {
        let range = RefRangeBounds::new_relative_row(5);
        assert_eq!(range.to_string(), "5");
    }

    #[test]
    fn test_new_relative_column_range() {
        let range = RefRangeBounds::new_relative_column_range(1, 3);
        assert_eq!(range.to_string(), "A:C");

        // Test same column case
        let range = RefRangeBounds::new_relative_column_range(2, 4);
        assert_eq!(range.to_string(), "B:D");
    }

    #[test]
    fn test_new_relative_row_range() {
        let range = RefRangeBounds::new_relative_row_range(1, 4);
        assert_eq!(range.to_string(), "1:4");

        // Test same row case
        let range = RefRangeBounds::new_relative_row_range(3, 3);
        assert_eq!(range.to_string(), "3");
    }

    #[test]
    fn test_new_relative_rect() {
        let rect = Rect::new(1, 2, 3, 4);
        let range = RefRangeBounds::new_relative_rect(rect);
        assert_eq!(range.to_string(), "A2:C4");
    }

    #[test]
    fn test_normalize() {
        let mut range = RefRangeBounds::test_a1("C:A");
        range.normalize();
        assert_eq!(range.to_string(), "A:C");

        let mut range = RefRangeBounds::test_a1("3:1");
        range.normalize();
        assert_eq!(range.to_string(), "1:3");

        let mut range = RefRangeBounds::test_a1("Z1:A10");
        range.normalize();
        assert_eq!(range.to_string(), "A1:Z10");

        let mut range = RefRangeBounds::test_a1("A10:Z1");
        range.normalize();
        assert_eq!(range.to_string(), "A1:Z10");

        let mut range = RefRangeBounds::test_a1("C:B13");
        range.normalize();
        assert_eq!(range.to_string(), "B13:C");

        let mut range = RefRangeBounds::test_a1("3:B13");
        range.normalize();
        assert_eq!(range.to_string(), "B13:3");
    }
}
