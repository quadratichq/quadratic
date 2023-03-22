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
                format!("{}:{}", start.row_string(base.y), end.row_string(base.y))
            }
            RangeRef::ColRange(start, end) => {
                format!("{}:{}", start.col_string(base.x), end.col_string(base.x))
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
        let col = self.x.col_string(base.x);
        let row = self.y.col_string(base.y);
        format!("{col}{row}")
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
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // IIFE to mimic try_block
        let maybe_relative = (|| s.strip_prefix('[')?.strip_suffix(']')?.parse().ok())();
        if let Some(rel) = maybe_relative {
            Ok(Self::Relative(rel))
        } else if let Ok(abs) = s.parse() {
            Ok(Self::Absolute(abs))
        } else {
            Err(())
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
    /// Returns the human-friendly string representing this coordinate, if it is
    /// a column coordinate.
    fn col_string(self, base: i64) -> String {
        let col = crate::util::column_name(self.resolve_from(base));
        format!("{}{col}", self.prefix())
    }
    /// Returns the human-friendly string representing this coordinate, if it is
    /// a row coordinate.
    fn row_string(self, base: i64) -> String {
        let row = self.resolve_from(base);
        format!("{}{row}", self.prefix())
    }
}
