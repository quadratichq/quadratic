//! Display TableRef as a string.

use std::fmt;

use crate::a1::UNBOUNDED;

use super::*;

impl TableRef {
    /// Returns true if the table reference is the default table reference.
    pub fn is_default(&self) -> bool {
        self.data
            && !self.headers
            && !self.totals
            && self.row_range == RowRange::All
            && self.col_ranges.is_empty()
    }

    fn row_range_entry_to_string(entry: &RowRangeEntry) -> String {
        if entry.start.coord == 1 && entry.end.coord == UNBOUNDED {
            return String::default();
        }
        let start = entry.start.coord.to_string();
        let end = if entry.end.coord == UNBOUNDED {
            "".to_string()
        } else {
            entry.end.coord.to_string()
        };

        if start == end {
            format!("[#{}]", start)
        } else {
            format!("[#{}:{}]", start, end)
        }
    }

    /// Returns the string representation of the row range.
    fn row_range_to_string(&self) -> Vec<String> {
        match &self.row_range {
            RowRange::All => vec![],
            RowRange::CurrentRow => vec!["[#THIS ROW]".to_string()],
            RowRange::Rows(rows) => rows
                .iter()
                .map(TableRef::row_range_entry_to_string)
                .collect::<Vec<String>>(),
        }
    }

    fn col_range_entry_to_string(entry: &ColRange) -> String {
        match entry {
            ColRange::Col(col) => format!("[{}]", col),
            ColRange::ColRange(start, end) => format!("[{}]:[{}]", start, end),
            ColRange::ColumnToEnd(col) => format!("[{}]:", col),
        }
    }

    fn col_ranges_to_string(&self) -> Vec<String> {
        self.col_ranges
            .iter()
            .map(TableRef::col_range_entry_to_string)
            .collect::<Vec<String>>()
    }
}

impl fmt::Display for TableRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.is_default() {
            return write!(f, "{}", self.table_name);
        }

        let mut entries = vec![];

        // only show special markers if not default, which is #[DATA] only
        if !(self.data && !self.headers && !self.totals) {
            if self.headers && self.data && self.totals {
                entries.push("[#ALL]".to_string());
            } else {
                if self.data {
                    entries.push("[#DATA]".to_string());
                }
                if self.headers {
                    entries.push("[#HEADERS]".to_string());
                }
                if self.totals {
                    entries.push("[#TOTALS]".to_string());
                }
            }
        }
        entries.extend(self.row_range_to_string());
        entries.extend(self.col_ranges_to_string());

        write!(f, "{}[{}]", self.table_name, entries.join(","))
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use crate::{a1::A1Context, Rect};

    use super::*;

    #[test]
    fn test_to_string_only_table_name() {
        let context = A1Context::test(&[], &[("Table1", &["A"], Rect::test_a1("A1"))]);
        let table_ref = TableRef::parse("Table1", &context).unwrap_or_else(|e| {
            panic!("Failed to parse Table1: {}", e);
        });
        assert_eq!(table_ref.to_string(), "Table1");
    }

    #[test]
    fn test_to_string() {
        let context = A1Context::test(&[], &[("Table1", &["A"], Rect::test_a1("A1"))]);
        let tests = [
            "Table1[[#12:]]",
            "Table1[[#12:15]]",
            "Table1[[#12:]]",
            "Table1[[#ALL]]",
            "Table1[[#HEADERS],[#TOTALS]]",
            "Table1[[#HEADERS],[Column 1]]",
            "Table1[[#HEADERS],[Column 1],[Column 2]]",
            "Table1[[#HEADERS],[Column 1],[Column 2],[Column 3]:[Column 4],[Column 6]]",
            "Table1[[#DATA],[#HEADERS],[Column 1]]",
        ];

        for test in tests {
            let table_ref = TableRef::parse(test, &context)
                .unwrap_or_else(|e| panic!("Failed to parse {}: {}", test, e));
            assert_eq!(table_ref.to_string(), test, "{}", test);
        }
    }
}
