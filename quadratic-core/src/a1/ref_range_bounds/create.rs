use crate::a1::CellRefCoord;

use super::*;

impl RefRangeBounds {
    /// Parses A1 or RC notation.
    ///
    /// If `base_pos` is `None`, then only A1 notation is accepted. If it is
    /// `Some`, then A1 and RC notation are both accepted.
    pub fn from_str(s: &str, base_pos: Option<Pos>) -> Result<Self, A1Error> {
        if s.is_empty() {
            return Err(A1Error::InvalidRange(s.to_string()));
        }

        if s == "*" {
            return Ok(Self::ALL);
        }

        match s.split_once(':') {
            Some((left, right)) => Ok(RefRangeBounds {
                start: CellRefRangeEnd::parse_start(left, base_pos)?,
                end: CellRefRangeEnd::parse_end(right, base_pos)?,
            }),
            None => Ok(RefRangeBounds {
                start: CellRefRangeEnd::parse_start(s, base_pos)?,
                end: CellRefRangeEnd::parse_end(s, base_pos)?,
            }),
        }
    }

    pub(crate) fn new_relative_xy(x: i64, y: i64) -> Self {
        let start = CellRefRangeEnd::new_relative_xy(x, y);
        RefRangeBounds { start, end: start }
    }

    pub(crate) fn new_relative_pos(pos: Pos) -> Self {
        Self::new_relative_xy(pos.x, pos.y)
    }

    pub(crate) fn new_relative_col(x: i64) -> Self {
        Self {
            start: CellRefRangeEnd {
                col: CellRefCoord::new_rel(x),
                row: CellRefCoord::REL_START,
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::new_rel(x),
                row: CellRefCoord::REL_UNBOUNDED,
            },
        }
    }

    pub(crate) fn new_relative_row(y: i64) -> Self {
        Self {
            start: CellRefRangeEnd {
                col: CellRefCoord::REL_START,
                row: CellRefCoord::new_rel(y),
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::REL_UNBOUNDED,
                row: CellRefCoord::new_rel(y),
            },
        }
    }

    pub(crate) fn new_relative_column_range(x1: i64, x2: i64) -> Self {
        if x1 == x2 {
            return Self::new_relative_col(x1);
        }
        Self {
            start: CellRefRangeEnd {
                col: CellRefCoord::new_rel(x1),
                row: CellRefCoord::REL_START,
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::new_rel(x2),
                row: CellRefCoord::REL_UNBOUNDED,
            },
        }
    }

    pub(crate) fn new_relative_row_range(y1: i64, y2: i64) -> Self {
        if y1 == y2 {
            return Self::new_relative_row(y1);
        }
        Self {
            start: CellRefRangeEnd {
                col: CellRefCoord::REL_START,
                row: CellRefCoord::new_rel(y1),
            },
            end: CellRefRangeEnd {
                col: CellRefCoord::REL_UNBOUNDED,
                row: CellRefCoord::new_rel(y2),
            },
        }
    }

    // Creates a range from a rectangle. Be careful as this will normalize the
    // CellRefRange, which is not always what the user wants.
    pub(crate) fn new_relative_rect(rect: Rect) -> Self {
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
    pub(crate) fn test_a1(a1: &str) -> Self {
        Self::from_str(a1, None).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        assert_eq!(range.to_string(), "5:5");
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
        assert_eq!(range.to_string(), "3:3");
    }

    #[test]
    fn test_new_relative_rect() {
        let rect = Rect::new(1, 2, 3, 4);
        let range = RefRangeBounds::new_relative_rect(rect);
        assert_eq!(range.to_string(), "A2:C4");
    }
}
