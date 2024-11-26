use serde::{Deserialize, Serialize};

use super::{Contiguous2D, ContiguousBlocks, Format};
use crate::{CopyFormats, Pos};

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
#[serde(default)]
pub struct SheetFormatting(Contiguous2D<Format>);
impl SheetFormatting {
    /// Returns the maximum value in the column for which formatting exists.
    pub fn column_max(&self, column: u64) -> Option<u64> {
        self.0.column_max(column)
    }

    /// Returns all formatting values for a cell.
    pub fn get(&self, pos: Pos) -> Option<&Format> {
        self.0.get(pos)
    }
    /// Sets all formatting values for a cell.
    pub fn set(&mut self, pos: Pos, format: Option<Format>) -> Option<Format> {
        self.0.set(pos, format.filter(|f| !f.is_default()))
    }

    /// Removes a column and returns the old values.
    pub fn remove_column(&mut self, column: u64) -> ContiguousBlocks<Format> {
        self.0.remove_column(column)
    }

    /// Inserts a column and populates it with values.
    pub fn restore_column(&mut self, column: u64, values: ContiguousBlocks<Format>) {
        self.0.restore_column(column, Some(values));
    }

    /// Inserts a column and optionally populates it based on the column before
    /// or after it.
    pub fn insert_column(&mut self, column: u64, copy_formats: CopyFormats) {
        self.0.insert_column(column, copy_formats);
    }

    /// Removes a row and returns the old values.
    pub fn remove_row(&mut self, row: u64) -> ContiguousBlocks<Format> {
        self.0.remove_row(row)
    }

    /// Inserts a row and populates it with values.
    pub fn restore_row(&mut self, row: u64, values: ContiguousBlocks<Format>) {
        self.0.restore_row(row, Some(values));
    }

    /// Inserts a row and optionally populates it based on the row before or
    /// after it.
    pub fn insert_row(&mut self, row: u64, copy_formats: CopyFormats) {
        self.0.insert_row(row, copy_formats);
    }
}
