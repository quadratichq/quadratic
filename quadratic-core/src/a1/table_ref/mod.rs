//! A reference to data within a table.
//!
//! Table name rules:
//! - may not have spaces (TODO)
//! - maximum of 255 characters (TODO)
//! - must be unique across the .grid file
//!
//! Table references do not require ''
//!
//! Table references:
//! - Table1[Column Name] - reference only the data in that column
//! - Table1[[Column 1]:[Column 3]] - all data within the range of the columns
//! - Table1[[Column 1],[Column 3]] - all data within the list of columns
//! - (not yet supported) Table1[[Column 1] [Column 3]] - the intersection of
//!   two or more columns -- I don't understand this one
//! - Table1[[#ALL], [Column Name]] - column header and data
//! - Table1[#HEADERS] - only the table headers
//! - (not yet supported) Table1[#TOTALS] - reference the total line at the end
//!   of the table (also known as the footer)
//! - Table1[[#HEADERS], [#DATA]] - table headers and data across entire table
//! - Table1 or Table1[#DATA] - table data without headers or totals
//! - Table1[@Column Name] - data in column name at the same row as the code
//!   cell
//! - Table1[[#This Row],[Colum Name]] - dat in column name at the same row as
//!   cell
//!
//! For purposes of data frames, we'll probably ignore #DATA, since we want to
//! define the data frame with the headers.
//!
//! Quadratic extends the table reference to also allow specific rows within
//! columns. The row range may change based on the sort/filter of the column:
//! - Table1[[#10]] - all data in row 10
//! - Table1[[#12],[Column 1]]
//! - Table1[[#12:15],[Column 1]]
//! - Table1[[#12:],[Column 1]] - from row 12 to the end of the rows
//! - Table1[[#12,15],[Column 1]]
//! - Table1[[#12,14,20],[Column 1]:[Column 2]]
//! - (possibly support) Table1[#$12],[Column 1] - maintains reference to the
//!   absolute row 12, regardless of sorting/filtering
//! - Table1[[#LAST],[Column 1]] - last row in the table
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

mod column_range;
pub mod display;
pub mod parse;
mod tokenize;

pub use column_range::*;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::A1Error;

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
pub struct TableRef {
    pub table_name: String,
    pub data: bool,
    pub headers: bool,
    pub totals: bool,
    pub row_ranges: RowRange,
    pub col_ranges: Vec<ColRange>,
}
