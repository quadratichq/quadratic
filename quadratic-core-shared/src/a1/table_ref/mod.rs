//! A reference to data within a table.
//!
//! Table name rules:
//! - may not have spaces (spaces are replaced with underscores)
//! - maximum of 255 characters (TODO)
//! - must be unique across the .grid file
//!
//! Table references cannot use '', but do support double brackets and single
//! quote for special characters.
//!
//! Table references:
//! - Table1[Column Name] - reference only the data in that column
//! - Table1[[Column 1]:[Column 3]] - all data within the range of the columns
//! - Table1[[#ALL], [Column Name]] - column header and data
//! - Table1[#HEADERS] - only the table headers
//!   at the end of the table (also known as the footer)
//! - Table1[[#HEADERS], [#DATA]] - table headers and data across entire table
//! - Table1 or Table1[#DATA] - table data without headers or totals
//! - Table1[[Column1]:] - column 1 onward (Excel does not have this)
//! - (not yet supported) Table1[[#TOTALS], [Column 1]] - reference the total line
//!
//! Note Table1[#THIS ROW] and Table1[@Column 1] are not supported (supported in
//! Excel but not Google Sheets either)
//!
//! For purposes of data frames, we'll probably ignore #DATA, since we want to
//! define the data frame with the headers.
//!
//! When parsing, we first try to see if it references a table. If not, then we
//! try A1 parsing. This allows Table1 to be a proper reference, even though it
//! can also be parsed as A1 (with a large column offset).
//!
//! Double brackets allow escaping of special characters, eg,
//! DeptSalesFYSummary[[Total $ Amount]]
//!
//! Special characters that require [[ ]] are: comma, :, [, ], and @ (Excel
//! requires more characters to be escaped--Quadratic will still accept them
//! with or without the double bracket)
//!
//! Special characters can also be escaped within column names using a single
//! quote: [, ], @, #, and '.  For example: DeptSales['[No Idea why a left
//! bracket is needed here]
//!
//! The space character can be used to improve readability in a structured
//! reference. It is ignored in parsing: =DeptSales[ [Sales Person]:[Region] ]
//! =DeptSales[[#Headers], [#Data], [% Commission]]

mod convert;
mod delete;
pub mod display;
mod intersects;
mod parse;
mod query;
mod range;
mod tokenize;

pub use range::*;

use serde::{Deserialize, Serialize};

use crate::ArraySize;

use super::{A1Context, A1Error};

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
pub struct TableRef {
    pub table_name: String,
    pub data: bool,
    pub headers: bool,
    pub totals: bool,
    pub col_range: ColRange,
}

impl TableRef {
    pub fn new(table_name: &str) -> Self {
        Self {
            table_name: table_name.to_string(),
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::All,
        }
    }

    /// Replaces a table name in the range.
    pub fn replace_table_name(&mut self, old_name: &str, new_name: &str) {
        if self.table_name == old_name {
            self.table_name = new_name.to_string();
        }
    }

    /// Replaces a table column name in the range.
    pub fn replace_column_name(&mut self, table_name: &str, old_name: &str, new_name: &str) {
        if self.table_name == table_name && old_name != new_name {
            self.col_range.replace_column_name(old_name, new_name);
        }
    }

    /// Returns true if the table reference is a single cell.
    pub fn is_single_cell(&self, a1_context: &A1Context) -> bool {
        a1_context
            .try_table(&self.table_name)
            .is_some_and(|table| table.bounds.size() == ArraySize::_1X1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_ref_new() {
        let table_ref = TableRef::new("Table1");
        assert_eq!(
            table_ref,
            TableRef {
                table_name: "Table1".to_string(),
                data: true,
                headers: false,
                totals: false,
                col_range: ColRange::All,
            }
        );
    }
}
