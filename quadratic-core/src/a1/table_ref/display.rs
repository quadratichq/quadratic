//! Display TableRef as a string.

use std::fmt;

use super::*;

impl TableRef {
    /// Returns true if the table reference is the default table reference.
    pub(crate) fn is_default(&self) -> bool {
        self.data && !self.headers && !self.totals && self.col_range == ColRange::All
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
        if entries.is_empty() && matches!(self.col_range, ColRange::Col(_)) {
            write!(f, "{}{}", self.table_name, self.col_range)
        } else {
            let col = self.col_range.to_string();
            if !col.is_empty() {
                entries.push(col);
            }
            write!(f, "{}[{}]", self.table_name, entries.join(","))
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{Rect, a1::A1Context};

    use super::*;

    #[test]
    fn test_to_string_only_table_name() {
        let context = A1Context::test(&[], &[("Table1", &["A"], Rect::test_a1("A1"))]);
        let table_ref = TableRef::parse("Table1", &context).unwrap_or_else(|e| {
            panic!("Failed to parse Table1: {e}");
        });
        assert_eq!(table_ref.to_string(), "Table1");
    }

    #[test]
    fn test_to_string() {
        let context = A1Context::test(
            &[],
            &[(
                "Table1",
                &["Column 1", "Column 2", "Column 3", "Column 4"],
                Rect::test_a1("A1"),
            )],
        );
        let tests = [
            "Table1[Column 1]",
            "Table1[[#ALL]]",
            "Table1[[#HEADERS],[#TOTALS]]",
            "Table1[[#HEADERS],[Column 1]]",
            "Table1[[#HEADERS],[Column 3]:[Column 4]]",
            "Table1[[#HEADERS],[Column 3]:]",
            "Table1[[#DATA],[#HEADERS],[Column 1]]",
        ];

        for test in tests {
            let table_ref = TableRef::parse(test, &context)
                .unwrap_or_else(|e| panic!("Failed to parse {test}: {e}"));
            assert_eq!(table_ref.to_string(), test, "{test}");
        }
    }
}
