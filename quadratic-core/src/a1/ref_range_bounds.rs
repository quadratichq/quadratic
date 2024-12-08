use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use ts_rs::TS;

use super::{range_might_contain_coord, range_might_intersect, A1Error, CellRefRangeEnd};
use crate::{Pos, Rect};

#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(test, proptest(filter = "|range| range.is_valid()"))]
pub struct RefRangeBounds {
    pub start: CellRefRangeEnd,
    pub end: Option<CellRefRangeEnd>,
}

impl fmt::Debug for RefRangeBounds {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "RefRangeBounds(")?;
        fmt::Display::fmt(self, f)?;
        write!(f, ")")?;
        Ok(())
    }
}

impl fmt::Display for RefRangeBounds {
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
    /// Range that contains the entire sheet.
    pub const ALL: Self = Self {
        start: CellRefRangeEnd::UNBOUNDED,
        end: Some(CellRefRangeEnd::UNBOUNDED),
    };

    /// Returns whether the range is **valid**.
    ///
    /// A range is valid if it can be represented using a nonempty string.
    pub fn is_valid(self) -> bool {
        self.start.col.is_some() || self.start.row.is_some() || self.end.is_some()
    }

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
            .is_some_and(|start_col| start_col.coord >= end)
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
            .is_some_and(|start_row| start_row.coord >= end)
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

    /// Returns whether `self` is a column range.
    pub fn is_column_range(&self) -> bool {
        self.start.row.is_none() || self.end.map_or(false, |end| end.row.is_none())
    }

    /// Returns whether `self` is a multi-cursor.
    pub fn is_multi_cursor(&self) -> bool {
        if self.start.is_multi_range() {
            return true;
        }
        if let Some(end) = self.end {
            return self.start != end;
        }
        false
    }

    /// Returns whether `self` is the entire range.
    pub fn is_all(&self) -> bool {
        self == &Self::ALL
    }

