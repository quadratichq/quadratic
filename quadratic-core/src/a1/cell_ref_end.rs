use std::fmt;
use std::str::FromStr;

use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use wasm_bindgen::prelude::*;

use super::{A1Error, CellRefCoord};
use crate::Pos;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(feature = "js", wasm_bindgen)]
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

    pub fn translate(self, delta_x: i64, delta_y: i64) -> Self {
        CellRefRangeEnd {
            col: self.col.map(|c| c.translate(delta_x)),
            row: self.row.map(|r| r.translate(delta_y)),
        }
    }

    pub fn is_multi_range(&self) -> bool {
        self.col.is_none() || self.row.is_none()
    }

    pub fn is_pos(&self, pos: Pos) -> bool {
        self.col.map_or(false, |col| col.coord == pos.x as u64)
            && self.row.map_or(false, |row| row.coord == pos.y as u64)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_is_multi_range() {
        assert!(CellRefRangeEnd::new_relative_column(1).is_multi_range());
        assert!(CellRefRangeEnd::new_relative_row(1).is_multi_range());
        assert!(!CellRefRangeEnd::new_relative_xy(1, 1).is_multi_range());
    }

    #[test]
    fn test_cell_ref_range_end_is_pos() {
        assert!(CellRefRangeEnd::new_relative_xy(1, 2).is_pos(Pos { x: 1, y: 2 }));
        assert!(!CellRefRangeEnd::new_relative_xy(1, 1).is_pos(Pos { x: 2, y: 1 }));
        assert!(!CellRefRangeEnd::new_relative_xy(1, 1).is_pos(Pos { x: 1, y: 2 }));
        assert!(!CellRefRangeEnd::new_relative_column(1).is_pos(Pos { x: 1, y: 1 }));
        assert!(!CellRefRangeEnd::new_relative_row(1).is_pos(Pos { x: 1, y: 1 }));
    }

    #[test]
    fn test_parse_cell_ref_range_end() {
        assert_eq!(
            "A1".parse::<CellRefRangeEnd>().unwrap(),
            CellRefRangeEnd::new_relative_xy(1, 1)
        );
        assert_eq!(
            "$A$1".parse::<CellRefRangeEnd>().unwrap(),
            CellRefRangeEnd {
                col: Some(CellRefCoord::new_abs(1)),
                row: Some(CellRefCoord::new_abs(1))
            }
        );
        assert_eq!(
            "A".parse::<CellRefRangeEnd>().unwrap(),
            CellRefRangeEnd::new_relative_column(1)
        );
        assert_eq!(
            "1".parse::<CellRefRangeEnd>().unwrap(),
            CellRefRangeEnd::new_relative_row(1)
        );
        assert_eq!(
            "$1".parse::<CellRefRangeEnd>().unwrap(),
            CellRefRangeEnd {
                col: None,
                row: Some(CellRefCoord::new_abs(1))
            }
        );
    }

    #[test]
    fn test_parse_invalid_cell_ref_range_end() {
        assert!("$".parse::<CellRefRangeEnd>().is_err());
        assert!("A0".parse::<CellRefRangeEnd>().is_err());
        assert!("0".parse::<CellRefRangeEnd>().is_err());
        assert!("$A$".parse::<CellRefRangeEnd>().is_err());

        assert!("".parse::<CellRefRangeEnd>().is_ok());
    }

    #[test]
    fn test_display_cell_ref_range_end() {
        assert_eq!(CellRefRangeEnd::new_relative_xy(1, 1).to_string(), "A1");
        assert_eq!(
            CellRefRangeEnd {
                col: Some(CellRefCoord::new_abs(1)),
                row: Some(CellRefCoord::new_abs(1))
            }
            .to_string(),
            "$A$1"
        );
        assert_eq!(CellRefRangeEnd::new_relative_column(1).to_string(), "A");
        assert_eq!(CellRefRangeEnd::new_relative_row(1).to_string(), "1");
    }

    #[test]
    fn test_translate() {
        let ref_end = CellRefRangeEnd::new_relative_xy(1, 1);
        assert_eq!(
            ref_end.translate(1, 2),
            CellRefRangeEnd::new_relative_xy(2, 3)
        );
        let ref_end = CellRefRangeEnd::new_relative_xy(2, 3);
        assert_eq!(
            ref_end.translate(-1, -1),
            CellRefRangeEnd::new_relative_xy(1, 2)
        );
    }

    #[test]
    fn test_unbounded() {
        assert_eq!(CellRefRangeEnd::UNBOUNDED.col, None);
        assert_eq!(CellRefRangeEnd::UNBOUNDED.row, None);
        assert!(CellRefRangeEnd::UNBOUNDED.is_multi_range());
    }
}