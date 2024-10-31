//! Tracks formatting for a Table. There are three levels of formatting (in order of precedence):
//! - Cells (tracked to the unsorted index)
//! - Columns
//! - Table

use crate::grid::{block::SameValue, formats::format::Format, ColumnData};
use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct TableFormats {
    pub table: Option<Format>,

    // Indexed by column index.
    pub columns: Vec<Format>,

    // Indexed by column index and then via RunLengthEncoding.
    // Note: index is unsorted index.
    pub cells: Vec<ColumnData<SameValue<Format>>>,
}