    /// Returns whether `self` contains the column `col` in its column range.
    pub fn has_column(&self, col: i64) -> bool {
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
    pub fn has_row(&self, row: i64) -> bool {
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
                        start_col.coord,
                        start_row.coord,
                        end_col.coord,
                        end_row.coord,
                    ))
                } else {
                    None
                }
            } else {
                Some(Rect::single_pos(Pos {
                    x: start_col.coord,
                    y: start_row.coord,
                }))
            }
        } else {
            None
        }
    }

    /// Returns only the finite columns in the range.
    pub fn selected_columns_finite(&self) -> Vec<i64> {
        let mut columns = vec![];
        if let Some(start_col) = self.start.col {
            if let Some(end) = self.end {
                if let Some(end_col) = end.col {
                    columns.extend(start_col.coord..=end_col.coord);
                }
            } else {
                columns.push(start_col.coord);
            }
        }
        columns
    }

    /// Returns the selected columns in the range that fall between `from` and `to`.
    pub fn selected_columns(&self, from: i64, to: i64) -> Vec<i64> {
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

    /// Returns only the finite rows in the range.
    pub fn selected_rows_finite(&self) -> Vec<i64> {
        let mut rows = vec![];
        if let Some(start_row) = self.start.row {
            if let Some(end) = self.end {
                if let Some(end_row) = end.row {
                    rows.extend(start_row.coord..=end_row.coord);
                }
            } else {
                rows.push(start_row.coord);
            }
        }
        rows
    }

    /// Returns the selected rows in the range that fall between `from` and `to`.
    pub fn selected_rows(&self, from: i64, to: i64) -> Vec<i64> {
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

    /// Translates the range in place by the given delta.
    pub fn translate_in_place(&mut self, x: i64, y: i64) {
        self.start.translate_in_place(x, y);
        if let Some(end) = self.end.as_mut() {
            end.translate_in_place(x, y);
        }
    }

    /// Returns a new range translated by the given delta.
    pub fn translate(&self, x: i64, y: i64) -> Self {
        let mut range = *self;
        range.translate_in_place(x, y);
        range
    }

    /// Returns true if the range is a single cell.
    pub fn is_single_cell(&self) -> bool {
        self.start.col.is_some() && self.start.row.is_some() && self.end.is_none()
    }

    /// Tries to convert the range to a single cell position. This will only
    /// return Some if the range is a single cell.
    pub fn try_to_pos(&self) -> Option<Pos> {
        if self.is_single_cell() {
            Some(Pos {
                x: self.start.col.unwrap().coord,
                y: self.start.row.unwrap().coord,
            })
        } else {
            None
        }
    }

    /// Converts the CellRefRange to coordinates to be used in Contiguous2D.
    pub fn to_contiguous2d_coords(&self) -> (i64, i64, Option<i64>, Option<i64>) {
        if let Some(end) = self.end {
            (
                self.start.col_or(1),
                self.start.row_or(1),
                end.col.map(|c| c.coord),
                end.row.map(|r| r.coord),
            )
        } else {
            (
                self.start.col_or(1),
                self.start.row_or(1),
                Some(self.start.col_or(1)),
                Some(self.start.row_or(1)),
            )
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

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn proptest_cell_ref_range_parsing(ref_range_bounds: RefRangeBounds) {
            // We skip tests where start = end since we remove the end when parsing
            if ref_range_bounds.end.is_none_or(|end| end != ref_range_bounds.start) {
                assert_eq!(ref_range_bounds, ref_range_bounds.to_string().parse().unwrap());
            }
        }
    }

    #[test]
    fn test_new_relative_all_from() {
        let range = RefRangeBounds::new_relative_all_from(Pos { x: 1, y: 2 });
        assert_eq!(range.to_string(), "A2:");
    }

    #[test]
    fn test_is_finite() {
        assert!(RefRangeBounds::test_a1("A1").is_finite());
        assert!(!RefRangeBounds::test_a1("A").is_finite());
        assert!(!RefRangeBounds::test_a1("1").is_finite());
    }

    #[test]
    fn test_to_rect() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").to_rect(),
            Some(Rect::new(1, 1, 1, 1))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").to_rect(),
            Some(Rect::new(1, 1, 2, 2))
        );
        assert_eq!(RefRangeBounds::test_a1("A:B").to_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("1:2").to_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("A1:C").to_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("A:C3").to_rect(), None);
        assert_eq!(RefRangeBounds::test_a1("*").to_rect(), None);
    }

    #[test]
    fn test_is_column_row() {
        assert!(!RefRangeBounds::test_a1("A1").is_column_range());
        assert!(RefRangeBounds::test_a1("A").is_column_range());
        assert!(!RefRangeBounds::test_a1("A1:C3").is_column_range());
        assert!(RefRangeBounds::test_a1("A:C").is_column_range());
        assert!(RefRangeBounds::test_a1("A1:C").is_column_range());
        assert!(RefRangeBounds::test_a1("A:C1").is_column_range());
    }

    #[test]
    fn test_is_row_range() {
        assert!(!RefRangeBounds::test_a1("A1").is_row_range());
        assert!(!RefRangeBounds::test_a1("A").is_row_range());
        assert!(!RefRangeBounds::test_a1("A1:C3").is_row_range());
        assert!(RefRangeBounds::test_a1("1").is_row_range());
        assert!(RefRangeBounds::test_a1("1:3").is_row_range());
        assert!(RefRangeBounds::test_a1("A1:3").is_row_range());
        assert!(RefRangeBounds::test_a1("1:C3").is_row_range());
    }

    #[test]
    fn test_has_column() {
        assert!(RefRangeBounds::test_a1("A").has_column(1));
        assert!(!RefRangeBounds::test_a1("A").has_column(2));
        assert!(RefRangeBounds::test_a1("A:B").has_column(1));
        assert!(RefRangeBounds::test_a1("A:B").has_column(2));
        assert!(!RefRangeBounds::test_a1("A:B").has_column(3));

        assert!(!RefRangeBounds::test_a1("A1").has_column(1));
        assert!(!RefRangeBounds::test_a1("1").has_column(1));
        assert!(!RefRangeBounds::test_a1("A1:C3").has_column(2));
    }

    #[test]
    fn test_has_row() {
        assert!(RefRangeBounds::test_a1("1").has_row(1));
        assert!(!RefRangeBounds::test_a1("1").has_row(2));
        assert!(RefRangeBounds::test_a1("1:3").has_row(1));
        assert!(RefRangeBounds::test_a1("1:3").has_row(2));
        assert!(RefRangeBounds::test_a1("1:3").has_row(3));
        assert!(!RefRangeBounds::test_a1("1:3").has_row(4));

        assert!(!RefRangeBounds::test_a1("A1").has_row(1));
        assert!(!RefRangeBounds::test_a1("A").has_row(1));
        assert!(!RefRangeBounds::test_a1("A1:C3").has_row(2));
    }

    #[test]
    fn test_selected_columns() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").selected_columns(1, 10),
            vec![1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A").selected_columns(1, 10),
            vec![1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:B").selected_columns(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").selected_columns(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:D1").selected_columns(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:D").selected_columns(1, 10),
            vec![4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").selected_columns(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:").selected_columns(1, 10),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1(":D").selected_columns(2, 5),
            vec![4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1("10").selected_columns(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1("4:E").selected_columns(2, 5),
            vec![5]
        );
    }

    #[test]
    fn test_selected_rows() {
        assert_eq!(RefRangeBounds::test_a1("A1").selected_rows(1, 10), vec![1]);
        assert_eq!(RefRangeBounds::test_a1("1").selected_rows(1, 10), vec![1]);
        assert_eq!(
            RefRangeBounds::test_a1("1:3").selected_rows(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").selected_rows(1, 10),
            vec![1, 2]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:A4").selected_rows(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            RefRangeBounds::test_a1("1:4").selected_rows(1, 10),
            vec![1, 2, 3, 4]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:C3").selected_rows(1, 10),
            vec![1, 2, 3]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:").selected_rows(1, 10),
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1(":4").selected_rows(2, 10),
            vec![4, 5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").selected_rows(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A").selected_rows(2, 5),
            vec![2, 3, 4, 5]
        );
        assert_eq!(
            RefRangeBounds::test_a1("C:E5").selected_rows(1, 10),
            vec![5, 6, 7, 8, 9, 10]
        );
        assert_eq!(
            RefRangeBounds::test_a1("E5:C").selected_rows(1, 10),
            vec![5, 6, 7, 8, 9, 10]
        );
    }

    #[test]
    fn test_is_single_cell() {
        assert!(RefRangeBounds::test_a1("A1").is_single_cell());
        assert!(!RefRangeBounds::test_a1("A").is_single_cell());
        assert!(!RefRangeBounds::test_a1("3").is_single_cell());
        assert!(!RefRangeBounds::test_a1("A1:B2").is_single_cell());
    }

    #[test]
    fn test_selected_columns_finite() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").selected_columns_finite(),
            vec![1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A").selected_columns_finite(),
            vec![1]
        );
        assert_eq!(
            RefRangeBounds::test_a1("A:B").selected_columns_finite(),
            vec![1, 2]
        );
        assert!(RefRangeBounds::test_a1("A1:")
            .selected_columns_finite()
            .is_empty());
        assert!(RefRangeBounds::test_a1("*")
            .selected_columns_finite()
            .is_empty());
        assert!(RefRangeBounds::test_a1(":B")
            .selected_columns_finite()
            .is_empty());
    }

    #[test]
    fn test_selected_rows_finite() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").selected_rows_finite(),
            vec![1]
        );
        assert_eq!(RefRangeBounds::test_a1("1").selected_rows_finite(), vec![1]);
        assert_eq!(
            RefRangeBounds::test_a1("1:3").selected_rows_finite(),
            vec![1, 2, 3]
        );
        assert!(RefRangeBounds::test_a1("A1:")
            .selected_rows_finite()
            .is_empty());
        assert!(RefRangeBounds::test_a1("*")
            .selected_rows_finite()
            .is_empty());
        assert!(RefRangeBounds::test_a1(":3")
            .selected_rows_finite()
            .is_empty());
    }

    #[test]
    fn test_translate_in_place() {
        // Test single cell translation
        let mut range = RefRangeBounds::test_a1("A1");
        range.translate_in_place(1, 1);
        assert_eq!(range.to_string(), "B2");

        // Test range translation
        let mut range = RefRangeBounds::test_a1("A1:C3");
        range.translate_in_place(1, 1);
        assert_eq!(range.to_string(), "B2:D4");

        // Test column range translation
        let mut range = RefRangeBounds::test_a1("A:C");
        range.translate_in_place(1, 0);
        assert_eq!(range.to_string(), "B:D");

        // Test row range translation
        let mut range = RefRangeBounds::test_a1("1:3");
        range.translate_in_place(0, 1);
        assert_eq!(range.to_string(), "2:4");

        // Test negative translation
        let mut range = RefRangeBounds::test_a1("B2:D4");
        range.translate_in_place(-1, -1);
        assert_eq!(range.to_string(), "A1:C3");

        // Test zero translation
        let mut range = RefRangeBounds::test_a1("A1:C3");
        range.translate_in_place(0, 0);
        assert_eq!(range.to_string(), "A1:C3");

        // Test that * remains unchanged
        let mut range = RefRangeBounds::test_a1("*");
        range.translate_in_place(1, 1);
        assert_eq!(range.to_string(), "*");

        // Test negative translation capping
        let mut range = RefRangeBounds::test_a1("A1");
        range.translate_in_place(-10, -10);
        assert_eq!(range.to_string(), "A1");
    }

    #[test]
    fn test_translate() {
        // Test single cell translation
        let range = RefRangeBounds::test_a1("A1");
        let translated = range.translate(1, 1);
        assert_eq!(translated.to_string(), "B2");
        assert_eq!(range.to_string(), "A1");

        // Test range translation
        let range = RefRangeBounds::test_a1("A1:C3");
        let translated = range.translate(1, 1);
        assert_eq!(translated.to_string(), "B2:D4");
        assert_eq!(range.to_string(), "A1:C3");

        // Test column range translation
        let range = RefRangeBounds::test_a1("A:C");
        let translated = range.translate(1, 0);
        assert_eq!(translated.to_string(), "B:D");
        assert_eq!(range.to_string(), "A:C");

        // Test row range translation
        let range = RefRangeBounds::test_a1("1:3");
        let translated = range.translate(0, 1);
        assert_eq!(translated.to_string(), "2:4");
        assert_eq!(range.to_string(), "1:3");

        // Test negative translation
        let range = RefRangeBounds::test_a1("B2:D4");
        let translated = range.translate(-1, -1);
        assert_eq!(translated.to_string(), "A1:C3");
        assert_eq!(range.to_string(), "B2:D4");

        // Test zero translation
        let range = RefRangeBounds::test_a1("A1:C3");
        let translated = range.translate(0, 0);
        assert_eq!(translated.to_string(), "A1:C3");
        assert_eq!(range.to_string(), "A1:C3");

        // Test that * remains unchanged
        let range = RefRangeBounds::test_a1("*");
        let translated = range.translate(1, 1);
        assert_eq!(translated.to_string(), "*");
        assert_eq!(range.to_string(), "*");

        // Test negative translation capping
        let range = RefRangeBounds::test_a1("A1");
        let translated = range.translate(-10, -10);
        assert_eq!(translated.to_string(), "A1");
        assert_eq!(range.to_string(), "A1");
    }

    #[test]
    fn test_is_all() {
        assert!(RefRangeBounds::test_a1("*").is_all());
        assert!(!RefRangeBounds::test_a1("A1").is_all());
        assert!(!RefRangeBounds::test_a1("A1:B2").is_all());
    }

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
    fn test_try_to_pos() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").try_to_pos(),
            Some(Pos::new(1, 1))
        );
        assert_eq!(RefRangeBounds::test_a1("A1:B2").try_to_pos(), None);
        assert_eq!(RefRangeBounds::test_a1("A").try_to_pos(), None);
        assert_eq!(RefRangeBounds::test_a1("1:5").try_to_pos(), None);
        assert_eq!(RefRangeBounds::test_a1("*").try_to_pos(), None);
    }

    #[test]
    fn test_to_contiguous2d_coords() {
        assert_eq!(
            RefRangeBounds::test_a1("A1").to_contiguous2d_coords(),
            (1, 1, Some(1), Some(1))
        );
        assert_eq!(
            RefRangeBounds::test_a1("A1:B2").to_contiguous2d_coords(),
            (1, 1, Some(2), Some(2))
        );
        assert_eq!(
            RefRangeBounds::test_a1("B1:C").to_contiguous2d_coords(),
            (2, 1, Some(3), None)
        );
        assert_eq!(
            RefRangeBounds::test_a1("2").to_contiguous2d_coords(),
            (2, 1, Some(2), None)
        );
        assert_eq!(
            RefRangeBounds::test_a1("*").to_contiguous2d_coords(),
            (1, 1, None, None)
        );
        assert_eq!(
            RefRangeBounds::test_a1("E:G").to_contiguous2d_coords(),
            (5, 1, Some(7), None)
        );
    }

    #[test]
    fn test_might_contain_cols() {
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_cols(1, 2));
        assert!(!RefRangeBounds::test_a1("A1:B2").might_contain_cols(3, 4));
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_cols(1, 10));
        assert!(RefRangeBounds::test_a1("*").might_contain_cols(1, 10));
        assert!(!RefRangeBounds::test_a1("A1:B2").might_contain_cols(1, 1));
    }

    #[test]
    fn test_might_contain_rows() {
        assert!(RefRangeBounds::test_a1("A1:B2").might_contain_rows(1, 2));
        assert!(!RefRangeBounds::test_a1("A1:B2").might_contain_rows(3, 4));
    }
}
