use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use super::Pos;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum RangeRef {
    RowRange(CellRefCoord, CellRefCoord),
    ColRange(CellRefCoord, CellRefCoord),
    CellRange(CellRef, CellRef),
    Cell(CellRef),
}
impl fmt::Display for RangeRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RangeRef::RowRange(start, end) => write!(f, "R{start}:R{end}"),
            RangeRef::ColRange(start, end) => write!(f, "C{start}:C{end}"),
            RangeRef::CellRange(start, end) => write!(f, "{start}:{end}"),
            RangeRef::Cell(cell) => write!(f, "{cell}"),
        }
    }
}
impl RangeRef {
    /// Returns the human-friendly string representing this range reference in
    /// A1-style notation.
    pub fn a1_string(self, base: Pos) -> String {
        match self {
            RangeRef::RowRange(start, end) => {
                format!(
                    "{}:{}",
                    start.a1_row_string(base.y),
                    end.a1_row_string(base.y),
                )
            }
            RangeRef::ColRange(start, end) => {
                format!(
                    "{}:{}",
                    start.a1_col_string(base.x),
                    end.a1_col_string(base.x),
                )
            }
            RangeRef::CellRange(start, end) => {
                format!("{}:{}", start.a1_string(base), end.a1_string(base))
            }
            RangeRef::Cell(cell) => cell.a1_string(base),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct CellRef {
    pub x: CellRefCoord,
    pub y: CellRefCoord,
}
impl fmt::Display for CellRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { x, y } = self;
        write!(f, "R{y}C{x}")
    }
}
impl CellRef {
    /// Constructs an absolute cell reference.
    pub fn absolute(pos: Pos) -> Self {
        Self {
            x: CellRefCoord::Absolute(pos.x),
            y: CellRefCoord::Absolute(pos.y),
        }
    }

    /// Resolves the reference to a absolute coordinates, given the cell
    /// coordinate where evaluation is taking place.
    pub fn resolve_from(self, base: Pos) -> Pos {
        Pos {
            x: self.x.resolve_from(base.x),
            y: self.y.resolve_from(base.y),
        }
    }
    /// Returns the human-friendly string representing this cell reference in
    /// A1-style notation.
    pub fn a1_string(self, base: Pos) -> String {
        let col = self.x.a1_col_string(base.x);
        let row = self.y.a1_row_string(base.y);
        format!("{col}{row}")
    }
    /// Returns the string representing this cell reference in RC-style
    /// notation.
    pub fn rc_string(self) -> String {
        self.to_string()
    }

