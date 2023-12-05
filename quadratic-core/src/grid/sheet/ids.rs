use itertools::Itertools;

use crate::{
    controller::operation::Operation,
    grid::{CellRef, Column, ColumnId, IdMap, RegionRef, RowId},
    Pos, Rect,
};
use std::ops::Range;

use super::Sheet;

impl Sheet {
    /// Returns an iterator over each column and its X coordinate.
    pub fn iter_columns(&self) -> impl '_ + Iterator<Item = (i64, &Column)> {
        self.columns.iter().map(|(&x, column)| (x, column))
    }

    /// Returns an iterator over each row ID and its Y coordinate.
    pub fn iter_rows(&self) -> impl '_ + Iterator<Item = (i64, RowId)> {
        self.row_ids.iter()
    }

    /// Returns the position references by a `CellRef`.
    pub(crate) fn cell_ref_to_pos(&self, cell_ref: CellRef) -> Option<Pos> {
        Some(Pos {
            x: self.column_ids.index_of(cell_ref.column)?,
            y: self.row_ids.index_of(cell_ref.row)?,
        })
    }

    /// Creates a `CellRef` if the column and row already exist.
    pub(crate) fn try_get_cell_ref(&self, pos: Pos) -> Option<CellRef> {
        Some(CellRef {
            sheet: self.id,
            column: self.column_ids.id_at(pos.x)?,
            row: self.row_ids.id_at(pos.y)?,
        })
    }

    /// Creates a `CellRef`, creating the column and row if they do not already
    /// exist.
    pub(crate) fn get_or_create_cell_ref(&mut self, pos: Pos) -> (CellRef, Option<Vec<Operation>>) {
        let mut ops = vec![];
        let (column, operations) = self.get_or_create_column(pos.x);
        if let Some(operation) = operations {
            ops.push(operation);
        }
        let column_id = column.id;
        let (row_id, operations) = self.get_or_create_row(pos.y);
        if let Some(operation) = operations {
            ops.push(operation);
        }
        let cell_ref = CellRef {
            sheet: self.id,
            column: column_id,
            row: row_id,
        };
        if ops.is_empty() {
            (cell_ref, None)
        } else {
            (cell_ref, Some(ops))
        }
    }

    /// Returns the X coordinate of a column from its ID, or `None` if no such
    /// column exists.
    pub(crate) fn get_column_index(&self, column_id: ColumnId) -> Option<i64> {
        self.column_ids.index_of(column_id)
    }

    /// Returns the Y coordinate of a row from its ID, or `None` if no such row
    /// exists.
    pub(crate) fn get_row_index(&self, row_id: RowId) -> Option<i64> {
        self.row_ids.index_of(row_id)
    }

    /// Returns contiguous ranges of X coordinates from a list of column IDs.
    /// Ignores IDs for columns that don't exist.
    pub(crate) fn column_ranges(&self, column_ids: &[ColumnId]) -> Vec<Range<i64>> {
        let xs = column_ids
            .iter()
            .filter_map(|&id| self.get_column_index(id));
        contiguous_ranges(xs)
    }

    /// Returns contiguous ranges of Y coordinates from a list of row IDs.
    /// Ignores IDs for rows that don't exist.
    pub fn row_ranges(&self, row_ids: &[RowId]) -> Vec<Range<i64>> {
        row_ranges(row_ids, &self.row_ids)
    }

    /// Returns a list of rectangles that exactly covers a region. Ignores
    /// IDs for columns and rows that don't exist.
    pub(crate) fn region_rects(&self, region: &RegionRef) -> impl Iterator<Item = Rect> {
        let x_ranges = self.column_ranges(&region.columns);
        let y_ranges = self.row_ranges(&region.rows);
        itertools::iproduct!(x_ranges, y_ranges).map(|(xs, ys)| Rect::from_ranges(xs, ys))
    }

    /// Returns a region of the sheet and a vec of map row/column id operations, if needed.
    pub fn region(&mut self, rect: Rect) -> (RegionRef, Option<Vec<Operation>>) {
        let mut ops = vec![];
        let columns = rect
            .x_range()
            .map(|x| {
                let (column, operation) = self.get_or_create_column(x);
                if let Some(operation) = operation {
                    ops.push(operation);
                }
                column.id
            })
            .collect();
        let rows = rect
            .y_range()
            .map(|y| {
                let (row, operation) = self.get_or_create_row(y);
                if let Some(operation) = operation {
                    ops.push(operation);
                }
                row
            })
            .collect();

        let region_ref = RegionRef {
            sheet: self.id,
            columns,
            rows,
        };
        if ops.is_empty() {
            (region_ref, None)
        } else {
            (region_ref, Some(ops))
        }
    }

    /// Returns a region of the sheet, ignoring columns and rows which
    /// have no contents and no IDs.
    pub fn existing_region(&self, rect: Rect) -> RegionRef {
        let columns = rect
            .x_range()
            .filter_map(|x| self.get_column(x))
            .map(|col| col.id)
            .collect();
        let rows = rect.y_range().filter_map(|y| self.get_row(y)).collect();
        RegionRef {
            sheet: self.id,
            columns,
            rows,
        }
    }

    pub fn set_column_id(&mut self, column_id: ColumnId, index: i64) {
        self.column_ids.add(column_id, index);
    }

    pub fn set_row_id(&mut self, row_id: RowId, index: i64) {
        self.row_ids.add(row_id, index);
    }
}

fn contiguous_ranges(values: impl IntoIterator<Item = i64>) -> Vec<Range<i64>> {
    // Usually `values` is already sorted or nearly sorted, in which case this
    // is `O(n)`. At worst, it's `O(n log n)`.
    let mut ret: Vec<Range<i64>> = vec![];
    for i in values.into_iter().sorted() {
        match ret.last_mut() {
            Some(range) if range.end == i => range.end += 1,
            Some(range) if (*range).contains(&i) => continue,
            _ => ret.push(i..i + 1),
        }
    }
    ret
}

pub fn row_ranges(row_ids: &[RowId], id_map: &IdMap<RowId, i64>) -> Vec<Range<i64>> {
    let ys = row_ids.iter().filter_map(|&id| id_map.index_of(id));
    contiguous_ranges(ys)
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_cell_ref_pos() {
        let mut sheet = Sheet::test();
        let (cell_ref, operations) = sheet.get_or_create_cell_ref(Pos { x: 5, y: -5 });
        assert_eq!(sheet.cell_ref_to_pos(cell_ref), Some(Pos { x: 5, y: -5 }));
        assert_eq!(operations.unwrap().len(), 2);

        assert_eq!(sheet.try_get_cell_ref(Pos { x: 5, y: -5 }), Some(cell_ref));
        assert_eq!(sheet.try_get_cell_ref(Pos { x: 1, y: 2 }), None);
    }
}
