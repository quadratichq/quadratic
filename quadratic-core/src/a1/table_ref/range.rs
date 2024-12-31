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

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::a1::{CellRefCoord, TableMapEntry};

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

#[derive(Default, Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub enum RowRange {
    #[default]
    All,
    CurrentRow,
    Rows(Vec<RowRangeEntry>),
}

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub enum ColRange {
    Col(String),
    ColRange(String, String),
    ColumnToEnd(String),
}

impl ColRange {
    pub fn has_col(&self, col: i64, table: &TableMapEntry) -> bool {
        match self {
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

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::a1::UNBOUNDED;

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
}
