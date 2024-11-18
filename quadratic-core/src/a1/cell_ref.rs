use std::str::FromStr;
use std::{fmt, ops::RangeInclusive};

use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};

use super::{A1Error, SheetNameIdMap};
use crate::{grid::SheetId, Pos, Rect};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct SheetCellRefRange {
    pub sheet: SheetId,
    pub cells: CellRefRange,
}
impl SheetCellRefRange {
    /// Parses a selection from a comma-separated list of ranges.
    ///
    /// Ranges without an explicit sheet use `default_sheet_id`.
    pub fn from_str(
        a1: &str,
        default_sheet_id: SheetId,
        sheet_map: &SheetNameIdMap,
    ) -> Result<Self, A1Error> {
        let (sheet, cells_str) =
            super::parse_optional_sheet_name_to_id(a1, default_sheet_id, sheet_map)?;
        let cells = cells_str.parse()?;
        Ok(Self { sheet, cells })
    }

    /// Returns an A1-style string describing the range. The sheet name is
    /// included in the output only if `default_sheet_id` is `None` or differs
    /// from the ID of the sheet containing the range.
    pub fn to_string(
        self,
        default_sheet_id: Option<SheetId>,
        sheet_map: &SheetNameIdMap,
    ) -> String {
        if default_sheet_id.is_some_and(|it| it != self.sheet) {
            let sheet_name = sheet_map
                .iter()
                .find(|(_, id)| **id == self.sheet)
                .map(|(name, _)| name.clone())
                .unwrap_or(super::UNKNOWN_SHEET_NAME.to_string());
            format!("{}!{}", super::quote_sheet_name(&sheet_name), self.cells)
        } else {
            format!("{}", self.cells)
        }
    }
}

