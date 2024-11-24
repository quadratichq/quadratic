use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use ts_rs::TS;
use wasm_bindgen::prelude::*;

use super::{range_might_contain_coord, range_might_intersect, A1Error, CellRefRangeEnd};
use crate::{Pos, Rect};

#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(test, proptest(filter = "|range| range.is_valid()"))]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct CellRefRange {
    pub start: CellRefRangeEnd,
    pub end: Option<CellRefRangeEnd>,
}
impl fmt::Debug for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "CellRefRange(")?;
        fmt::Display::fmt(self, f)?;
        write!(f, ")")?;
        Ok(())
    }
}
impl fmt::Display for CellRefRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if *self == Self::ALL {
            write!(f, "*")?;
        } else {
            write!(f, "{}", self.start)?;
            if let Some(end) = self.end {
                // we don't need to print the end range if start == end
                if end != self.start {
                    write!(f, ":{end}")?;
                }
            }
        }
        Ok(())
    }
}
impl FromStr for CellRefRange {
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
                    Ok(CellRefRange { start, end: None })
                } else {
                    Ok(CellRefRange {
                        start: left.parse()?,
                        end: Some(right.parse()?),
                    })
                }
            }
            None => Ok(CellRefRange {
                start: s.parse()?,
                end: None,
            }),
        }
    }
}
impl CellRefRange {
    /// Range that contains the entire sheet.
    pub const ALL: Self = Self {
        start: CellRefRangeEnd::UNBOUNDED,
        end: Some(CellRefRangeEnd::UNBOUNDED),
    };

    /// Returns whether the range is **valid**.
    ///
    /// A range is valid iff it can be represented using a nonempty string.
    pub fn is_valid(self) -> bool {
        self.start.col.is_some() || self.start.row.is_some() || self.end.is_some()
    }

    pub fn new_relative_xy(x: u64, y: u64) -> Self {
        let start = CellRefRangeEnd::new_relative_xy(x, y);
        CellRefRange { start, end: None }
    }

    pub fn new_relative_pos(pos: Pos) -> Self {
        Self::new_relative_xy(pos.x as u64, pos.y as u64)
    }

    pub fn new_relative_column(x: u64) -> Self {
        let start = CellRefRangeEnd::new_relative_column(x);
        Self { start, end: None }
    }

    pub fn new_relative_row(y: u64) -> Self {
        let start = CellRefRangeEnd::new_relative_row(y);
        Self { start, end: None }
    }

    pub fn new_relative_column_range(x1: u64, x2: u64) -> Self {
        if x1 == x2 {
            return Self::new_relative_column(x1);
        }
        Self {
            start: CellRefRangeEnd::new_relative_column(x1),
            end: Some(CellRefRangeEnd::new_relative_column(x2)),
        }
    }

    pub fn new_relative_row_range(y1: u64, y2: u64) -> Self {
        if y1 == y2 {
            return Self::new_relative_row(y1);
        }
        Self {
            start: CellRefRangeEnd::new_relative_row(y1),
            end: Some(CellRefRangeEnd::new_relative_row(y2)),
        }
    }

    // This is not implemented because a Rect is always normalized, but a
    // CellRefRange is not.
    pub fn new_relative_rect(rect: Rect) -> Self {
        dbgjs!("[new_relative_rect] temporary implementation to get selection from rect, correct implementation before merge");
        Self {
            start: CellRefRangeEnd::new_relative_pos(rect.min),
            end: Some(CellRefRangeEnd::new_relative_pos(rect.max)),
        }
    }

