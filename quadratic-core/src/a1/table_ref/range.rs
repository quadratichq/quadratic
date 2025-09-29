//! ColumnRange and RowRange
//!
//! These are used to defined the range of columns within a table. Any table
//! reference may only have one list of column ranges.
//!
//! i64 is used to maintain compatibility with CellRefCoord.

use std::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::a1::TableMapEntry;

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub enum ColRange {
    All,
    Col(String),
    ColRange(String, String),
    ColToEnd(String),
}

impl ColRange {
    pub(crate) fn has_col(&self, col: i64, table: &TableMapEntry) -> bool {
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
            ColRange::ColToEnd(col_name) => {
                if let Some((start, end)) = table.try_col_range_to_end(col_name) {
                    return col >= start && col <= end;
                }
            }
        }
        false
    }

    pub(crate) fn replace_column_name(&mut self, old_name: &str, new_name: &str) {
        match self {
            ColRange::Col(col) => {
                if col.eq_ignore_ascii_case(old_name) {
                    *col = new_name.to_string();
                }
            }
            ColRange::ColRange(col1, col2) => {
                if col1.eq_ignore_ascii_case(old_name) {
                    *col1 = new_name.to_string();
                }
                if col2.eq_ignore_ascii_case(old_name) {
                    *col2 = new_name.to_string();
                }
            }
            ColRange::ColToEnd(col) => {
                if col.eq_ignore_ascii_case(old_name) {
                    *col = new_name.to_string();
                }
            }
            // ignore the ALL case
            _ => {}
        }
    }

    /// Returns the number of columns in the range.
    pub(crate) fn col_count(&self, table: &TableMapEntry) -> usize {
        match self {
            ColRange::All => table.visible_columns.len(),
            ColRange::Col(name) => {
                if table.try_col_index(name).is_some() {
                    1
                } else {
                    0
                }
            }
            ColRange::ColRange(start, end) => {
                if let Some((start_index, end_index)) = table.try_col_range(start, end) {
                    (end_index - start_index + 1) as usize
                } else {
                    0
                }
            }
            ColRange::ColToEnd(col) => {
                if let Some((start, end)) = table.try_col_range_to_end(col) {
                    (end - start + 1) as usize
                } else {
                    0
                }
            }
        }
    }
}

impl fmt::Display for ColRange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            ColRange::All => String::default(),
            ColRange::Col(col) => format!("[{col}]"),
            ColRange::ColRange(start, end) => format!("[{start}]:[{end}]"),
            ColRange::ColToEnd(col) => format!("[{col}]:"),
        };
        write!(f, "{s}")
    }
}

#[cfg(test)]
mod tests {
    use crate::{Rect, grid::CodeCellLanguage};

    use super::*;

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
        assert_eq!(ColRange::ColToEnd("B".to_string()).to_string(), "[B]:");
    }

    #[test]
    fn test_has_col() {
        let table = TableMapEntry::test(
            "test",
            &["A", "B", "C", "D"],
            None,
            Rect::test_a1("A1:E5"),
            CodeCellLanguage::Import,
        );

        // Test ColRange::All
        assert!(ColRange::All.has_col(0, &table));
        assert!(ColRange::All.has_col(4, &table));

        // Test ColRange::Col
        let col_b = ColRange::Col("B".to_string());
        assert!(!col_b.has_col(0, &table));
        assert!(col_b.has_col(1, &table));
        assert!(!col_b.has_col(2, &table));

        // Test ColRange::ColRange
        let col_range = ColRange::ColRange("B".to_string(), "D".to_string());
        assert!(!col_range.has_col(0, &table));
        assert!(col_range.has_col(1, &table));
        assert!(col_range.has_col(2, &table));
        assert!(col_range.has_col(3, &table));
        assert!(!col_range.has_col(4, &table));

        // Test ColRange::ColToEnd
        let col_to_end = ColRange::ColToEnd("C".to_string());
        assert!(!col_to_end.has_col(0, &table));
        assert!(!col_to_end.has_col(1, &table));
        assert!(col_to_end.has_col(2, &table));
        assert!(col_to_end.has_col(3, &table));
        assert!(!col_to_end.has_col(4, &table));

        // Test invalid column names
        assert!(!ColRange::Col("Z".to_string()).has_col(0, &table));
        assert!(!ColRange::ColRange("Y".to_string(), "Z".to_string()).has_col(0, &table));
        assert!(!ColRange::ColToEnd("Z".to_string()).has_col(0, &table));
    }

    #[test]
    fn test_col_count() {
        let table = TableMapEntry::test(
            "test",
            &["A", "B", "C", "D", "E"],
            None,
            Rect::test_a1("A1:E5"),
            CodeCellLanguage::Import,
        );

        // Test ColRange::All
        assert_eq!(ColRange::All.col_count(&table), 5);

        // Test ColRange::Col
        assert_eq!(ColRange::Col("A".to_string()).col_count(&table), 1);
        assert_eq!(ColRange::Col("C".to_string()).col_count(&table), 1);
        assert_eq!(ColRange::Col("E".to_string()).col_count(&table), 1);
        assert_eq!(ColRange::Col("Z".to_string()).col_count(&table), 0); // Invalid column

        // Test ColRange::ColRange
        assert_eq!(
            ColRange::ColRange("A".to_string(), "C".to_string()).col_count(&table),
            3
        );
        assert_eq!(
            ColRange::ColRange("B".to_string(), "E".to_string()).col_count(&table),
            4
        );
        assert_eq!(
            ColRange::ColRange("C".to_string(), "C".to_string()).col_count(&table),
            1
        );
        assert_eq!(
            ColRange::ColRange("Z".to_string(), "Y".to_string()).col_count(&table),
            0
        ); // Invalid columns

        // Test ColRange::ColToEnd
        assert_eq!(ColRange::ColToEnd("A".to_string()).col_count(&table), 5);
        assert_eq!(ColRange::ColToEnd("C".to_string()).col_count(&table), 3);
        assert_eq!(ColRange::ColToEnd("E".to_string()).col_count(&table), 1);
        assert_eq!(ColRange::ColToEnd("Z".to_string()).col_count(&table), 0); // Invalid column
    }
}