#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(test, proptest(filter = "|range| range.is_valid()"))]
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
            Some((left, right)) => Ok(CellRefRange {
                start: left.parse()?,
                end: Some(right.parse()?),
            }),
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
        Self {
            start: CellRefRangeEnd::new_relative_column(x1),
            end: Some(CellRefRangeEnd::new_relative_column(x2)),
        }
    }
    pub fn new_relative_row_range(y1: u64, y2: u64) -> Self {
        Self {
            start: CellRefRangeEnd::new_relative_row(y1),
            end: Some(CellRefRangeEnd::new_relative_row(y2)),
        }
    }

    /// Returns a reference to a rectangle.
    ///
    /// 1x1 rectangles are simplified to single-cell references.
    pub fn new_relative_rect(rect: Rect) -> Self {
        CellRefRange {
            start: CellRefRangeEnd::new_relative_pos(rect.min),
            end: (rect.min != rect.max).then_some(CellRefRangeEnd::new_relative_pos(rect.max)),
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
        self.start.row.is_none() && self.end.map_or(true, |end| end.row.is_none())
    }

    /// Returns whether `self` is a row range.
    pub fn is_row_range(&self) -> bool {
        self.start.col.is_none() && self.end.map_or(true, |end| end.col.is_none())
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct CellRefRangeEnd {
    pub col: Option<CellRefCoord>,
    pub row: Option<CellRefCoord>,
}
impl fmt::Display for CellRefRangeEnd {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(col) = self.col {
            col.fmt_as_column(f)?;
        }
        if let Some(row) = self.row {
            row.fmt_as_row(f)?;
        }
        Ok(())
    }
}
impl FromStr for CellRefRangeEnd {
    type Err = A1Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        lazy_static! {
            static ref A1_REGEX: Regex =
                Regex::new(r#"(\$?)([A-Z]*)(\$?)(\d*)"#).expect("bad regex");
        }

        let captures = A1_REGEX
            .captures(s)
            .ok_or_else(|| A1Error::InvalidCellReference(s.to_string()))?;

        let mut col_is_absolute = !captures[1].is_empty();
        let col_str = &captures[2];
        let mut row_is_absolute = !captures[3].is_empty();
        let row_str = &captures[4];

        // If there is no column, then an absolute row will be parsed as
        // `($)()()(row)` instead of `()()($)(row)`. Let's fix that.
        if col_is_absolute && col_str.is_empty() {
            std::mem::swap(&mut row_is_absolute, &mut col_is_absolute);
        }

        let col = match col_str {
            "" => None,
            _ => Some(
                super::column_from_name(col_str)
                    .ok_or_else(|| A1Error::InvalidColumn(col_str.to_owned()))?,
            ),
        };
        let row = match row_str {
            "" => None,
            _ => Some(
                row_str
                    .parse()
                    .ok()
                    .filter(|&y| y > 0)
                    .ok_or_else(|| A1Error::InvalidRow(row_str.to_owned()))?,
            ),
        };

        if col_is_absolute && col.is_none() || row_is_absolute && row.is_none() {
            return Err(A1Error::SpuriousDollarSign(s.to_owned()));
        }

        Ok(CellRefRangeEnd {
            col: col.map(|coord| {
                let is_absolute = col_is_absolute;
                CellRefCoord { coord, is_absolute }
            }),
            row: row.map(|coord| {
                let is_absolute = row_is_absolute;
                CellRefCoord { coord, is_absolute }
            }),
        })
    }
}
impl CellRefRangeEnd {
    /// End of a range that is unbounded on both axes.
    pub const UNBOUNDED: Self = Self {
        col: None,
        row: None,
    };

    pub fn new_relative_xy(x: u64, y: u64) -> Self {
        let col = Some(CellRefCoord::new_rel(x));
        let row = Some(CellRefCoord::new_rel(y));
        CellRefRangeEnd { col, row }
    }
    pub fn new_relative_pos(pos: Pos) -> Self {
        Self::new_relative_xy(pos.x as u64, pos.y as u64)
    }

    pub fn new_relative_column(x: u64) -> Self {
        let col = Some(CellRefCoord::new_rel(x));
        CellRefRangeEnd { col, row: None }
    }
    pub fn new_relative_row(y: u64) -> Self {
        let row = Some(CellRefCoord::new_rel(y));
        CellRefRangeEnd { col: None, row }
    }
    pub fn delta_size(self, delta_x: i64, delta_y: i64) -> Self {
        CellRefRangeEnd {
            col: self.col.map(|c| c.delta_size(delta_x)),
            row: self.row.map(|r| r.delta_size(delta_y)),
        }
    }
    pub fn is_multi_range(&self) -> bool {
        self.col.is_none() || self.row.is_none()
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct CellRefCoord {
    #[cfg_attr(test, proptest(strategy = "super::PROPTEST_COORDINATE_U64"))]
    pub coord: u64,
    pub is_absolute: bool,
}
impl CellRefCoord {
    fn fmt_as_column(self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.is_absolute {
            write!(f, "$")?;
        }
        write!(f, "{}", super::column_name(self.coord))
    }
    fn fmt_as_row(self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.is_absolute {
            write!(f, "$")?;
        }
        write!(f, "{}", self.coord)
    }

    pub fn new_rel(coord: u64) -> Self {
        let is_absolute = false;
        Self { coord, is_absolute }
    }
    pub fn new_abs(coord: u64) -> Self {
        let is_absolute = true;
        Self { coord, is_absolute }
    }
    pub fn delta_size(self, delta: i64) -> Self {
        let coord = if delta + self.coord as i64 <= 0 {
            1
        } else {
            self.coord as i64 + delta
        } as u64;
        Self {
            coord,
            is_absolute: self.is_absolute,
        }
    }
}

/// Returns whether `range` might intersect the region from `start` to `end`.
fn range_might_intersect(
    range: RangeInclusive<u64>,
    mut start: Option<CellRefCoord>,
    mut end: Option<CellRefCoord>,
) -> bool {
    if let (Some(a), Some(b)) = (start, end) {
        if b.coord < a.coord {
            std::mem::swap(&mut start, &mut end);
        }
    }
    let range_excluded_by_start = start.map_or(false, |a| *range.end() < a.coord);
    let range_excluded_by_end = end.map_or(false, |b| b.coord < *range.start());
    !range_excluded_by_start && !range_excluded_by_end
}

/// Returns whether `range` might contain `coord`.
///
/// If `coord` is `None`, returns `true`.
fn range_might_contain_coord(range: RangeInclusive<u64>, coord: Option<CellRefCoord>) -> bool {
    match coord {
        Some(a) => range.contains(&a.coord),
        None => true,
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
            assert_eq!(cell_ref_range, cell_ref_range.to_string().parse().unwrap());
        }
    }

    #[test]
    fn test_delta_size() {
        assert_eq!(
            CellRefCoord::new_rel(1).delta_size(-1),
            CellRefCoord::new_rel(1)
        );
        assert_eq!(
            CellRefCoord::new_rel(1).delta_size(1),
            CellRefCoord::new_rel(2)
        );
    }

    #[test]
    fn test_is_multi_range() {
        assert!(CellRefRangeEnd::new_relative_column(1).is_multi_range());
        assert!(CellRefRangeEnd::new_relative_row(1).is_multi_range());
        assert!(!CellRefRangeEnd::new_relative_xy(1, 1).is_multi_range());
    }
}