    /// Returns whether `self` might intersect `rect`.
    ///
    /// It's impossible to give an exact answer without knowing the bounds of
    /// each column and row.
    pub fn might_intersect_rect(self, rect: Rect) -> bool {
        let start = self.start;
        match self.end {
            Some(end) => {
                range_might_intersect(rect.x_range_u64(), start.col, end.col)
                    && range_might_intersect(rect.y_range_u64(), start.row, end.row)
            }
            None => {
                range_might_contain_coord(rect.x_range_u64(), start.col)
                    && range_might_contain_coord(rect.y_range_u64(), start.row)
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

    /// Returns whether `self` is a column range.
    pub fn is_column_range(&self) -> bool {
        self.start.row.is_none() || self.end.map_or(false, |end| end.row.is_none())
    }

    /// Returns whether `self` contains the column `col` in its column range.
    pub fn has_column(&self, col: u64) -> bool {
        if self.start.row.is_some() || self.end.map_or(false, |end| end.row.is_some()) {
            return false;
        }
        if let (Some(start_col), Some(end_col)) = (self.start.col, self.end.and_then(|end| end.col))
        {
            let min = start_col.coord.min(end_col.coord);
            let max = start_col.coord.max(end_col.coord);
            min <= col && col <= max
        } else if let Some(start_col) = self.start.col {
            start_col.coord == col
        } else if let Some(end_col) = self.end.and_then(|end| end.col) {
            end_col.coord == col
        } else {
            false
        }
    }

    /// Returns whether `self` is a row range.
    pub fn is_row_range(&self) -> bool {
        self.start.col.is_none() || self.end.map_or(false, |end| end.col.is_none())
    }

    /// Returns whether `self` contains the row `row` in its row range.
    pub fn has_row(&self, row: u64) -> bool {
        if self.start.col.is_some() || self.end.map_or(false, |end| end.col.is_some()) {
            return false;
        }
        if let (Some(start_row), Some(end_row)) = (self.start.row, self.end.and_then(|end| end.row))
        {
            let min = start_row.coord.min(end_row.coord);
            let max = start_row.coord.max(end_row.coord);
            min <= row && row <= max
        } else if let Some(start_row) = self.start.row {
            start_row.coord == row
        } else if let Some(end_row) = self.end.and_then(|end| end.row) {
            end_row.coord == row
        } else {
            false
        }
    }

    /// Returns whether `self` is a finite range.
    pub fn is_finite(&self) -> bool {
        self.start.col.is_some()
            && self.start.row.is_some()
            && self
                .end
                .is_none_or(|end| end.col.is_some() && end.row.is_some())
    }

    /// Returns a rectangle that bounds a finite range.
    pub fn to_rect(&self) -> Option<Rect> {
        if let (Some(start_col), Some(start_row)) = (self.start.col, self.start.row) {
            if let Some(end) = self.end {
                if let (Some(end_col), Some(end_row)) = (end.col, end.row) {
                    Some(Rect::new(
                        start_col.coord as i64,
                        start_row.coord as i64,
                        end_col.coord as i64,
                        end_row.coord as i64,
                    ))
                } else {
                    None
                }
            } else {
                Some(Rect::single_pos(Pos {
                    x: start_col.coord as i64,
                    y: start_row.coord as i64,
                }))
            }
        } else {
            None
        }
    }

    /// Returns the selected columns in the range that fall between `from` and `to`.
    pub fn selected_columns(&self, from: u64, to: u64) -> Vec<u64> {
        let mut columns = vec![];
        if let Some(start_col) = self.start.col {
            if let Some(end) = self.end {
                if let Some(end_col) = end.col {
                    columns.extend(start_col.coord.max(from)..=end_col.coord.min(to));
                } else {
                    columns.extend(start_col.coord.max(from)..=to);
                }
            } else if start_col.coord >= from && start_col.coord <= to {
                columns.push(start_col.coord);
            }
        } else if let Some(end) = self.end {
            if let Some(end_col) = end.col {
                columns.extend(end_col.coord.max(from)..=to);
            } else {
                columns.extend(from..=to);
            }
        } else {
            columns.extend(from..=to);
        }
        columns
    }

    /// Returns the selected rows in the range that fall between `from` and `to`.
    pub fn selected_rows(&self, from: u64, to: u64) -> Vec<u64> {
        let mut rows = vec![];
        if let Some(start_row) = self.start.row {
            if let Some(end) = self.end {
                if let Some(end_row) = end.row {
                    rows.extend(start_row.coord.max(from)..=end_row.coord.min(to));
                } else {
                    rows.extend(start_row.coord.max(from)..=to);
                }
            } else if start_row.coord >= from && start_row.coord <= to {
                rows.push(start_row.coord);
            }
        } else if let Some(end) = self.end {
            if let Some(end_row) = end.row {
                rows.extend(end_row.coord.max(from)..=to);
            } else {
                rows.extend(from..=to);
            }
        } else {
            rows.extend(from..=to);
        }
        rows
    }

    /// Returns a test range from the A1-string.
    #[cfg(test)]
    pub fn test(a1: &str) -> Self {
        Self::from_str(a1).unwrap()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn proptest_cell_ref_range_parsing(cell_ref_range: CellRefRange) {
            // We skip tests where start = end since we remove the end when parsing
            if cell_ref_range.end.is_none_or(|end| end != cell_ref_range.start) {
                assert_eq!(cell_ref_range, cell_ref_range.to_string().parse().unwrap());
            }
        }
    }

    #[test]
    fn test_is_finite() {
        assert!(CellRefRange::test("A1").is_finite());
        assert!(!CellRefRange::test("A").is_finite());
        assert!(!CellRefRange::test("1").is_finite());
    }

    #[test]
    fn test_to_rect() {
        assert_eq!(
            CellRefRange::test("A1").to_rect(),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            CellRefRange::test("A1:B2").to_rect(),
            Some(Rect::new(1, 1, 2, 2))
        );
        assert_eq!(CellRefRange::test("A:B").to_rect(), None);
        assert_eq!(CellRefRange::test("1:2").to_rect(), None);
        assert_eq!(CellRefRange::test("A1:C").to_rect(), None);
        assert_eq!(CellRefRange::test("A:C3").to_rect(), None);
        assert_eq!(CellRefRange::test("*").to_rect(), None);
    }

    #[test]
    fn test_is_column_row() {
        assert!(!CellRefRange::test("A1").is_column_range());
        assert!(CellRefRange::test("A").is_column_range());
        assert!(!CellRefRange::test("A1:C3").is_column_range());
        assert!(CellRefRange::test("A:C").is_column_range());
        assert!(CellRefRange::test("A1:C").is_column_range());
        assert!(CellRefRange::test("A:C1").is_column_range());
    }

    #[test]
    fn test_is_row_range() {
        assert!(!CellRefRange::test("A1").is_row_range());
        assert!(!CellRefRange::test("A").is_row_range());
        assert!(!CellRefRange::test("A1:C3").is_row_range());
        assert!(CellRefRange::test("1").is_row_range());
        assert!(CellRefRange::test("1:3").is_row_range());
        assert!(CellRefRange::test("A1:3").is_row_range());
        assert!(CellRefRange::test("1:C3").is_row_range());
    }

    #[test]
    fn test_has_column() {
        assert!(CellRefRange::test("A").has_column(1));
        assert!(!CellRefRange::test("A").has_column(2));
        assert!(CellRefRange::test("A:B").has_column(1));
        assert!(CellRefRange::test("A:B").has_column(2));
        assert!(!CellRefRange::test("A:B").has_column(3));

        assert!(!CellRefRange::test("A1").has_column(1));
        assert!(!CellRefRange::test("1").has_column(1));
        assert!(!CellRefRange::test("A1:C3").has_column(2));
    }

    #[test]
    fn test_has_row() {
        assert!(CellRefRange::test("1").has_row(1));
        assert!(!CellRefRange::test("1").has_row(2));
        assert!(CellRefRange::test("1:3").has_row(1));
        assert!(CellRefRange::test("1:3").has_row(2));
        assert!(CellRefRange::test("1:3").has_row(3));
        assert!(!CellRefRange::test("1:3").has_row(4));

        assert!(!CellRefRange::test("A1").has_row(1));
        assert!(!CellRefRange::test("A").has_row(1));
        assert!(!CellRefRange::test("A1:C3").has_row(2));
    }

    #[test]
    fn test_selected_columns() {
        assert_eq!(CellRefRange::test("A1").selected_columns(1, 10), vec![1]);
        assert_eq!(CellRefRange::test("A").selected_columns(1, 10), vec![1]);
        assert_eq!(
            CellRefRange::test("A:B").selected_columns(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test("A1:B2").selected_columns(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            CellRefRange::test("A1:D1").selected_columns(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test("1:D").selected_columns(1, 10),
            vec![4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test("A1:C3").selected_columns(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test("A1:").selected_columns(1, 10),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test("*").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(CellRefRange::test(":D").selected_columns(2, 5), vec![4, 5]);
        assert_eq!(
            CellRefRange::test("10").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(CellRefRange::test("4:E").selected_columns(2, 5), vec![4, 5]);
    }

    #[test]
    fn test_selected_rows() {
        assert_eq!(CellRefRange::test("A1").selected_rows(1, 10), vec![1]);
        assert_eq!(CellRefRange::test("1").selected_rows(1, 10), vec![1]);
        assert_eq!(
            CellRefRange::test("1:3").selected_rows(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(CellRefRange::test("A1:B2").selected_rows(1, 10), vec![1, 2]);
        assert_eq!(
            CellRefRange::test("A1:A4").selected_rows(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test("1:4").selected_rows(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            CellRefRange::test("A1:C3").selected_rows(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            CellRefRange::test("A1:").selected_rows(1, 10),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test(":4").selected_rows(2, 10),
            vec![4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test("*").selected_rows(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test("A").selected_rows(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            CellRefRange::test("C:E5").selected_rows(1, 10),
            vec![5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            CellRefRange::test("E5:C").selected_rows(1, 10),
            vec![5, 6, 7, 8, 9, 10]
        );
    }
}
