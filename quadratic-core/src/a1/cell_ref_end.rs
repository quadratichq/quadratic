use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fmt;
use ts_rs::TS;
use wasm_bindgen::prelude::*;

use super::{A1Error, CellRefCoord};
use crate::{Pos, UNBOUNDED};

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct CellRefRangeEnd {
    pub col: CellRefCoord,
    pub row: CellRefCoord,
}
impl fmt::Display for CellRefRangeEnd {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.col.fmt_as_column(f)?;
        self.row.fmt_as_row(f)?;
        Ok(())
    }
}

impl CellRefRangeEnd {
    pub const START: Self = Self {
        col: CellRefCoord::START,
        row: CellRefCoord::START,
    };
    pub const UNBOUNDED: Self = Self {
        col: CellRefCoord::UNBOUNDED,
        row: CellRefCoord::UNBOUNDED,
    };

    pub fn new_relative_xy(x: i64, y: i64) -> Self {
        let col = CellRefCoord::new_rel(x);
        let row = CellRefCoord::new_rel(y);
        CellRefRangeEnd { col, row }
    }
    pub fn new_relative_pos(pos: Pos) -> Self {
        Self::new_relative_xy(pos.x, pos.y)
    }

    pub fn new_infinite_col_end(x: i64) -> Self {
        Self::new_relative_xy(x, UNBOUNDED)
    }

    pub fn new_infinite_row_end(y: i64) -> Self {
        Self::new_relative_xy(UNBOUNDED, y)
    }

    pub fn translate_in_place(&mut self, delta_x: i64, delta_y: i64) {
        self.col.translate_in_place(delta_x);
        self.row.translate_in_place(delta_y);
    }

    pub fn translate(self, delta_x: i64, delta_y: i64) -> Self {
        CellRefRangeEnd {
            col: self.col.translate(delta_x),
            row: self.row.translate(delta_y),
        }
    }

    // TODO: `impl PartialEq<Pos> for CellRefRangeEnd`
    pub fn is_pos(self, pos: Pos) -> bool {
        self.col.coord == pos.x && self.row.coord == pos.y
    }

    /// Unpacks the x coordinate
    pub fn col(self) -> i64 {
        self.col.coord
    }

    /// Unpacks the y coordinate
    pub fn row(self) -> i64 {
        self.row.coord
    }