    /// Parses an A1-style cell reference relative to a given location.
    pub fn parse_a1(s: &str, base: Pos) -> Option<CellRef> {
        lazy_static! {
            /// ^(\$?)(n?[A-Z]+)(\$?)(n?)(\d+)$
            /// ^                             $     match full string
            ///  (\$?)                              group 1: optional `$`
            ///       (n?[A-Z]+)                    group 2: column name
            ///                 (\$?)               group 3: optional `$`
            ///                      (n?)           group 4: optional `n`
            ///                          (\d+)      group 5: row number
            pub static ref A1_CELL_REFERENCE_REGEX: Regex =
                Regex::new(r#"^(\$?)(n?[A-Z]+)(\$?)(n?)(\d+)$"#).unwrap();
        }

        let captures = A1_CELL_REFERENCE_REGEX.captures(s)?;

        let column_is_absolute = !captures[1].is_empty();
        let column_name = &captures[2];
        let row_is_absolute = !captures[3].is_empty();
        let row_is_negative = !captures[4].is_empty();
        let row_number = &captures[5];

        let col = crate::util::column_from_name(column_name)?;
        let mut row = row_number.parse::<i64>().ok()?;
        if row_is_negative {
            row = -row;
        }

        let col_ref = if column_is_absolute {
            CellRefCoord::Absolute(col)
        } else {
            CellRefCoord::Relative(col - base.x)
        };
        let row_ref = if row_is_absolute {
            CellRefCoord::Absolute(row)
        } else {
            CellRefCoord::Relative(row - base.y)
        };

        Some(CellRef {
            x: col_ref,
            y: row_ref,
        })
    }

    /// Parses an RC-style cell reference.
    pub fn parse_rc(s: &str) -> Option<CellRef> {
        lazy_static! {
            /// ^R(.+?)C(.+)$
            /// ^           $       match full string
            ///   (.+?)             group 1: row reference (anything, non-greedily)
            ///         (.+)        group 2: column reference (anything)
            pub static ref RC_CELL_REFERENCE_REGEX: Regex =
                Regex::new(r#"^R(.+?)C(.+)$"#).unwrap();
        }

        let captures = RC_CELL_REFERENCE_REGEX.captures(s)?;

        Some(CellRef {
            x: captures[2].parse().ok()?,
            y: captures[1].parse().ok()?,
        })
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub enum CellRefCoord {
    Relative(i64),
    Absolute(i64),
}
impl Default for CellRefCoord {
    fn default() -> Self {
        Self::Relative(0)
    }
}
impl fmt::Display for CellRefCoord {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            CellRefCoord::Relative(delta) => write!(f, "[{delta}]"),
            CellRefCoord::Absolute(coord) => {
                if coord < 0 {
                    write!(f, "n{}", -coord)
                } else {
                    write!(f, "{coord}")
                }
            }
        }
    }
}
impl FromStr for CellRefCoord {
    type Err = std::num::ParseIntError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // IIFE to mimic try_block
        let maybe_relative = (|| s.strip_prefix('[')?.strip_suffix(']'))();
        if let Some(rel) = maybe_relative {
            Ok(Self::Relative(rel.parse()?))
        } else if let Some(neg_abs) = s.strip_prefix('n') {
            Ok(Self::Absolute(-neg_abs.parse()?))
        } else {
            Ok(Self::Absolute(s.parse()?))
        }
    }
}
impl CellRefCoord {
    /// Resolves the reference to an absolute coordinate, given the cell
    /// coordinate where evaluation is taking place.
    pub fn resolve_from(self, base: i64) -> i64 {
        match self {
            CellRefCoord::Relative(delta) => base + delta,
            CellRefCoord::Absolute(coord) => coord,
        }
    }
    /// Returns the `$` prefix if this is an absolute reference, or the empty
    /// string if it is a relative reference.
    fn prefix(self) -> &'static str {
        match self {
            CellRefCoord::Relative(_) => "",
            CellRefCoord::Absolute(_) => "$",
        }
    }
    /// Returns the A1 column string, prefixed with `n` if it is negative.
    fn a1_col_string(self, base: i64) -> String {
        let col = crate::util::column_name(self.resolve_from(base));
        format!("{}{col}", self.prefix())
    }
    /// Returns the A1 row string, prefixed with `n` if it is negative.
    fn a1_row_string(self, base: i64) -> String {
        let row = self.resolve_from(base);
        if row >= 0 {
            format!("{}{row}", self.prefix())
        } else {
            let row = -row;
            format!("{}n{row}", self.prefix())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_a1_cell_ref_parsing() {
        let a = CellRefCoord::Absolute;
        let r = CellRefCoord::Relative;

        let base_pos = pos![B4];
        let test_pairs = [
            //   ,   X     Y
            ("B4", (r(0), r(0))),
            ("C7", (r(1), r(3))),
            ("A2", (r(-1), r(-2))),
            ("A0", (r(-1), r(-4))),
            ("An1", (r(-1), r(-5))),
            ("nA2", (r(-2), r(-2))),
            ("nAA2", (r(-28), r(-2))),
            ("AB99", (r(26), r(95))),
            ("$B4", (a(1), r(0))),
            ("C$7", (r(1), a(7))),
            ("$A$2", (a(0), a(2))),
            ("$A0", (a(0), r(-4))),
            ("A$n1", (r(-1), a(-1))),
            ("$nA$2", (a(-1), a(2))),
            ("$nAA2", (a(-27), r(-2))),
            ("AB$99", (r(26), a(99))),
        ];

        for (string, (x, y)) in test_pairs {
            let expected = CellRef { x, y };
            println!("Checking that {string} = {expected}");
            assert_eq!(CellRef::parse_a1(string, base_pos), Some(expected));
            assert_eq!(string, expected.a1_string(base_pos));
        }
    }

    #[test]
    fn test_rc_cell_ref_parsing() {
        let range = -5..=5;
        let abs_or_rel = [CellRefCoord::Absolute, CellRefCoord::Relative];
        let test_cases = itertools::iproduct!(range.clone(), range, abs_or_rel, abs_or_rel)
            .map(|(x, y, f, g)| CellRef { x: f(x), y: g(y) });

        for cell_ref in test_cases {
            let string = cell_ref.rc_string();
            println!("Checking that {string} = {cell_ref}");
            assert_eq!(CellRef::parse_rc(&string), Some(cell_ref));
        }
    }
}
