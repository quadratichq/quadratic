use crate::CellRefCoord;

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
            Some((left, right)) => Ok(RefRangeBounds {
                start: CellRefRangeEnd::parse_start(left)?,
                end: CellRefRangeEnd::parse_end(right)?,
            }),
            None => Ok(RefRangeBounds {
                start: CellRefRangeEnd::parse_start(s)?,
                end: CellRefRangeEnd::parse_end(s)?,
            }),
        }
    }
}

impl RefRangeBounds {
    pub fn new_relative_all_from(pos: Pos) -> Self {
        let start = CellRefRangeEnd::new_relative_pos(pos);
        RefRangeBounds {
            start,
            end: CellRefRangeEnd::UNBOUNDED,
        }
    }

    pub fn new_relative_xy(x: i64, y: i64) -> Self {
        let start = CellRefRangeEnd::new_relative_xy(x, y);
        RefRangeBounds { start, end: start }
    }

    pub fn new_relative_pos(pos: Pos) -> Self {
        Self::new_relative_xy(pos.x, pos.y)
    }

    pub fn new_relative_col(x: i64) -> Self {
        Self {
            start: CellRefRangeEnd {
                col: CellRefCoord::new_rel(x),
                row: CellRefCoord::START,
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::new_rel(x),
                row: CellRefCoord::UNBOUNDED,
            },
        }
    }

    pub fn new_relative_row(y: i64) -> Self {
        Self {
            start: CellRefRangeEnd {
                col: CellRefCoord::START,
                row: CellRefCoord::new_rel(y),
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::UNBOUNDED,
                row: CellRefCoord::new_rel(y),
            },
        }
    }

    pub fn new_relative_column_range(x1: i64, x2: i64) -> Self {
        if x1 == x2 {
            return Self::new_relative_col(x1);
        }
        Self {
            start: CellRefRangeEnd {
                col: CellRefCoord::new_rel(x1),
                row: CellRefCoord::START,
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::new_rel(x2),
                row: CellRefCoord::UNBOUNDED,
            },
        }
    }

    pub fn new_relative_row_range(y1: i64, y2: i64) -> Self {
        if y1 == y2 {
            return Self::new_relative_row(y1);
        }
        Self {
            start: CellRefRangeEnd {
                col: CellRefCoord::START,
                row: CellRefCoord::new_rel(y1),
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::UNBOUNDED,
                row: CellRefCoord::new_rel(y2),
            },
        }
    }

    // Creates a range from a rectangle. Be careful as this will normalize the
    // CellRefRange, which is not always what the user wants.
    pub fn new_relative_rect(rect: Rect) -> Self {
        if rect.min == rect.max {
            Self::new_relative_pos(rect.min)
        } else {
            Self {
                start: CellRefRangeEnd::new_relative_pos(rect.min),
                end: CellRefRangeEnd::new_relative_pos(rect.max),
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
        assert_eq!(range.to_string(), "2:");
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
    fn test_new_relative_col() {
        let range = RefRangeBounds::new_relative_col(4);
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
}