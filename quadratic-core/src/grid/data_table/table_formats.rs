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
        let format = Format::combine(vec![self.table.as_ref(), column, cell.as_ref()]);
        if format.is_default() {
            None
        } else {
            Some(format)
        }
    }

    /// Sets the format for the given column and row in a table. Returns the
    /// undo for the change.
    pub fn set_format_cell(
        &mut self,
        column_index: usize,
        unsorted_row_index: i64,
        format: FormatUpdate,
    ) -> Option<FormatUpdate> {
        let column = self
            .cells
            .entry(column_index)
            .or_default();

        if let Some(mut cell) = column.get(unsorted_row_index) {
            let replace = cell.merge_update_into(&format);
            column.set(unsorted_row_index, Some(cell));
            Some(replace)
        } else {
            None
        }
    }

    /// Sets the format for the given column. Returns the undo for the change.
    pub fn set_format_column(
        &mut self,
        column_index: usize,
        format: FormatUpdate,
    ) -> Option<FormatUpdate> {
        let column = self
            .columns
            .entry(column_index)
            .or_default();
        let undo = column.merge_update_into(&format);
        if undo.is_default() {
            None
        } else {
            Some(undo)
        }
    }

    /// Sets the table format. Returns the undo for the change.
    pub fn set_format_table(&mut self, format: FormatUpdate) -> Option<FormatUpdate> {
        let mut table = self.table.clone().unwrap_or_default();
        let replace = table.merge_update_into(&format);
        if table.is_default() {
            self.table = None;
        } else {
            self.table = Some(table);
        }
        if !replace.is_default() {
            Some(replace)
        } else {
            None
        }
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

    #[test]
    #[parallel]
    fn test_set_format_cell() {
        let mut table_formats = TableFormats::default();
        assert_eq!(
            table_formats.set_format_cell(0, 0, FormatUpdate::default()),
            None
        );
    }
}
