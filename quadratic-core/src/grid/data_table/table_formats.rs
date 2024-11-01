//! Tracks formatting for a Table. There are three levels of formatting (in order of precedence):
//! - Cells (tracked to the unsorted index)
//! - Columns
//! - Table

use std::collections::HashMap;

use crate::grid::{
    block::SameValue,
    formats::{format::Format, format_update::FormatUpdate},
    ColumnData,
};
use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct TableFormats {
    pub table: Option<Format>,

    // Indexed by column index.
    pub columns: HashMap<usize, Format>,

    // Indexed by column index and then via RunLengthEncoding.
    // Note: index is unsorted index.
    pub cells: HashMap<usize, ColumnData<SameValue<Format>>>,
}

impl TableFormats {
    /// Returns the format for the given column and row in a table.
    pub fn format(&self, column_index: usize, unsorted_row_index: i64) -> Option<Format> {
        let cell = self
            .cells
            .get(&column_index)
            .and_then(|value| value.get(unsorted_row_index));
        let column = self.columns.get(&column_index);
        let format = Format::combine(cell.as_ref(), column, None, self.table.as_ref());
        if format.is_default() {
            None
        } else {
            Some(format)
        }
    }

    /// Sets the format for the given column and row in a table.
    pub fn set_format_cell(
        &mut self,
        column_index: usize,
        unsorted_row_index: i64,
        format: FormatUpdate,
    ) -> Option<FormatUpdate> {
        let column = self
            .cells
            .entry(column_index)
            .or_insert_with(ColumnData::default);

        if let Some(cell) = column.get(unsorted_row_index) {
            let replace = cell.merge_update_into(&format);
            column.set(unsorted_row_index, Some(replace.to_replace()));
            Some(replace)
        } else {
            None
        }
        //     .get(unsorted_row_index)
        //     .unwrap_or_default()
        //     .merge_update_into(&format);
        // self.cells
        //     .entry(column_index)
        //     .or_insert_with(ColumnData::default)
        //     .set(unsorted_row_index, Some(new_format.to_replace()))
        //     .map(|f| FormatUpdate::from(f))
    }

    /// Sets the format for the given column.
    pub fn set_format_column(
        &mut self,
        column_index: usize,
        format: Option<FormatUpdate>,
    ) -> Option<FormatUpdate> {
        self.columns
            .insert(column_index, format)
            .map(|f| FormatUpdate::from(f))
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_format() {
        let table_formats = TableFormats::default();
        assert_eq!(table_formats.format(0, 0), None);
    }
}

// need to redo serialization for formats
