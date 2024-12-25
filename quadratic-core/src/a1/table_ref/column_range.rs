//! ColumnRange and RowRange
//!
//! These are used to defined the range of columns and rows within a table. Any
//! table reference may only have one list of row ranges, and any number of
//! column ranges.
//!
//! We serialize/deserialize RowRangeEntry#End to -1 if equal to u64::MAX. This
//! is to ensure compatibility with JS.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::CellRefCoord;

#[derive(Clone, Debug, Eq, Hash, PartialEq, TS, Serialize, Deserialize)]
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

#[derive(Default, Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
pub enum RowRange {
    #[default]
    All,
    CurrentRow,
    Rows(Vec<RowRangeEntry>),
}

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
pub enum ColRange {
    Col(String),
    ColRange(String, String),
    ColumnToEnd(String),
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
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
            end: CellRefCoord::new_rel(i64::MAX),
        };
        let serialized = serde_json::to_string(&row_range).unwrap();
        assert_eq!(serialized, r#"{"start":1,"end":-1}"#);

        let deserialized: RowRangeEntry = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, row_range);

        let row_range = RowRangeEntry {
            start: CellRefCoord::new_rel(10),
            end: CellRefCoord::new_rel(15),
        };
        let serialized = serde_json::to_string(&row_range).unwrap();
        assert_eq!(serialized, r#"{"start":10,"end":15}"#);

        let deserialized: RowRangeEntry = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized, row_range);
    }
}
