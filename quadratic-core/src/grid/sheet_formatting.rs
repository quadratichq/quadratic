use std::collections::btree_map;

use serde::{Deserialize, Serialize};

use super::{Block, Contiguous2D, ContiguousBlocks, Format};
use crate::{CopyFormats, Pos};

#[derive(Serialize, Deserialize, Debug, Default, Clone, PartialEq)]
#[serde(default)]
pub struct SheetFormatting(Contiguous2D<Format>);
impl IntoIterator for SheetFormatting {
    type Item = (i64, Block<ContiguousBlocks<Format>>);
    type IntoIter = btree_map::IntoIter<i64, Block<ContiguousBlocks<Format>>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl FromIterator<(i64, Block<ContiguousBlocks<Format>>)> for SheetFormatting {
    fn from_iter<I: IntoIterator<Item = (i64, Block<ContiguousBlocks<Format>>)>>(iter: I) -> Self {
        Self(Contiguous2D::from_iter(iter))
    }
}
impl SheetFormatting {
    /// Returns the maximum value in the column for which formatting exists.
    pub fn column_max(&self, column: i64) -> Option<i64> {
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
    pub fn remove_column(&mut self, column: i64) -> ContiguousBlocks<Format> {
        self.0.remove_column(column)
    }

    /// Inserts a column and populates it with values.
    pub fn restore_column(&mut self, column: i64, values: ContiguousBlocks<Format>) {
        self.0.restore_column(column, Some(values));
    }

    /// Inserts a column and optionally populates it based on the column before
    /// or after it.
    pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
        self.0.insert_column(column, copy_formats);
    }

    /// Removes a row and returns the old values.
    pub fn remove_row(&mut self, row: i64) -> ContiguousBlocks<Format> {
        self.0.remove_row(row)
    }

    /// Inserts a row and populates it with values.
    pub fn restore_row(&mut self, row: i64, values: ContiguousBlocks<Format>) {
        self.0.restore_row(row, Some(values));
    }

    /// Inserts a row and optionally populates it based on the row before or
    /// after it.
    pub fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) {
        self.0.insert_row(row, copy_formats);
    }
}
