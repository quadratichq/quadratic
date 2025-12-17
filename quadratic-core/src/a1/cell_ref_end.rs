use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fmt;
use ts_rs::TS;
use wasm_bindgen::prelude::*;

use super::{A1Error, CellRefCoord, UNBOUNDED};
use crate::{Pos, RefAdjust, RefError, a1::column_name};

/// The maximum value for a column or row number.
const OUT_OF_BOUNDS: i64 = 1_000_000_000;

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
        col: CellRefCoord::REL_START,
        row: CellRefCoord::REL_START,
    };
    pub const UNBOUNDED: Self = Self {
        col: CellRefCoord::REL_UNBOUNDED,
        row: CellRefCoord::REL_UNBOUNDED,
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

    /// Adjusts coordinates by `adjust`. Returns an error if the result is out
    /// of bounds.
    ///
    /// **Note:** `adjust.sheet_id` is ignored by this method.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn adjust(self, adjust: RefAdjust) -> Result<Self, RefError> {
        if self.affected_by_adjustment(adjust) {
            Ok(Self {
                col: self.col.adjust(adjust.relative_only, adjust.dx)?,
                row: self.row.adjust(adjust.relative_only, adjust.dy)?,
            })
        } else {
            Ok(self)
        }
    }
    /// Adjusts coordinates by `adjust`. If the cell reference ends up out of
    /// range, it is clamped to A1.
    ///
    /// **Note:** `adjust.sheet_id` is ignored by this method.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn saturating_adjust(self, adjust: RefAdjust) -> Self {
        if self.affected_by_adjustment(adjust) {
            Self {
                col: self.col.saturating_adjust(adjust.relative_only, adjust.dx),
                row: self.row.saturating_adjust(adjust.relative_only, adjust.dy),
            }
        } else {
            self
        }
    }

    /// Adjusts X and Y coordinates independently, and returns them as separate
    /// [`Result`]s.
    pub fn try_adjust_xy(
        self,
        adjust: RefAdjust,
    ) -> (
        Result<CellRefCoord, RefError>,
        Result<CellRefCoord, RefError>,
    ) {
        if self.affected_by_adjustment(adjust) {
            let col = self.col.adjust(adjust.relative_only, adjust.dx);
            let row = self.row.adjust(adjust.relative_only, adjust.dy);
            (col, row)
        } else {
            (Ok(self.col), Ok(self.row))
        }
    }

    /// Returns whether an adjustment should affect this position.
    fn affected_by_adjustment(self, adjust: RefAdjust) -> bool {
        self.col.coord >= adjust.x_start && self.row.coord >= adjust.y_start
    }

    // TODO: remove this function when switching to u64
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn translate_unchecked(self, delta_x: i64, delta_y: i64) -> Self {
        CellRefRangeEnd {
            col: self.col.translate_unchecked(delta_x),
            row: self.row.translate_unchecked(delta_y),
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

    /// Returns a new range end with the column and row bounded to the given
    /// position at the start of the range.
    pub fn to_bounded_start(self, pos: Pos) -> Self {
        CellRefRangeEnd {
            col: self.col.to_bounded_start(pos.x),
            row: self.row.to_bounded_start(pos.y),
        }
    }

    /// Returns a new range end with the column and row bounded to the given
    /// position at the end of the range.
    pub fn to_bounded_end(self, pos: Pos) -> Self {
        CellRefRangeEnd {
            col: self.col.to_bounded_end(pos.x),
            row: self.row.to_bounded_end(pos.y),
        }
    }

    /// Parses the components of a CellRefRangeEnd and returns a tuple:
    /// `(x, is_x_absolute, y, is_y_absolute)`
    ///
    /// If `base_pos` is `None`, then only A1 notation is accepted. If it is
    /// `Some`, then A1 and RC notation are both accepted.
    fn parse_components(
        s: &str,
        base_pos: Option<Pos>,
    ) -> Result<(Option<i64>, bool, Option<i64>, bool), A1Error> {
        let a1_result = Self::parse_a1_components(s);
        match (base_pos, a1_result) {
            (Some(base_pos), Err(A1Error::InvalidCellReference(_))) => {
                Self::parse_rc_components(s, base_pos)
            }
            (_, other) => other,
        }
    }

    fn parse_a1_components(s: &str) -> Result<(Option<i64>, bool, Option<i64>, bool), A1Error> {
        lazy_static! {
            /// ^(\$?)([A-Za-z]*)(\$?)(\d*)$
            /// ^                          $    match whole string
            ///  (\$?)                          group 1: optional `$`
            ///       ([A-Za-z]*)               group 2: optional column name
            ///                  (\$?)          group 3: optional `$`
            ///                       (\d*)     group 4: optional row name
            ///
            /// All groups will be present, but some may be empty.
            static ref A1_REGEX: Regex =
                Regex::new(r#"^(\$?)([A-Za-z]*)(\$?)(\d*)$"#).expect("bad regex");
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
                    .ok_or_else(|| A1Error::InvalidRow(row_str.to_owned()))?,
            ),
        };

        if col_is_absolute && col.is_none() || row_is_absolute && row.is_none() {
            return Err(A1Error::SpuriousDollarSign(s.to_owned()));
        }

        if col.is_some_and(|c| c != UNBOUNDED && c > OUT_OF_BOUNDS)
            && let Some(c) = col
        {
            return Err(A1Error::InvalidColumn(column_name(c)));
        }
        if row.is_some_and(|r| r != UNBOUNDED && r > OUT_OF_BOUNDS) {
            return Err(A1Error::InvalidRow(row.unwrap_or(1).to_string()));
        }

        // $A should imply absolute row and column.
        if !row_is_absolute && row_str.is_empty() && !col_str.is_empty() && col_is_absolute {
            row_is_absolute = true;
        }

        // $1 should imply absolute row and column.
        if !col_is_absolute && col_str.is_empty() && !row_str.is_empty() && row_is_absolute {
            col_is_absolute = true;
        }

        Ok((col, col_is_absolute, row, row_is_absolute))
    }

    fn parse_rc_components(
        s: &str,
        base_pos: Pos,
    ) -> Result<(Option<i64>, bool, Option<i64>, bool), A1Error> {
        lazy_static! {
            /// ^(R(\[(-?\d+)\]|\{(\d+)\}))?(C(\[(-?\d+)\]|\{(\d+)\}))?$
            /// ^                                                      $    match whole string
            ///  (                        )?                                group 1: optional row
            ///   R                                                           literal R
            ///    (           |         )                                    group 2: either of ...
            ///     \[       \]                                                 square brackets containing ...
            ///       (-?\d+)                                                     group 3: positive or negative integer
            ///                 \{     \}                                       curly braces containing ...
            ///                   (\d+)                                           group 4: positive integer
            ///                             (                        )?     group 5: optional column (same as row)
            ///                              C                                literal C
            ///                               (           |         )         group 6: either of ...
            ///                                \[(-?\d+)\]                      group 7: `[]` with positive or negative integer
            ///                                            \{(\d+)\}            group 8: `{}` with positive integer
            static ref RC_REGEX: Regex =
                Regex::new(r#"^(R(\[(-?\d+)\]|\{(\d+)\}))?(C(\[(-?\d+)\]|\{(\d+)\}))?$"#)
                    .expect("bad regex");
        }

        let captures = RC_REGEX
            .captures(s)
            .ok_or_else(|| A1Error::InvalidCellReference(s.to_string()))?;

        // These MUST be i64
        let relative_row: Option<Result<i64, _>> = captures.get(3).map(|g| {
            let s = g.as_str();
            s.parse().map_err(|_| A1Error::InvalidRow(s.to_string()))
        });
        let absolute_row: Option<Result<i64, _>> = captures.get(4).map(|g| {
            let s = g.as_str();
            s.parse().map_err(|_| A1Error::InvalidRow(s.to_string()))
        });

        // These MAY be u64
        let relative_col: Option<Result<i64, _>> = captures.get(7).map(|g| {
            let s = g.as_str();
            s.parse().map_err(|_| A1Error::InvalidRow(s.to_string()))
        });
        let absolute_col: Option<Result<i64, _>> = captures.get(8).map(|g| {
            let s = g.as_str();
            s.parse().map_err(|_| A1Error::InvalidRow(s.to_string()))
        });

        let row_is_absolute = absolute_row.is_some();
        let col_is_absolute = absolute_col.is_some();

        let row = match relative_row {
            Some(delta) => Some(crate::util::offset_cell_coord(base_pos.y, delta?)?),
            None => absolute_row.transpose()?,
        };

        let col = match relative_col {
            Some(delta) => Some(crate::util::offset_cell_coord(base_pos.x, delta?)?),
            None => absolute_col.transpose()?,
        };

        Ok((col, col_is_absolute, row, row_is_absolute))
    }

    /// Parses the components of a CellRefRangeEnd.
    ///
    /// If `base_pos` is `None`, then only A1 notation is accepted. If it is
    /// `Some`, then A1 and RC notation are both accepted.
    pub fn parse_start(s: &str, base_pos: Option<Pos>) -> Result<CellRefRangeEnd, A1Error> {
        let (col, col_is_absolute, row, row_is_absolute) = Self::parse_components(s, base_pos)?;
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
    ///
    /// If `base_pos` is `None`, then only A1 notation is accepted. If it is
    /// `Some`, then A1 and RC notation are both accepted.
    pub fn parse_end(s: &str, base_pos: Option<Pos>) -> Result<CellRefRangeEnd, A1Error> {
        let (col, col_is_absolute, row, row_is_absolute) = Self::parse_components(s, base_pos)?;
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

    /// Returns whether the range end is missing a row or column number.
    pub fn is_multi_range(self) -> bool {
        self.col.is_unbounded() || self.row.is_unbounded()
    }

    /// Toggles the absolute status of the range end.
    pub fn toggle_absolute(&mut self) {
        let col_abs = self.col.is_absolute;
        let row_abs = self.row.is_absolute;

        if !col_abs && !row_abs {
            // from A1 to $A$1
            self.col.is_absolute = true;
            self.row.is_absolute = true;
        } else if col_abs && row_abs {
            // from $A$1 to $A1
            self.col.is_absolute = true;
            self.row.is_absolute = false;
        } else if col_abs && !row_abs {
            // from $A1 to A$1
            self.col.is_absolute = false;
            self.row.is_absolute = true;
        } else if !col_abs && row_abs {
            // from A$1 to $A$1
            self.col.is_absolute = false;
            self.row.is_absolute = false;
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::grid::SheetId;

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
            CellRefRangeEnd::parse_start("C5", None).unwrap(),
            CellRefRangeEnd::new_relative_xy(3, 5),
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("$C$5", None).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_abs(3),
                row: CellRefCoord::new_abs(5),
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("C", None).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(3),
                row: CellRefCoord::REL_START,
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("5", None).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::REL_START,
                row: CellRefCoord::new_rel(5),
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("$5", None).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::ABS_START,
                row: CellRefCoord::new_abs(5),
            }
        );
    }

    #[test]
    fn test_parse_cell_ref_range_end_end() {
        assert_eq!(
            CellRefRangeEnd::parse_end("C5", None).unwrap(),
            CellRefRangeEnd::new_relative_xy(3, 5),
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("$C$5", None).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_abs(3),
                row: CellRefCoord::new_abs(5),
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("C", None).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(3),
                row: CellRefCoord::REL_UNBOUNDED,
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("5", None).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::REL_UNBOUNDED,
                row: CellRefCoord::new_rel(5),
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("$5", None).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::ABS_UNBOUNDED,
                row: CellRefCoord::new_abs(5),
            }
        );
    }

    #[test]
    fn test_parse_cell_ref_range_end_start_rc() {
        assert_eq!(
            CellRefRangeEnd::parse_start("R[-3]C[-2]", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd::new_relative_xy(3, 5),
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("R{5}C{3}", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_abs(3),
                row: CellRefCoord::new_abs(5),
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("C[-2]", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(3),
                row: CellRefCoord::REL_START,
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("R[-3]", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::REL_START,
                row: CellRefCoord::new_rel(5),
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_start("R{5}", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::REL_START,
                row: CellRefCoord::new_abs(5),
            }
        );
    }

    #[test]
    fn test_parse_cell_ref_range_end_end_rc() {
        assert_eq!(
            CellRefRangeEnd::parse_end("R[-3]C[-2]", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd::new_relative_xy(3, 5),
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("R{5}C{3}", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_abs(3),
                row: CellRefCoord::new_abs(5),
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("C[-2]", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::new_rel(3),
                row: CellRefCoord::REL_UNBOUNDED,
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("R[-3]", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::REL_UNBOUNDED,
                row: CellRefCoord::new_rel(5),
            }
        );
        assert_eq!(
            CellRefRangeEnd::parse_end("R{5}", Some(Pos::new(5, 8))).unwrap(),
            CellRefRangeEnd {
                col: CellRefCoord::REL_UNBOUNDED,
                row: CellRefCoord::new_abs(5),
            }
        );
    }

    #[test]
    fn test_parse_invalid_cell_ref_range_end_start() {
        assert!(CellRefRangeEnd::parse_start("$", None).is_err());
        assert!(CellRefRangeEnd::parse_start("$A$", None).is_err());
        assert!(CellRefRangeEnd::parse_start("", None).is_ok());
    }

    #[test]
    fn test_parse_invalid_cell_ref_range_end_end() {
        assert!(CellRefRangeEnd::parse_end("$", None).is_err());
        assert!(CellRefRangeEnd::parse_end("$A$", None).is_err());
        assert!(CellRefRangeEnd::parse_end("", None).is_ok());
    }

    #[test]
    fn test_parse_formula_string_as_cell_ref() {
        // This test ensures that formula strings are rejected early without
        // causing regex stack overflow in WASM. The formula contains characters
        // like '=', '(', ')', ',', '{', '}', ';' that are not valid in A1 notation.
        let formula = "=BYCOL({1,2;3,4}, LAMBDA(c, SUM(c)))";
        assert!(CellRefRangeEnd::parse_start(formula, None).is_err());
        assert!(CellRefRangeEnd::parse_end(formula, None).is_err());

        // Also test other invalid characters
        assert!(CellRefRangeEnd::parse_start("A1+B2", None).is_err());
        assert!(CellRefRangeEnd::parse_start("SUM(A1)", None).is_err());
        assert!(CellRefRangeEnd::parse_start("A1:B2", None).is_err()); // colon is handled at higher level
        assert!(CellRefRangeEnd::parse_start("Sheet1!A1", None).is_err()); // sheet ref handled at higher level
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
                row: CellRefCoord::REL_UNBOUNDED
            }
            .to_string(),
            "A"
        );
        assert_eq!(CellRefRangeEnd::new_infinite_col_end(1).to_string(), "A");
        assert_eq!(CellRefRangeEnd::new_infinite_col_end(1).to_string(), "A");
        assert_eq!(CellRefRangeEnd::new_infinite_row_end(1).to_string(), "1");
    }

    #[test]
    fn test_adjust() {
        let rel_only = RefAdjust {
            sheet_id: None,
            relative_only: true,
            dx: 1,
            dy: 2,
            x_start: 0,
            y_start: 0,
        };
        let all = RefAdjust {
            relative_only: false,
            ..rel_only
        };

        let init_rel = CellRefRangeEnd::new_relative_xy(1, 1);
        let init_abs = CellRefRangeEnd {
            col: CellRefCoord::new_abs(1),
            row: CellRefCoord::new_abs(1),
        };
        let expected_rel = CellRefRangeEnd::new_relative_xy(2, 3);
        let expected_abs = CellRefRangeEnd {
            col: CellRefCoord::new_abs(2),
            row: CellRefCoord::new_abs(3),
        };

        assert_eq!(Ok(expected_rel), init_rel.adjust(rel_only));
        assert_eq!(Ok(init_abs), init_abs.adjust(rel_only));
        assert_eq!(Ok(expected_rel), init_rel.adjust(all));
        assert_eq!(Ok(expected_abs), init_abs.adjust(all));
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

    #[test]
    fn test_adjust_column_row() {
        let sheet_id = SheetId::TEST;

        let ref_end = CellRefRangeEnd::new_relative_xy(2, 3);
        let res = ref_end.adjust(RefAdjust::new_insert_column(sheet_id, 2));
        assert_eq!(res.unwrap(), CellRefRangeEnd::new_relative_xy(3, 3));

        let ref_end = CellRefRangeEnd::new_relative_xy(2, 3);
        let res = ref_end.adjust(RefAdjust::new_insert_row(sheet_id, 2));
        assert_eq!(res.unwrap(), CellRefRangeEnd::new_relative_xy(2, 4));

        let ref_end = CellRefRangeEnd::new_relative_xy(2, 3);
        let res = ref_end.adjust(RefAdjust::new_insert_column(sheet_id, 3));
        assert_eq!(res.unwrap(), CellRefRangeEnd::new_relative_xy(2, 3));

        let ref_end = CellRefRangeEnd::new_relative_xy(2, 3);
        let res = ref_end.adjust(RefAdjust::new_insert_row(sheet_id, 4));
        assert_eq!(res.unwrap(), CellRefRangeEnd::new_relative_xy(2, 3));

        let ref_end = CellRefRangeEnd::new_relative_xy(1, 3);
        let res = ref_end.adjust(RefAdjust::new_delete_column(sheet_id, 1));
        res.unwrap_err();
        let res = ref_end.saturating_adjust(RefAdjust::new_delete_column(sheet_id, 1));
        assert_eq!(res, CellRefRangeEnd::new_relative_xy(1, 3));

        let ref_end = CellRefRangeEnd::new_relative_xy(UNBOUNDED, 3);
        let res = ref_end.adjust(RefAdjust::new_insert_row(sheet_id, 1));
        assert_eq!(res.unwrap(), CellRefRangeEnd::new_relative_xy(UNBOUNDED, 4));
    }

    #[test]
    fn test_toggle_absolute() {
        let mut cell_ref = CellRefRangeEnd::parse_start("A1", None).unwrap();

        // Initial state: A1
        assert!(!cell_ref.col.is_absolute);
        assert!(!cell_ref.row.is_absolute);

        // First toggle: $A$1
        cell_ref.toggle_absolute();
        assert!(cell_ref.col.is_absolute);
        assert!(cell_ref.row.is_absolute);

        // Second toggle: $A1
        cell_ref.toggle_absolute();
        assert!(cell_ref.col.is_absolute);
        assert!(!cell_ref.row.is_absolute);

        // Third toggle: A$1
        cell_ref.toggle_absolute();
        assert!(!cell_ref.col.is_absolute);
        assert!(cell_ref.row.is_absolute);

        // Fourth toggle: A1
        cell_ref.toggle_absolute();
        assert!(!cell_ref.col.is_absolute);
        assert!(!cell_ref.row.is_absolute);
    }
}
