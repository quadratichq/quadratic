//! ColumnRange and RowRange
//!
//! These are used to defined the range of columns and rows within a table. Any
//! table reference may only have one list of row ranges, and any number of
//! column ranges.
//!
//! We serialize/deserialize RowRangeEntry#End to -1 if equal to UNBOUNDED
//! (i64::MAX). This is to ensure compatibility with JS.
//!
//! i64 is used to maintain compatibility with CellRefCoord.

use std::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::a1::{CellRefCoord, TableMapEntry, UNBOUNDED};

#[derive(Clone, Debug, Eq, Hash, PartialEq, TS, Serialize, Deserialize)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct RowRangeEntry {
    pub start: CellRefCoord,
    pub end: CellRefCoord,
}

impl RowRangeEntry {
    pub fn new_rel(start: i64, end: i64) -> Self {
        Self {
            start: CellRefCoord::new_rel(start),
            end: CellRefCoord::new_rel(end),
        }
    }

    pub fn new_abs(start: i64, end: i64) -> Self {
        Self {
            start: CellRefCoord::new_abs(start),
            end: CellRefCoord::new_abs(end),
        }
    }
}

impl fmt::Display for RowRangeEntry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = if self.start.coord == 1 && self.end.coord == UNBOUNDED {
            String::default()
        } else {
            let start = self.start.coord.to_string();
            let end = if self.end.coord == UNBOUNDED {
                String::default()
            } else {
                self.end.coord.to_string()
            };

            if start == end {
                format!("[#{}]", start)
            } else {
                format!("[#{}:{}]", start, end)
            }
        };
        write!(f, "{}", s)
    }
}

#[derive(Default, Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub enum RowRange {
    #[default]
    All,
    CurrentRow,
    Rows(RowRangeEntry),
}

impl RowRange {
    /// Returns a list of (start, end) pairs for the row range.
    pub fn to_rows(&self, current_row: i64, table: &TableMapEntry, headers: bool) -> (i64, i64) {
        match self {
            RowRange::All => {
                let y_start = table.bounds.min.y
                    + if !headers && table.show_headers && table.bounds.height() > 1 {
                        1
                    } else {
                        0
                    };
                (y_start, table.bounds.max.y)
            }
            RowRange::CurrentRow => (current_row, current_row),
            RowRange::Rows(ranges) => (
                table.bounds.min.y + ranges.start.coord - 1,
                table.bounds.min.y + ranges.end.coord - 1,
            ),
        }
    }
}

impl fmt::Display for RowRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match &self {
            RowRange::All => String::default(),
            RowRange::CurrentRow => "[#THIS ROW]".to_string(),
            RowRange::Rows(row) => row.to_string(),
        };

        write!(f, "{}", s)
    }
}

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub enum ColRange {
    All,
    Col(String),
    ColRange(String, String),
    ColumnToEnd(String),
}

impl ColRange {
    pub fn has_col(&self, col: i64, table: &TableMapEntry) -> bool {
        match self {
            ColRange::All => return true,
            ColRange::Col(table_col) => {
                if let Some(col_index) = table.try_col_index(table_col) {
                    return col_index == col;
                }
            }
            ColRange::ColRange(col1, col2) => {
                if let Some((col1_index, col2_index)) = table.try_col_range(col1, col2) {
                    return col >= col1_index && col <= col2_index;
                }
            }
            ColRange::ColumnToEnd(col_name) => {
                if let Some((start, end)) = table.try_col_range_to_end(col_name) {
                    return col >= start && col <= end;
                }
            }
        }
        false
    }
}

impl fmt::Display for ColRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            ColRange::All => String::default(),
            ColRange::Col(col) => format!("[{}]", col),
            ColRange::ColRange(start, end) => format!("[{}]:[{}]", start, end),
            ColRange::ColumnToEnd(col) => format!("[{}]:", col),
        };
        write!(f, "{}", s)
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{a1::UNBOUNDED, Rect};

    use super::*;

    #[test]
    fn test_row_range_entry_new() {
        let row_range = RowRangeEntry::new_rel(1, 15);
        assert_eq!(row_range.start, CellRefCoord::new_rel(1));
        assert_eq!(row_range.end, CellRefCoord::new_rel(15));
    }

    #[test]
    fn test_row_range_serialization() {
        let row_range = RowRangeEntry {
            start: CellRefCoord::new_rel(1),
            end: CellRefCoord::new_rel(UNBOUNDED),
        };
        let serialized = serde_json::to_string(&row_range).unwrap();
        assert_eq!(
            serialized,
            r#"{"start":{"coord":1,"is_absolute":false},"end":{"coord":-1,"is_absolute":false}}"#
        );

        let deserialized: RowRangeEntry = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, row_range);

        let row_range = RowRangeEntry {
            start: CellRefCoord::new_rel(10),
            end: CellRefCoord::new_rel(15),
        };
        let serialized = serde_json::to_string(&row_range).unwrap();
        assert_eq!(
            serialized,
            r#"{"start":{"coord":10,"is_absolute":false},"end":{"coord":15,"is_absolute":false}}"#
        );

        let deserialized: RowRangeEntry = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, row_range);
    }

    #[test]
    fn test_to_rows() {
        let table = TableMapEntry::test("test", &["A"], None, Rect::test_a1("A1:A5"));

        let row_range = RowRange::All;
        let rows = row_range.to_rows(1, &table, false);
        assert_eq!(rows, (2, 5));

        let row_range = RowRange::All;
        let rows = row_range.to_rows(1, &table, true);
        assert_eq!(rows, (1, 5));

        let row_range = RowRange::CurrentRow;
        let rows = row_range.to_rows(1, &table, false);
        assert_eq!(rows, (1, 1));
    }

    #[test]
    fn test_row_range_entry_to_string() {
        // Test single row
        let entry = RowRangeEntry::new_rel(5, 5);
        assert_eq!(entry.to_string(), "[#5]");

        // Test row range
        let entry = RowRangeEntry::new_rel(1, 5);
        assert_eq!(entry.to_string(), "[#1:5]");

        // Test unbounded range
        let entry = RowRangeEntry::new_rel(1, UNBOUNDED);
        assert_eq!(entry.to_string(), "");
    }

    #[test]
    fn test_row_range_to_string() {
        // Test All (default empty string)
        assert_eq!(RowRange::All.to_string(), "");

        // Test CurrentRow
        assert_eq!(RowRange::CurrentRow.to_string(), "[#THIS ROW]");

        // Test Rows variant
        let entry = RowRangeEntry::new_rel(1, 5);
        assert_eq!(RowRange::Rows(entry).to_string(), "[#1:5]");
    }

    #[test]
    fn test_col_range_to_string() {
        // Test All (default empty string)
        assert_eq!(ColRange::All.to_string(), "");

        // Test single column
        assert_eq!(ColRange::Col("A".to_string()).to_string(), "[A]");

        // Test column range
        assert_eq!(
            ColRange::ColRange("A".to_string(), "C".to_string()).to_string(),
            "[A]:[C]"
        );

        // Test column to end
        assert_eq!(ColRange::ColumnToEnd("B".to_string()).to_string(), "[B]:");
    }
}
