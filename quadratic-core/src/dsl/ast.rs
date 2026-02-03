//! AST node types for the Quadratic DSL

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Top-level DSL document containing multiple statements
#[derive(Debug, Clone, PartialEq)]
pub struct DslDocument {
    pub statements: Vec<DslStatement>,
}

/// A single statement in the DSL
#[derive(Debug, Clone, PartialEq)]
pub enum DslStatement {
    /// Single cell: `cell A1: value {format}`
    Cell(CellStatement),
    /// Simple grid: `grid at A1 [rows...]`
    Grid(GridStatement),
    /// Named table: `table "name" at A1 {...}`
    Table(TableStatement),
    /// Code cell: `python at A1 {...}` or `javascript at A1 {...}`
    CodeCell(CodeCellStatement),
    /// Range format: `format A1:B10 {...}`
    Format(FormatStatement),
}

/// Single cell statement
#[derive(Debug, Clone, PartialEq)]
pub struct CellStatement {
    pub position: CellPosition,
    pub value: DslValue,
    pub format: Option<DslFormat>,
}

/// Grid statement (simple data layout without table semantics)
#[derive(Debug, Clone, PartialEq)]
pub struct GridStatement {
    pub position: CellPosition,
    pub orientation: Orientation,
    pub rows: Vec<GridRow>,
}

/// A row in a grid, with optional format
#[derive(Debug, Clone, PartialEq)]
pub struct GridRow {
    pub values: Vec<DslValue>,
    pub format: Option<DslFormat>,
}

/// Named table statement
#[derive(Debug, Clone, PartialEq)]
pub struct TableStatement {
    pub name: String,
    pub position: CellPosition,
    pub orientation: Orientation,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<DslValue>>,
    pub formats: TableFormats,
}

/// Formats for a table
#[derive(Debug, Clone, PartialEq, Default)]
pub struct TableFormats {
    /// Format for header row/column
    pub headers: Option<DslFormat>,
    /// Format by column name
    pub columns: Vec<(String, DslFormat)>,
}

/// Code cell statement
#[derive(Debug, Clone, PartialEq)]
pub struct CodeCellStatement {
    pub position: CellPosition,
    pub language: CodeLanguage,
    pub code: String,
}

/// Supported code languages
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CodeLanguage {
    Python,
    Javascript,
}

/// Range format statement
#[derive(Debug, Clone, PartialEq)]
pub struct FormatStatement {
    pub range: CellRange,
    pub format: DslFormat,
}

/// Cell position (e.g., "A1", "B2")
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CellPosition {
    pub col: i64,
    pub row: i64,
}

impl CellPosition {
    pub fn new(col: i64, row: i64) -> Self {
        Self { col, row }
    }

    /// Parse a cell position from a string like "A1", "B2", "AA100"
    pub fn parse(s: &str) -> Option<Self> {
        let s = s.trim().to_uppercase();
        if s.is_empty() {
            return None;
        }

        let mut col_str = String::new();
        let mut row_str = String::new();

        for c in s.chars() {
            if c.is_ascii_alphabetic() {
                if !row_str.is_empty() {
                    return None; // Letters after numbers
                }
                col_str.push(c);
            } else if c.is_ascii_digit() {
                row_str.push(c);
            } else {
                return None; // Invalid character
            }
        }

        if col_str.is_empty() || row_str.is_empty() {
            return None;
        }

        // Convert column letters to 0-based index (A=0, B=1, ..., Z=25, AA=26, etc.)
        let col = col_str
            .chars()
            .fold(0i64, |acc, c| acc * 26 + (c as i64 - 'A' as i64) + 1)
            - 1;

        // Convert row to 0-based index
        let row = row_str.parse::<i64>().ok()? - 1;

        if row < 0 {
            return None;
        }

        Some(Self { col, row })
    }
}

/// Cell range (e.g., "A1:B10", "B:B", "5:5")
#[derive(Debug, Clone, PartialEq)]
pub enum CellRange {
    /// Specific range: A1:B10
    Range { start: CellPosition, end: CellPosition },
    /// Entire column: B:B
    Column { col: i64 },
    /// Entire row: 5:5
    Row { row: i64 },
}

