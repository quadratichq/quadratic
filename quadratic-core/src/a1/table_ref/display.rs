use crate::UNBOUNDED;

use super::*;

impl TableRef {
    /// Returns true if the table reference is the default table reference.
    pub fn is_default(&self) -> bool {
        self.data
            && !self.headers
            && !self.totals
            && self.row_ranges == RowRange::All
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
            start
        } else {
            format!("{}:{}", start, end)
        }
    }

    /// Returns the string representation of the row range.
    fn row_range_to_string(&self) -> String {
        match &self.row_ranges {
            RowRange::All => String::default(),
            RowRange::CurrentRow => "[#THIS ROW]".to_string(),
            RowRange::Rows(rows) => {
                format!(
                    "[#{}]",
                    rows.iter()
                        .map(TableRef::row_range_entry_to_string)
                        .collect::<Vec<String>>()
                        .join(",")
                )
            }
        }
    }

    fn col_range_entry_to_string(entry: &ColRange) -> String {
        match entry {
            ColRange::Col(col) => format!("[{}]", col),
            ColRange::ColRange(start, end) => format!("[{}:{}]", start, end),
            ColRange::ColumnToEnd(col) => format!("[{}:]", col),
        }
    }

    fn col_ranges_to_string(&self) -> Vec<String> {
        self.col_ranges
            .iter()
            .map(TableRef::col_range_entry_to_string)
            .collect::<Vec<String>>()
    }

    /// Returns the string representation of the table reference.
    pub fn to_string(&self) -> String {
        if self.is_default() {
            return self.table_name.to_string();
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
        entries.push(self.row_range_to_string());
        entries.extend(self.col_ranges_to_string());

        format!("{}[{}]", self.table_name.to_string(), entries.join(","))
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    #[test]
    fn test_to_string_only_table_name() {
        let names = vec!["Table1".to_string()];
        let table_ref = TableRef::parse("Table1", &names).unwrap_or_else(|e| {
            panic!("Failed to parse Table1: {}", e);
        });
        assert_eq!(table_ref.to_string(), "Table1");
    }

    #[test]
    fn test_to_string() {
        let names = vec!["Table1".to_string()];
        let tests = [
            "Table1[[#12:]]",
            "Table1[[#12:15]]",
            "Table1[[#12:]]",
            "Table1[[#ALL]]",
            "Table1[[#HEADERS],[#TOTALS]]",
            "Table1[[#HEADERS],[Column 1]]",
            "Table1[[#HEADERS],[Column 1],[Column 2]]",
            "Table1[[#HEADERS],[Column 1],[Column 2],[Column 3]:[Column 4],[Column 6]]",
            "Table1[[#DATA],[#HEADERS]][Column 1]]",
        ];

        for test in tests {
            let table_ref = TableRef::parse(test, &names)
                .unwrap_or_else(|e| panic!("Failed to parse {}: {}", test, e));
            assert_eq!(table_ref.to_string(), test, "{}", test);
        }
    }
}
