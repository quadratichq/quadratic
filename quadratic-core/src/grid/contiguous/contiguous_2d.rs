// todo: fix this
#![allow(non_local_definitions)]

use std::collections::btree_map;

use crate::{CopyFormats, Pos};

use serde::{Deserialize, Serialize};

use super::{block::Block, contiguous_blocks::ContiguousBlocks};

/// Key-value store from cell positions to values, optimized for contiguous
/// rectangles with the same value, particularly along columns. All (infinitely
/// many) values are initialized to default.
///
/// Supports infinite blocks down, right, and down-right.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct Contiguous2D<T>(
    #[serde(bound = "T: Serialize + for<'a> Deserialize<'a>")] // shouldn't serde infer this?
    ContiguousBlocks<ContiguousBlocks<T>>,
);
impl<T> Default for Contiguous2D<T> {
    fn default() -> Self {
        Self(ContiguousBlocks::default())
    }
}
impl<T> IntoIterator for Contiguous2D<T> {
    type Item = (i64, Block<ContiguousBlocks<T>>);
    type IntoIter = btree_map::IntoIter<i64, Block<ContiguousBlocks<T>>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl<T> FromIterator<(i64, Block<ContiguousBlocks<T>>)> for Contiguous2D<T> {
    fn from_iter<I: IntoIterator<Item = (i64, Block<ContiguousBlocks<T>>)>>(iter: I) -> Self {
        Self(ContiguousBlocks::from_iter(iter))
    }
}
impl<T: Clone + PartialEq> Contiguous2D<T> {
    /// Constructs an empty map.
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns whether the whole sheet is default.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Returns a single formatting value.
    pub fn get(&self, pos: Pos) -> Option<&T> {
        self.0.get(pos.x)?.get(pos.y)
    }

    /// Sets a single formatting value and returns the old one.
    pub fn set(&mut self, pos: Pos, value: Option<T>) -> Option<T> {
        self.set_rect(pos.x, pos.y, Some(pos.x), Some(pos.y), value)
            .0
            .into_values()
            .next()?
            .value
            .into_values()
            .next()?
            .value
    }

    /// Sets values from `other`, and returns the blocks to set to undo it.
    pub fn set_from(&mut self, other: Contiguous2D<Option<T>>) -> Contiguous2D<Option<T>> {
        Contiguous2D(
            self.0
                .update_from_blocks(other.0, |old_column, new_column| {
                    let mut current_column = old_column.unwrap_or_default();
                    let reverse_data = current_column
                        .update_from_blocks(new_column.clone(), |old, new| (new.clone(), old));
                    (
                        (!current_column.is_empty()).then_some(current_column),
                        reverse_data,
                    )
                }),
        )
    }

    /// Sets a rectangle to the same value and returns the blocks to set undo
    /// it.
    ///
    /// All coordinates are inclusive.
    ///
    /// If `x2` or `y2` are `None`, the rectangle is infinite in that direction.
    pub fn set_rect(
        &mut self,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
        value: Option<T>,
    ) -> Contiguous2D<Option<T>> {
        self.set_from(Contiguous2D(ContiguousBlocks::from_block(Block {
            start: x1,
            end: x2.unwrap_or(i64::MAX).saturating_add(1),
            value: ContiguousBlocks::from_block(Block {
                start: y1,
                end: y2.unwrap_or(i64::MAX).saturating_add(1),
                value,
            }),
        })))
    }
    /// Helper fn to set a range of columns to a single value.
    pub fn set_columns(
        &mut self,
        column_start: i64,
        column_end: i64,
        value: Option<T>,
    ) -> Contiguous2D<Option<T>> {
        self.set_rect(column_start, 1, Some(column_end), None, value)
    }
    /// Helper fn to set a range of rows to a single value.
    pub fn set_rows(
        &mut self,
        row_start: i64,
        row_end: i64,
        value: Option<T>,
    ) -> Contiguous2D<Option<T>> {
        self.set_rect(1, row_start, None, Some(row_end), value)
    }
    /// Helper fn to set the whole sheet to a single value.
    pub fn set_sheet(&mut self, value: Option<T>) -> Contiguous2D<Option<T>> {
        self.set_rect(1, 1, None, None, value)
    }
    /// Returns the upper bound on the values in the given column, or `None` if
    /// it is unbounded. Returns 0 if there are no values.
    pub fn column_max(&self, column: i64) -> Option<i64> {
        match self.0.get(column) {
            Some(column_data) => column_data.max(),
            None => Some(0),
        }
    }

