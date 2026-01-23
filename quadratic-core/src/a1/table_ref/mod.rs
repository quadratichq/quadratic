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
use ts_rs::TS;

use crate::{ArraySize, grid::TableId};

use super::{A1Context, A1Error};

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
pub struct TableRef {
    pub table_id: TableId,
    pub data: bool,
    pub headers: bool,
    pub totals: bool,
    pub col_range: ColRange,
}

impl TableRef {
    /// Creates a new TableRef from a table_id.
    pub fn new(table_id: TableId) -> Self {
        Self {
            table_id,
            data: true,
            headers: false,
            totals: false,
            col_range: ColRange::All,
        }
    }

    /// Creates a TableRef from a table name by looking it up in the context.
    /// Returns None if the table is not found.
    pub fn from_name(table_name: &str, a1_context: &A1Context) -> Option<Self> {
        let table_id = a1_context.table_map.try_table_id(table_name)?;
        Some(Self::new(table_id))
    }

    /// Returns the table name by looking up the table_id in the context.
    /// Returns None if the table is not found.
    pub fn table_name<'a>(&self, a1_context: &'a A1Context) -> Option<&'a str> {
        a1_context
            .table_map
            .try_table_by_id(self.table_id)
            .map(|entry| entry.table_name.as_str())
    }

    /// Replaces a table column name in the range.
    pub fn replace_column_name(&mut self, table_id: TableId, old_name: &str, new_name: &str) {
        if self.table_id == table_id && old_name != new_name {
            self.col_range.replace_column_name(old_name, new_name);
        }
    }

    /// Returns true if the table reference is a single cell.
    pub fn is_single_cell(&self, a1_context: &A1Context) -> bool {
        a1_context
            .table_map
            .try_table_by_id(self.table_id)
            .is_some_and(|table| table.bounds.size() == ArraySize::_1X1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_ref_new() {
        let table_id = TableId::new();
        let table_ref = TableRef::new(table_id);
        assert_eq!(
            table_ref,
            TableRef {
                table_id,
                data: true,
                headers: false,
                totals: false,
                col_range: ColRange::All,
            }
        );
    }

    #[test]
    fn test_table_ref_from_name() {
        use crate::Rect;
        let context = A1Context::test(&[], &[("Table1", &["A", "B"], Rect::test_a1("A1:B2"))]);
        let table_ref = TableRef::from_name("Table1", &context).unwrap();
        assert_eq!(table_ref.table_name(&context), Some("Table1"));
    }
}