impl CellRange {
    /// Parse a range from a string like "A1:B10", "B:B", "5:5"
    pub fn parse(s: &str) -> Option<Self> {
        let s = s.trim().to_uppercase();

        if let Some((left, right)) = s.split_once(':') {
            // Check if it's a column range (B:B)
            if left.chars().all(|c| c.is_ascii_alphabetic())
                && right.chars().all(|c| c.is_ascii_alphabetic())
            {
                let col = left
                    .chars()
                    .fold(0i64, |acc, c| acc * 26 + (c as i64 - 'A' as i64) + 1)
                    - 1;
                return Some(CellRange::Column { col });
            }

            // Check if it's a row range (5:5)
            if left.chars().all(|c| c.is_ascii_digit())
                && right.chars().all(|c| c.is_ascii_digit())
            {
                let row = left.parse::<i64>().ok()? - 1;
                return Some(CellRange::Row { row });
            }

            // It's a cell range (A1:B10)
            let start = CellPosition::parse(left)?;
            let end = CellPosition::parse(right)?;
            return Some(CellRange::Range { start, end });
        }

        None
    }
}

/// Orientation for grids and tables
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Orientation {
    /// Headers on top, data going down (default)
    #[default]
    Rows,
    /// Headers on left, data going right
    Columns,
}

/// A value in the DSL
#[derive(Debug, Clone, PartialEq)]
pub enum DslValue {
    /// Empty cell
    Blank,
    /// Text string
    Text(String),
    /// Numeric value
    Number(Decimal),
    /// Boolean value
    Boolean(bool),
    /// Formula (starts with =)
    Formula(String),
}

/// Format properties for cells
#[derive(Debug, Clone, PartialEq, Default)]
pub struct DslFormat {
    // Text styling
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub strikethrough: Option<bool>,
    pub font_size: Option<u32>,

    // Colors (hex strings like "#ff0000")
    pub color: Option<String>,
    pub background: Option<String>,

    // Alignment
    pub align: Option<HorizontalAlign>,
    pub valign: Option<VerticalAlign>,

    // Number format
    pub number_format: Option<NumberFormat>,
    pub decimals: Option<u8>,

    // Borders
    pub border: Option<bool>,
    pub border_top: Option<bool>,
    pub border_bottom: Option<bool>,
    pub border_left: Option<bool>,
    pub border_right: Option<bool>,

    // Sizing
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Horizontal alignment
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HorizontalAlign {
    Left,
    Center,
    Right,
}

/// Vertical alignment
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerticalAlign {
    Top,
    Middle,
    Bottom,
}

/// Number format type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NumberFormat {
    Currency,
    Percent,
    Number,
    Date,
    DateTime,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_position_parse() {
        assert_eq!(CellPosition::parse("A1"), Some(CellPosition::new(0, 0)));
        assert_eq!(CellPosition::parse("B2"), Some(CellPosition::new(1, 1)));
        assert_eq!(CellPosition::parse("Z1"), Some(CellPosition::new(25, 0)));
        assert_eq!(CellPosition::parse("AA1"), Some(CellPosition::new(26, 0)));
        assert_eq!(CellPosition::parse("AB1"), Some(CellPosition::new(27, 0)));
        assert_eq!(
            CellPosition::parse("AZ100"),
            Some(CellPosition::new(51, 99))
        );

        // Invalid cases
        assert_eq!(CellPosition::parse(""), None);
        assert_eq!(CellPosition::parse("A"), None);
        assert_eq!(CellPosition::parse("1"), None);
        assert_eq!(CellPosition::parse("A0"), None);
        assert_eq!(CellPosition::parse("1A"), None);
    }

    #[test]
    fn test_cell_range_parse() {
        // Cell range
        assert_eq!(
            CellRange::parse("A1:B10"),
            Some(CellRange::Range {
                start: CellPosition::new(0, 0),
                end: CellPosition::new(1, 9)
            })
        );

        // Column range
        assert_eq!(CellRange::parse("B:B"), Some(CellRange::Column { col: 1 }));
        assert_eq!(CellRange::parse("AA:AA"), Some(CellRange::Column { col: 26 }));

        // Row range
        assert_eq!(CellRange::parse("5:5"), Some(CellRange::Row { row: 4 }));
        assert_eq!(CellRange::parse("100:100"), Some(CellRange::Row { row: 99 }));
    }
}
