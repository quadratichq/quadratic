use std::fmt;
use std::str::FromStr;

use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::Pos;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(tag = "type")]
pub enum RangeRef {
    // this is not yet used...
    RowRange {
        start: CellRefCoord,
        end: CellRefCoord,
        sheet: Option<String>,
    },
    // this is not yet used...
    ColRange {
        start: CellRefCoord,
        end: CellRefCoord,
        sheet: Option<String>,
    },
    CellRange {
        start: CellRef,
        end: CellRef,
    },
    Cell {
        pos: CellRef,
    },
}
impl fmt::Display for RangeRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RangeRef::RowRange { start, end, .. } => write!(f, "R{start}:R{end}"),
            RangeRef::ColRange { start, end, .. } => write!(f, "C{start}:C{end}"),
            RangeRef::CellRange { start, end } => write!(f, "{start}:{end}"),
            RangeRef::Cell { pos } => write!(f, "{pos}"),
        }
    }
}
impl From<CellRef> for RangeRef {
    fn from(pos: CellRef) -> Self {
        RangeRef::Cell { pos }
    }
}
impl RangeRef {
    /// Returns the human-friendly string representing this range reference in
    /// A1-style notation.
    pub fn a1_string(self, base: Pos) -> String {
        match self {
            RangeRef::RowRange { start, end, .. } => {
                format!("{}:{}", start.row_string(base.y), end.row_string(base.y))
            }
            RangeRef::ColRange { start, end, .. } => {
                format!("{}:{}", start.col_string(base.x), end.col_string(base.x))
            }
            RangeRef::CellRange { start, end } => {
                format!("{}:{}", start.a1_string(base), end.a1_string(base))
            }
            RangeRef::Cell { pos } => pos.a1_string(base),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
pub struct CellRef {
    pub sheet: Option<String>,
    pub x: CellRefCoord,
    pub y: CellRefCoord,
}
impl fmt::Display for CellRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { sheet, x, y } = self;
        if let Some(sheet) = sheet {
            write!(f, "'{}'!", crate::formulas::escape_string(sheet))?;
        }
        write!(f, "R{y}C{x}")
    }
}

impl CellRef {
    /// Constructs an absolute cell reference.
    pub fn absolute(sheet: Option<String>, pos: Pos) -> Self {
        Self {
            sheet,
            x: CellRefCoord::Absolute(pos.x),
            y: CellRefCoord::Absolute(pos.y),
        }
    }

    /// Resolves the reference to a absolute coordinates, given the cell
    /// coordinate where evaluation is taking place.
    pub fn resolve_from(&self, base: Pos) -> Pos {
        Pos {
            x: self.x.resolve_from(base.x),
            y: self.y.resolve_from(base.y),
        }
    }
    /// Returns the human-friendly string representing this cell reference in
    /// A1-style notation.
    pub fn a1_string(&self, base: Pos) -> String {
        let sheet_str = match &self.sheet {
            Some(sheet_name) => format!("{}!", crate::formulas::escape_string(sheet_name)),
            None => String::new(),
        };
        let col = self.x.col_string(base.x);
        let row = self.y.col_string(base.y);
        format!("{sheet_str}{col}{row}")
    }

    /// Parses an A1-style cell reference relative to a given location.
    pub fn parse_a1(mut s: &str, base: Pos) -> Option<CellRef> {
        let mut sheet = None;
        if let Some((sheet_name_str, rest)) = s.split_once('!') {
            s = rest;
            if sheet_name_str.starts_with(['\'', '"']) {
                sheet = crate::formulas::parse_string_literal(sheet_name_str.trim());
            } else {
                sheet = Some(sheet_name_str.trim().to_string());
            }
        }

        s = s.trim();

        lazy_static! {
            /// ^(\$?)(n?[A-Z]+)(\$?)(n?)(\d+)$
            /// ^                             $     match full string
            ///  (\$?)                              group 1: optional `$`
            ///       (n?[A-Z]+)                    group 2: column name
            ///                 (\$?)               group 3: optional `$`
            ///                      (n?)           group 4: optional `n`
            ///                          (\d+)      group 5: row number
            pub static ref A1_CELL_REFERENCE_REGEX: Regex =
                Regex::new(r"^(\$?)(n?[A-Z]+)(\$?)(n?)(\d+)$").unwrap();
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
            sheet,
            x: col_ref,
            y: row_ref,
        })
    }
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS))]
#[serde(tag = "type", content = "coord")]
// todo: this needs to be refactored to include sheet
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

    /// Returns whether the coordinate is relative (i.e., no '$' prefix).
    #[cfg(test)]
    fn is_relative(self) -> bool {
        match self {
            CellRefCoord::Relative(_) => true,
            CellRefCoord::Absolute(_) => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_a1_parsing() {
        // Resolve from some random base position.
        let base_pos = pos![E8];

        for col in ["A", "B", "C", "AE", "QR", "nA", "nB", "nQR"] {
            for row in ["n99", "n42", "n2", "n1", "0", "1", "2", "42", "99"] {
                for col_prefix in ["", "$"] {
                    for row_prefix in ["", "$"] {
                        let s = format!("{col_prefix}{col}{row_prefix}{row}");
                        let cell_ref =
                            CellRef::parse_a1(&s, base_pos).expect("invalid cell reference");
                        assert_eq!(cell_ref.x.is_relative(), col_prefix.is_empty());
                        assert_eq!(cell_ref.y.is_relative(), row_prefix.is_empty());
                        let pos = cell_ref.resolve_from(base_pos);
                        assert_eq!(format!("{col}{row}"), pos.a1_string());
                    }
                }
            }
        }
    }

    #[test]
    fn test_a1_sheet_parsing() {
        let pos = CellRef::parse_a1("'Sheet 2'!A0", crate::Pos::ORIGIN);
        assert_eq!(
            pos,
            Some(CellRef {
                sheet: Some("Sheet 2".to_string()),
                x: CellRefCoord::Relative(0),
                y: CellRefCoord::Relative(0),
            })
        );
        let pos = CellRef::parse_a1("\"Sheet 2\"!A0", crate::Pos::ORIGIN);
        assert_eq!(
            pos,
            Some(CellRef {
                sheet: Some("Sheet 2".to_string()),
                x: CellRefCoord::Relative(0),
                y: CellRefCoord::Relative(0),
            })
        );
    }
}
