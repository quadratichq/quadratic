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
//! - (not yet supported) Table1[[#TOTALS][Column 1]] - reference the total line
//!   at the end of the table (also known as the footer)
//! - Table1[[#HEADERS], [#DATA]] - table headers and data across entire table
//! - Table1 or Table1[#DATA] - table data without headers or totals
//! - Table1[@Column Name] - data in column name at the same row as the code
//!   cell
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
pub mod display;
mod intersects;
mod parse;
mod query;
mod range;
mod tokenize;

pub use range::*;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::A1Error;

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
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
}

#[cfg(test)]
#[serial_test::parallel]
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