    /// Removes a column and returns the values that used to inhabit it.
    pub fn remove_column(&mut self, column: i64) -> ContiguousBlocks<T> {
        self.0.shift_remove(column).unwrap_or_default()
    }

    /// Inserts a column and populates it with values.
    pub fn restore_column(&mut self, column: i64, values: Option<ContiguousBlocks<T>>) {
        self.0.shift_insert(column, values);
    }

    /// Inserts a column and optionally populates it based on the column before
    /// or after it.
    pub fn insert_column(&mut self, column: i64, copy_formats: CopyFormats) {
        let values = match copy_formats {
            CopyFormats::Before => column.checked_sub(1).and_then(|i| self.0.get(i).cloned()),
            CopyFormats::After => self.0.get(column).cloned(),
            CopyFormats::None => None,
        };

        self.restore_column(column, values);
    }

    /// Removes a row and returns the values that used to inhabit it.
    pub fn remove_row(&mut self, row: i64) -> ContiguousBlocks<T> {
        self.0.update_all_blocks(|column| column.shift_remove(row))
    }

    /// Inserts a row and populates it with values.
    pub fn restore_row(&mut self, row: i64, values: Option<ContiguousBlocks<T>>) {
        self.0.update_all_blocks(|column| {
            column.shift_insert(row, None);
            None::<()> // no return value needed
        });

        if let Some(values) = values {
            self.0.update_from_blocks(values, |old_column, new_value| {
                let mut current_column = old_column.unwrap_or_default();
                current_column.set(row, new_value.clone());
                (
                    (!current_column.is_empty()).then_some(current_column),
                    (), // no return value needed
                )
            });
        }
    }

    /// Inserts a row and optionally populates it based on the row before
    /// or after it.
    pub fn insert_row(&mut self, row: i64, copy_formats: CopyFormats) {
        self.0.update_all_blocks(|column| {
            let value = match copy_formats {
                CopyFormats::Before => row.checked_sub(1).and_then(|i| column.get(i).cloned()),
                CopyFormats::After => column.get(row).cloned(),
                CopyFormats::None => None,
            };
            column.shift_insert(row, value);
            None::<()> // no return value needed
        });
    }

    /// Constructs a new [`Contiguous2D`] by applying a pure function to every
    /// value.
    pub fn map_ref<U: Clone + PartialEq>(&self, mut f: impl FnMut(&T) -> U) -> Contiguous2D<U> {
        Contiguous2D(self.0.map_ref(|column| column.map_ref(&mut f)))
    }

    /// Returns the set of (potentially infinite) rectangles that have values.
    /// Each rectangle is `(x1, y1, x2, y2)`, where `None` is unbounded. All
    /// coordinates are inclusive.
    pub fn to_rects(&self) -> impl '_ + Iterator<Item = (i64, i64, Option<i64>, Option<i64>)> {
        self.0 .0.values().flat_map(|x_block| {
            let column = &x_block.value;
            let x1 = x_block.start;
            let x2 = (x_block.end < i64::MAX).then_some(x_block.end.saturating_sub(1));
            column.0.values().map(move |y_block| {
                let y1 = y_block.start;
                let y2 = (y_block.end < i64::MAX).then_some(y_block.end.saturating_sub(1));
                (x1, y1, x2, y2)
            })
        })
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;
    use itertools::Itertools;
    use proptest::prelude::*;

    // Comment out variants to test individual operations
    #[derive(Debug, Copy, Clone, proptest_derive::Arbitrary)]
    enum TestOp {
        // SetRange {
        //     start: u8,
        //     end: Option<u8>,
        //     value: u8,
        // },
        Set { index: u8, value: u8 },
        Remove { index: u8 },
        ShiftInsert { index: u8, value: Option<u8> },
        ShiftRemove { index: u8 },
    }

