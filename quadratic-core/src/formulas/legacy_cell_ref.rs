//! Cell references and ranges.
//!
//! TODO: We may want to refactor to replace the sheet_name with SheetId. We'll
//! have to convert back when displaying, but this will ensure that the Sheet
//! always stays properly referenced. We will also need to convert back for
//! non-Quadratic clipboard operations.

use std::fmt;
use std::str::FromStr;

use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::formulas::{escape_string, parse_sheet_name};
use crate::{Pos, a1::UNBOUNDED};

/// A reference to a cell or a range of cells.
///
/// TODO: replace with `CellRefRange`
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, TS)]
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

/// A reference to a single cell.
///
/// TODO: change this struct's relative/absolute distinction to match
/// `CellRefRangeEnd`
///
/// TODO: change `sheet` to a sheet ID instead of a name
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, TS)]
pub struct CellRef {
    pub sheet: Option<String>,
    pub x: CellRefCoord,
    pub y: CellRefCoord,
}
impl fmt::Display for CellRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { sheet, x, y } = self;
        if let Some(sheet) = sheet {
            write!(f, "{}!", escape_string(sheet))?;
        }

        write!(f, "R{y}C{x}")
    }
}

impl FromStr for CellRef {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (maybe_sheet, rest) = parse_sheet_name(s);

        lazy_static! {
            pub static ref CELL_REFERENCE_REGEX: Regex =
                Regex::new(r"([\[|\{]-?\d+[\]|\}])").unwrap();
        }

        let captures = CELL_REFERENCE_REGEX
            .captures_iter(&rest)
            .collect::<Vec<_>>();

        match (captures.first(), captures.get(1)) {
            (Some(row), Some(col)) => Ok(CellRef {
                sheet: maybe_sheet,
                x: CellRefCoord::from_str(col.get(0).map_or("0", |m| m.as_str()))?,
                y: CellRefCoord::from_str(row.get(0).map_or("0", |m| m.as_str()))?,
            }),
            _ => Err(()),
        }
    }
}

impl CellRef {
    /// Resolves the reference to a absolute coordinates, given the cell
    /// coordinate where evaluation is taking place.
    pub fn resolve_from(&self, base: Pos) -> Pos {
        Pos {
            x: self.x.resolve_from(base.x),
            y: self.y.resolve_from(base.y),
        }
    }

    /// Parses an A1-style cell reference relative to a given location.
    pub fn parse_a1(s: &str, mut base: Pos) -> Option<CellRef> {
        let (sheet, rest) = parse_sheet_name(s);

        lazy_static! {
            /// ^(\$?)(n?[A-Z]+)(\$?)(n?)(\d+)?$
            /// ^                             $     match full string
            ///  (\$?)                              group 1: optional `$`
            ///       (n?[A-Z]+)                    group 2: column name
            ///                 (\$?)               group 3: optional `$`
            ///                      (n?)           group 4: optional `n`
            ///                          (\d+)?     group 5: row number
            pub static ref A1_CELL_REFERENCE_REGEX: Regex =
                Regex::new(r"^(\$?)(n?[a-zA-Z]*)(\$?)(n?)(\d*)?$").unwrap();
        }

        let captures = A1_CELL_REFERENCE_REGEX.captures(rest.trim())?;

        let column_is_absolute = !captures[1].is_empty();
        let column_name = &captures[2];
        let mut col = crate::a1::column_from_name(column_name)? as i64;
        if col == 0 {
            col = UNBOUNDED;
            base.x = 0;
        }
        let col_ref = match column_is_absolute {
            true => CellRefCoord::Absolute(col),
            false => CellRefCoord::Relative(col - base.x),
        };
        let row_is_absolute = !captures[3].is_empty();
        let row_is_negative = !captures[4].is_empty();
        let mut row = captures.get(5).map_or(UNBOUNDED, |m| {
            m.as_str().parse::<i64>().unwrap_or(UNBOUNDED)
        });
        if row_is_negative {
            row = -row;
        }
        let row_ref = match row_is_absolute {
            true => CellRefCoord::Absolute(row),
            false => CellRefCoord::Relative(row - base.y),
        };

        Some(CellRef {
            sheet,
            x: col_ref,
            y: row_ref,
        })
    }
}

/// A reference to an x or y value within a CellRef
///
/// TODO: merge this with the other `CellRefCoord` (the one with boolean
/// `is_absolute`).
///
/// Note that this type stores a relative offset, while the other type stores an
/// absolute coordinate (and merely holds a flag that says whether it is
/// intended to be relative). **It should be impossible to convert between them
/// without a base coordinate from which to the resolve the reference.**
#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[serde(tag = "type", content = "coord")]
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
            CellRefCoord::Absolute(coord) => write!(f, "{{{coord}}}"),
        }
    }
}
impl FromStr for CellRefCoord {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        // IIFE to mimic try_block
        let maybe_relative = (|| s.strip_prefix('[')?.strip_suffix(']')?.parse().ok())();
        let maybe_absolute = (|| s.strip_prefix('{')?.strip_suffix('}')?.parse().ok())();

        match (maybe_relative, maybe_absolute) {
            (Some(delta), None) => Ok(Self::Relative(delta)),
            (None, Some(coord)) => Ok(Self::Absolute(coord)),
            _ => Err(()),
        }
    }
}
impl CellRefCoord {
    /// Resolves the reference to an absolute coordinate, given the cell
    /// coordinate where evaluation is taking place.
    pub(crate) fn resolve_from(self, base: i64) -> i64 {
        match self {
            CellRefCoord::Relative(delta) => i64::checked_add(base, delta).unwrap_or(UNBOUNDED),
            CellRefCoord::Absolute(coord) => coord,
        }
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

        for col in ["A", "B", "C", "AE", "QR", "A", "B", "QR"] {
            for row in ["99", "42", "2", "1", "0", "1", "2", "42", "99"] {
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
        let pos = CellRef::parse_a1("'Sheet 2'!A1", pos![A1]);
        assert_eq!(
            pos,
            Some(CellRef {
                sheet: Some("Sheet 2".to_string()),
                x: CellRefCoord::Relative(0),
                y: CellRefCoord::Relative(0),
            })
        );
        let pos = CellRef::parse_a1("\"Sheet 2\"!A1", pos![A1]);
        assert_eq!(
            pos,
            Some(CellRef {
                sheet: Some("Sheet 2".to_string()),
                x: CellRefCoord::Relative(0),
                y: CellRefCoord::Relative(0),
            })
        );
    }

    #[test]
    fn test_a1_column_parsing() {
        let pos = CellRef::parse_a1("A", pos![A0]);

        assert_eq!(
            pos,
            Some(CellRef {
                sheet: None,
                x: CellRefCoord::Relative(0),
                y: CellRefCoord::Relative(UNBOUNDED)
            })
        );
    }

    #[test]
    fn test_a1_row_parsing() {
        let pos = CellRef::parse_a1("2", pos![A0]);

        assert_eq!(
            pos,
            Some(CellRef {
                sheet: None,
                x: CellRefCoord::Relative(UNBOUNDED),
                y: CellRefCoord::Relative(2)
            })
        );
    }

    #[test]
    fn test_a1_case_insensitive_parsing() {
        let parse = |s: &str| CellRef::parse_a1(s, pos![A1]);

        assert_eq!(parse("a1"), parse("A1"));
        assert_eq!(parse("aa1"), parse("AA1"));
        assert_eq!(parse("Aa1"), parse("aA1"));
    }
}