    /// Parses the components of a CellRefRangeEnd.
    fn parse_components(s: &str) -> Result<(Option<i64>, bool, Option<i64>, bool), A1Error> {
        lazy_static! {
            static ref A1_REGEX: Regex =
                Regex::new(r#"(\$?)([A-Za-z]*)(\$?)(\d*)"#).expect("bad regex");
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
        let row: Option<i64> = match row_str {
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

        Ok((col, col_is_absolute, row, row_is_absolute))
    }

    /// Parses the components of a CellRefRangeEnd.
    pub fn parse_start(s: &str) -> Result<CellRefRangeEnd, A1Error> {
        let (col, col_is_absolute, row, row_is_absolute) = Self::parse_components(s)?;
        Ok(CellRefRangeEnd {
            col: CellRefCoord {
                coord: col.unwrap_or(1),
                is_absolute: col_is_absolute,
            },
            row: CellRefCoord {
                coord: row.unwrap_or(1),
                is_absolute: row_is_absolute,
            },
        })
    }

    /// Parses the components of a CellRefRangeEnd.
    pub fn parse_end(s: &str) -> Result<CellRefRangeEnd, A1Error> {
        let (col, col_is_absolute, row, row_is_absolute) = Self::parse_components(s)?;
        Ok(CellRefRangeEnd {
            col: CellRefCoord {
                coord: col.unwrap_or(UNBOUNDED),
                is_absolute: col_is_absolute,
            },
            row: CellRefCoord {
                coord: row.unwrap_or(UNBOUNDED),
                is_absolute: row_is_absolute,
            },
        })
    }

    pub fn is_unbounded(self) -> bool {
        self.col.coord == UNBOUNDED || self.row.coord == UNBOUNDED
    }

    // pub fn new_infinite_col(col: i64) -> Self {
    //     CellRefRangeEnd {
    //         col: CellRefCoord::new_rel(col),
    //         row: None,
    //     }
    // }

    // pub fn new_relative_xy(x: i64, y: i64) -> Self {
    //     let col = Some(CellRefCoord::new_rel(x));
    //     let row = Some(CellRefCoord::new_rel(y));
    //     CellRefRangeEnd { col, row }
    // }
    // pub fn new_relative_pos(pos: Pos) -> Self {
    //     Self::new_relative_xy(pos.x, pos.y)
    // }

    // pub fn new_relative_column(x: i64) -> Self {
    //     let col = Some(CellRefCoord::new_rel(x));
    //     CellRefRangeEnd { col, row: None }
    // }

    // pub fn new_relative_row(y: i64) -> Self {
    //     let row = Some(CellRefCoord::new_rel(y));
    //     CellRefRangeEnd { col: None, row }
    // }

    // pub fn translate_in_place(&mut self, delta_x: i64, delta_y: i64) {
    //     if let Some(c) = self.col.as_mut() {
    //         c.translate_in_place(delta_x);
    //     }
    //     if let Some(r) = self.row.as_mut() {
    //         r.translate_in_place(delta_y);
    //     }
    // }

    // pub fn translate(self, delta_x: i64, delta_y: i64) -> Self {
    //     CellRefRangeEnd {
    //         col: self.col.map(|c| c.translate(delta_x)),
    //         row: self.row.map(|r| r.translate(delta_y)),
    //     }
    // }

    pub fn adjust_column_row_in_place(
        &mut self,
        column: Option<i64>,
        row: Option<i64>,
        delta: i64,
    ) {
        if let Some(column) = column {
            if self.col() >= column {
                self.col.coord = self.col.coord.saturating_add(delta).max(1);
            }
        }
        if let Some(row) = row {
            if self.row() >= row {
                self.row.coord = self.row.coord.saturating_add(delta).max(1);
            }
        }
    }

    pub fn adjust_column_row(&self, column: Option<i64>, row: Option<i64>, delta: i64) -> Self {
        let mut range = *self;
        range.adjust_column_row_in_place(column, row, delta);
        range
    }

    /// Returns whether the range end is missing a row or column number.
    pub fn is_multi_range(self) -> bool {
        self.col.is_unbounded() || self.row.is_unbounded()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_cell_ref_range_end_is_pos() {
        assert!(CellRefRangeEnd::new_relative_xy(1, 2).is_pos(Pos { x: 1, y: 2 }));
        assert!(!CellRefRangeEnd::new_relative_xy(1, 1).is_pos(Pos { x: 2, y: 1 }));
        assert!(!CellRefRangeEnd::new_relative_xy(1, 1).is_pos(Pos { x: 1, y: 2 }));
    }

    #[test]
    fn test_parse_cell_ref_range_end_start() {
        assert_eq!(
            CellRefRangeEnd::parse_start("A1").unwrap(),
            CellRefRangeEnd::new_relative_xy(1, 1)
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("$A$1").unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_abs(1),
                row: CellRefCoord::new_abs(1)
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("A").unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(1),
                row: CellRefCoord::START,
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("1").unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(1),
                row: CellRefCoord::new_rel(1)
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("$1").unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(1),
                row: CellRefCoord::new_abs(1)
            }
        );
    }

    #[test]
    fn test_parse_cell_ref_range_end_end() {
        assert_eq!(
            CellRefRangeEnd::parse_end("A1").unwrap(),
            CellRefRangeEnd::new_relative_xy(1, 1)
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("$A$1").unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_abs(1),
                row: CellRefCoord::new_abs(1)
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("1").unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(UNBOUNDED),
                row: CellRefCoord::START,
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("1").unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::UNBOUNDED,
                row: CellRefCoord::new_rel(1)
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("$1").unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(UNBOUNDED),
                row: CellRefCoord::new_abs(1)
            }
        );
    }

    #[test]
    fn test_parse_invalid_cell_ref_range_end_start() {
        assert!(CellRefRangeEnd::parse_start("$").is_err());
        assert!(CellRefRangeEnd::parse_start("A0").is_err());
        assert!(CellRefRangeEnd::parse_start("0").is_err());
        assert!(CellRefRangeEnd::parse_start("$A$").is_err());
        assert!(CellRefRangeEnd::parse_start("").is_ok());
    }

    #[test]
    fn test_parse_invalid_cell_ref_range_end_end() {
        assert!(CellRefRangeEnd::parse_end("$").is_err());
        assert!(CellRefRangeEnd::parse_end("A0").is_err());
        assert!(CellRefRangeEnd::parse_end("0").is_err());
        assert!(CellRefRangeEnd::parse_end("$A$").is_err());
        assert!(CellRefRangeEnd::parse_end("").is_ok());
    }

    #[test]
    fn test_display_cell_ref_range_end() {
        assert_eq!(CellRefRangeEnd::new_relative_xy(1, 1).to_string(), "A1");
        assert_eq!(
            CellRefRangeEnd {
                col: CellRefCoord::new_abs(1),
                row: CellRefCoord::new_abs(1)
            }
            .to_string(),
            "$A$1"
        );
        assert_eq!(
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(1),
                row: CellRefCoord::UNBOUNDED
            }
            .to_string(),
            "A"
        );
        assert_eq!(CellRefRangeEnd::new_infinite_col_end(1).to_string(), "A");
        assert_eq!(CellRefRangeEnd::new_infinite_col_end(1).to_string(), "A");
        assert_eq!(CellRefRangeEnd::new_infinite_row_end(1).to_string(), "1");
    }

    #[test]
    fn test_translate_in_place() {
        let mut ref_end = CellRefRangeEnd::new_relative_xy(1, 1);
        ref_end.translate_in_place(1, 2);
        assert_eq!(ref_end, CellRefRangeEnd::new_relative_xy(2, 3));

        let mut ref_end = CellRefRangeEnd::new_relative_xy(2, 3);
        ref_end.translate_in_place(-1, -1);
        assert_eq!(ref_end, CellRefRangeEnd::new_relative_xy(1, 2));
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
        assert_eq!(CellRefRangeEnd::UNBOUNDED.col.coord, UNBOUNDED);
        assert_eq!(CellRefRangeEnd::UNBOUNDED.row.coord, UNBOUNDED);
        assert!(CellRefRangeEnd::UNBOUNDED.is_unbounded());
    }

    #[test]
    fn test_col() {
        assert_eq!(CellRefRangeEnd::new_relative_xy(2, 3).col(), 2);
        assert_eq!(CellRefRangeEnd::UNBOUNDED.col(), UNBOUNDED);
    }

    #[test]
    fn test_row() {
        assert_eq!(CellRefRangeEnd::new_relative_xy(2, 3).row(), 3);
        assert_eq!(CellRefRangeEnd::UNBOUNDED.row(), UNBOUNDED);
    }
}