    proptest! {
        #[test]
        fn test_contiguous_blocks(ops: Vec<TestOp>) {
            let mut bytes: [Option<u8>; 257] = [None; 257];
            let mut blocks = ContiguousBlocks::default();
            let mut shift_inserted = false;
            for op in ops {
                match op {
                    // todo: this does not work.
                    // TestOp::SetRange { start, end, value } => {
                    //     let reverse_blocks =
                    //         blocks.set_range(start as i64, end.map(|i| i as i64).unwrap_or(i64::MAX), value);

                    //     // Before we update `bytes`, check that undo works
                    //     // correctly.
                    //     let mut test_blocks = blocks.clone();
                    //     test_blocks.set_blocks(reverse_blocks.into_iter().map(|(
                    //       _,block)| block));
                    //     assert_matches_bytes(bytes, test_blocks, shift_inserted);

                    //     let start = start as usize;
                    //     let end = match end {
                    //         Some(i) => i as usize,
                    //         None => 257,
                    //     };
                    //     if start < end {
                    //         bytes[start..end].fill(Some(value));
                    //     }
                    // }
                    TestOp::Set { index, value } => {
                        let old_value = blocks.set(index as i64, value);
                        assert_eq!(bytes[index as usize], old_value, "wrong old value");
                        bytes[index as usize] = Some(value);
                    }
                    TestOp::Remove { index } => {
                        let old_value = blocks.remove(index as i64);
                        assert_eq!(bytes[index as usize], old_value, "wrong old value");
                        bytes[index as usize] = None;
                    }
                    TestOp::ShiftInsert { index, value } => {
                        blocks.shift_insert(index as i64, value);
                        bytes[index as usize..].rotate_right(1);
                        bytes[index as usize] = value;
                        shift_inserted = true;
                    }
                    TestOp::ShiftRemove { index } => {
                        blocks.shift_remove(index as i64);
                        bytes[index as usize..].rotate_left(1);
                        // Oops, we actually don't know what index 256 is supposed to be
                        bytes[256] = blocks.get(256).copied();
                    }
                }
            }

            assert_matches_bytes(bytes, blocks, shift_inserted);
        }
    }

    fn assert_matches_bytes(
        bytes: [Option<u8>; 257],
        blocks: ContiguousBlocks<u8>,
        shift_inserted: bool,
    ) {
        // println!("{bytes:?}");
        // println!("{blocks:?}");

        for i in 0..u8::MAX {
            assert_eq!(
                blocks.get(i as i64),
                bytes[i as usize].as_ref(),
                "wrong value at {i}",
            );
        }

        // If we shift-inserted, then there may be values we aren't aware of
        if !shift_inserted {
            let bytes_is_empty = bytes == [None; 257];
            assert_eq!(bytes_is_empty, blocks.is_empty(), "wrong `is_empty()`");

            assert_eq!(
                bytes.iter().positions(|&v| v.is_some()).last().unwrap_or(0) as i64,
                blocks.max().unwrap_or(256),
                "wrong `max()`",
            );

            // Check that we are using the minimal number of blocks
            let block_count = blocks.0.len();
            let required_block_count = bytes.iter().dedup().filter(|v| v.is_some()).count();
            assert_eq!(required_block_count, block_count, "too many blocks");
        }

        // Make sure we didn't lose any `u64::MAX` coordinates
        const FINITE_LIMIT: i64 = i64::MAX / 2; // doesn't matter exactly what this is
        for block in blocks.0.values() {
            assert!(block.start < FINITE_LIMIT);
            if block.end > FINITE_LIMIT {
                assert_eq!(block.end, i64::MAX);
            }
        }
    }

    #[test]
    fn test_is_empty() {
        let mut c = Contiguous2D::<bool>::new();
        assert!(c.is_empty());
        c.set(pos![A1], Some(true));
        assert!(!c.is_empty());
    }

    #[test]
    fn test_set() {
        let mut c = Contiguous2D::<bool>::new();
        assert_eq!(c.set(pos![A1], Some(true)), None);
        assert_eq!(c.get(pos![A1]), Some(&true));
        assert_eq!(c.set(pos![A1], Some(false)), Some(true));
        assert_eq!(c.get(pos![A1]), Some(&false));
    }

    #[test]
    fn test_set_rect() {
        let mut c = Contiguous2D::<bool>::new();

        let mut undo = Contiguous2D::<Option<bool>>::new();
        undo.set_rect(2, 2, Some(10), Some(10), Some(None));

        assert_eq!(c.set_rect(2, 2, Some(10), Some(10), Some(true)), undo);
        assert_eq!(c.get(pos![A1]), None);
        assert_eq!(c.get(pos![B2]), Some(&true));
        assert_eq!(c.get(pos![J10]), Some(&true));

        let mut undo2 = Contiguous2D::<Option<bool>>::new();
        undo2.set(Pos { x: 5, y: 5 }, Some(Some(true)));
        assert_eq!(c.set_rect(5, 5, Some(5), Some(5), Some(false)), undo2);
        assert_eq!(c.get(Pos { x: 5, y: 5 }), Some(&false));

        c.set_from(undo2);
        assert_eq!(c.get(Pos { x: 5, y: 5 }), Some(&true));
        assert_eq!(c.get(pos![A1]), None);
        assert_eq!(c.get(pos![B2]), Some(&true));

        c.set_from(undo);
        assert_eq!(c.get(pos![A1]), None);
        assert_eq!(c.get(pos![B2]), None);
        assert_eq!(c.get(pos![J10]), None);
    }

    #[test]
    fn test_set_rect_infinite() {
        let mut c = Contiguous2D::<bool>::new();
        let mut undo = Contiguous2D::<Option<bool>>::new();
        undo.set_rect(1, 1, None, None, Some(None));
        assert_eq!(c.set_rect(1, 1, None, None, Some(true)), undo);

        assert_eq!(c.get(pos![A1]), Some(&true));
        assert_eq!(c.get(pos![B2]), Some(&true));
        assert_eq!(c.get(pos![Z1000]), Some(&true));
    }

    #[test]
    fn test_set_column() {
        let mut c = Contiguous2D::<bool>::new();
        let mut undo = Contiguous2D::<Option<bool>>::new();
        undo.set_columns(2, 2, Some(None));
        assert_eq!(c.set_columns(2, 2, Some(true)), undo);

        assert_eq!(c.get(pos![B2]), Some(&true));
        assert_eq!(c.get(pos![B100000]), Some(&true));
        assert_eq!(c.get(pos![A1]), None);

        c.set_from(undo);
        assert_eq!(c.get(pos![B2]), None);
        assert_eq!(c.get(pos![B100000]), None);
    }

    #[test]
    fn test_set_row() {
        let mut c = Contiguous2D::<bool>::new();
        let mut undo = Contiguous2D::<Option<bool>>::new();
        undo.set_rows(2, 2, Some(None));
        assert_eq!(c.set_rows(2, 2, Some(true)), undo);

        assert_eq!(c.get(pos![A2]), Some(&true));
        assert_eq!(c.get(pos![ZZZZ2]), Some(&true));

        c.set_from(undo);
        assert_eq!(c.get(pos![A2]), None);
        assert_eq!(c.get(pos![ZZZZ2]), None);
    }

    #[test]
    fn test_insert_column() {
        let mut c = Contiguous2D::<bool>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));

        c.insert_column(2, CopyFormats::After);

        assert_eq!(c.get(pos![B2]), Some(&true));
        assert_eq!(c.get(pos![B10]), Some(&true));
        assert_eq!(c.get(pos![B11]), None);

        let mut c = Contiguous2D::<bool>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));

        c.insert_column(2, CopyFormats::Before);
        assert_eq!(c.get(pos![B2]), None);
        assert_eq!(c.get(pos![B10]), None);
    }

    #[test]
    fn test_insert_row() {
        let mut c = Contiguous2D::<bool>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        assert_eq!(c.get(pos![B2]), Some(&true));

        c.insert_row(2, CopyFormats::After);

        assert_eq!(c.get(pos![B2]), Some(&true));
        assert_eq!(c.get(pos![D2]), Some(&true));
        assert_eq!(c.get(pos![K2]), None);

        let mut c = Contiguous2D::<bool>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));

        c.insert_row(2, CopyFormats::Before);
        assert_eq!(c.get(pos![B2]), None);
        assert_eq!(c.get(pos![D2]), None);
    }

    #[test]
    fn test_remove_column() {
        let mut c = Contiguous2D::<bool>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        assert_eq!(c.get(Pos { x: 10, y: 2 }), Some(&true));

        c.remove_column(3);
        assert_eq!(c.get(Pos { x: 10, y: 2 }), None);
        assert_eq!(c.get(Pos { x: 9, y: 2 }), Some(&true));
    }

    #[test]
    fn test_remove_row() {
        let mut c = Contiguous2D::<bool>::new();
        c.set_rect(2, 2, Some(10), Some(10), Some(true));
        assert_eq!(c.get(Pos { x: 2, y: 10 }), Some(&true));

        c.remove_row(3);
        assert_eq!(c.get(Pos { x: 2, y: 10 }), None);
        assert_eq!(c.get(Pos { x: 2, y: 9 }), Some(&true));
    }
}
