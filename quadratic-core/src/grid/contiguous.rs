use std::collections::{btree_map, BTreeMap};
use std::fmt;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use crate::{CopyFormats, Pos};

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
    type Item = (u64, Block<ContiguousBlocks<T>>);
    type IntoIter = btree_map::IntoIter<u64, Block<ContiguousBlocks<T>>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl<T> FromIterator<(u64, Block<ContiguousBlocks<T>>)> for Contiguous2D<T> {
    fn from_iter<I: IntoIterator<Item = (u64, Block<ContiguousBlocks<T>>)>>(iter: I) -> Self {
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
        self.0.get(pos.x as u64)?.get(pos.y as u64)
    }

    /// Sets a single formatting value and returns the old one.
    pub fn set(&mut self, pos: Pos, value: Option<T>) -> Option<T> {
        self.set_rect(
            pos.x as u64,
            pos.y as u64,
            Some(pos.x as u64),
            Some(pos.y as u64),
            value,
        )
        .0
        .into_iter()
        .next()?
        .1
        .value
        .into_iter()
        .next()?
        .1
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
    pub fn set_rect(
        &mut self,
        x1: u64,
        y1: u64,
        x2: Option<u64>,
        y2: Option<u64>,
        value: Option<T>,
    ) -> Contiguous2D<Option<T>> {
        self.set_from(Contiguous2D(ContiguousBlocks::from_block(Block {
            start: x1,
            end: x2.unwrap_or(u64::MAX).saturating_add(1),
            value: ContiguousBlocks::from_block(Block {
                start: y1,
                end: y2.unwrap_or(u64::MAX).saturating_add(1),
                value,
            }),
        })))
    }
    /// Sets an entire column to a single value, starting at coordinate 1.
    pub fn set_column(&mut self, column: u64, value: Option<T>) -> Contiguous2D<Option<T>> {
        self.set_rect(column, 1, Some(column), None, value)
    }
    /// Sets an entire column to a single value, starting at coordinate 1.
    pub fn set_row(&mut self, row: u64, value: Option<T>) -> Contiguous2D<Option<T>> {
        self.set_rect(1, row, None, Some(row), value)
    }

    /// Returns the upper bound on the values in the given column, or `None` if
    /// it is unbounded. Returns 0 if there are no values.
    pub fn column_max(&self, column: u64) -> Option<u64> {
        match self.0.get(column) {
            Some(column_data) => column_data.max(),
            None => Some(0),
        }
    }

    /// Removes a column and returns the values that used to inhabit it.
    pub fn remove_column(&mut self, column: u64) -> ContiguousBlocks<T> {
        self.0.shift_remove(column).unwrap_or_default()
    }

    /// Inserts a column and populates it with values.
    pub fn restore_column(&mut self, column: u64, values: Option<ContiguousBlocks<T>>) {
        self.0.shift_insert(column, values);
    }

    /// Inserts a column and optionally populates it based on the column before
    /// or after it.
    pub fn insert_column(&mut self, column: u64, copy_formats: CopyFormats) {
        let values = match copy_formats {
            CopyFormats::Before => column.checked_sub(1).and_then(|i| self.0.get(i).cloned()),
            CopyFormats::After => self.0.get(column).cloned(),
            CopyFormats::None => None,
        };

        self.restore_column(column, values);
    }

    /// Removes a row and returns the values that used to inhabit it.
    pub fn remove_row(&mut self, row: u64) -> ContiguousBlocks<T> {
        self.0.update_all_blocks(|column| column.shift_remove(row))
    }

    /// Inserts a row and populates it with values.
    pub fn restore_row(&mut self, row: u64, values: Option<ContiguousBlocks<T>>) {
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
    pub fn insert_row(&mut self, row: u64, copy_formats: CopyFormats) {
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
    pub fn to_rects(&self) -> impl '_ + Iterator<Item = (u64, u64, Option<u64>, Option<u64>)> {
        self.0 .0.values().flat_map(|x_block| {
            let column = &x_block.value;
            let x1 = x_block.start;
            let x2 = (x_block.end < u64::MAX).then_some(x_block.end.saturating_sub(1));
            column.0.values().map(move |y_block| {
                let y1 = y_block.start;
                let y2 = (y_block.end < u64::MAX).then_some(y_block.end.saturating_sub(1));
                (x1, y1, x2, y2)
            })
        })
    }
}

/// Key-value store from nonnegative integers to values, optimized for
/// contiguous blocks with the same value. All (infinitely many) values are
/// initialized to default.
///
/// Supports a single infinite block of the same value at the end.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct ContiguousBlocks<T>(
    #[serde(
        bound = "T: Serialize + for<'a> Deserialize<'a>", // shouldn't serde infer this?
        with = "crate::util::btreemap_serde"
    )]
    BTreeMap<u64, Block<T>>,
);
impl<T> Default for ContiguousBlocks<T> {
    fn default() -> Self {
        Self(BTreeMap::default())
    }
}
impl<T> IntoIterator for ContiguousBlocks<T> {
    type Item = (u64, Block<T>);
    type IntoIter = btree_map::IntoIter<u64, Block<T>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl<T> FromIterator<Block<T>> for ContiguousBlocks<T> {
    fn from_iter<I: IntoIterator<Item = Block<T>>>(iter: I) -> Self {
        Self(iter.into_iter().map(|block| (block.start, block)).collect())
    }
}
impl<T> FromIterator<(u64, Block<T>)> for ContiguousBlocks<T> {
    fn from_iter<I: IntoIterator<Item = (u64, Block<T>)>>(iter: I) -> Self {
        Self(BTreeMap::from_iter(iter))
    }
}
impl<T: Clone + PartialEq> ContiguousBlocks<T> {
    /// Constructs an empty map.
    pub fn new() -> Self {
        Self::default()
    }

    pub fn into_values(self) -> impl Iterator<Item = Block<T>> {
        self.0.into_values()
    }

    /// Constructs a map with only a single block.
    pub fn from_block(block: Block<T>) -> Self {
        let mut ret = Self::new();
        ret.add_block(block);
        ret
    }

    /// Constructs a new [`ContiguousBlocks`] by applying a pure function to
    /// every value.
    pub fn map_ref<U: Clone + PartialEq>(&self, mut f: impl FnMut(&T) -> U) -> ContiguousBlocks<U> {
        ContiguousBlocks(
            self.0
                .iter()
                .map(|(&key, block)| (key, block.map_ref(&mut f)))
                .collect(),
        )
    }

    /// Returns whether the contiguous blocks are all default values.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Returns the maximum coordinate with a value, or `None` if there is an
    /// infinite block. Returns 0 if there are no values.
    pub fn max(&self) -> Option<u64> {
        match self.0.last_key_value() {
            Some((_, block)) => (block.end < u64::MAX).then_some(block.end.saturating_sub(1)),
            None => Some(0), // no values
        }
    }

    fn get_block_containing(&self, coordinate: u64) -> Option<&Block<T>> {
        self.0
            .range(..=coordinate)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(coordinate))
    }
    fn remove_block_containing(&mut self, coordinate: u64) -> Option<Block<T>> {
        let key = self.get_block_containing(coordinate)?.start;
        self.0.remove(&key)
    }
    fn add_block(&mut self, block: Block<T>) {
        if block.is_empty() {
            return;
        }
        let start = block.start;
        let end = block.end;
        debug_assert!(!self.has_any_in_range(start, end));
        let key = start;
        self.0.insert(key, block);

        self.try_merge_at(start);
        self.try_merge_at(end);
    }
    fn add_blocks(&mut self, blocks: impl IntoIterator<Item = Block<T>>) {
        for block in blocks {
            self.add_block(block);
        }
    }

    /// Returns whether `self` has any values in the range from `start` to `end`.
    fn has_any_in_range(&self, start: u64, end: u64) -> bool {
        self.blocks_touching_range(start, end).next().is_some()
    }

    /// Iterates over blocks that touch the range from `start` to `end`.
    fn blocks_touching_range(&self, start: u64, end: u64) -> impl Iterator<Item = &Block<T>> {
        // There may be a block starting above `y_range.start` that contains
        // `y_range`, so find that.
        let first_block = self
            .get_block_containing(start)
            // filter to avoid double-counting
            .filter(|block| block.start != start);

        let rest = if start < end {
            Some(
                self.0
                    .range(start..end)
                    .map(|(_, block)| block)
                    .filter(move |block| block.start < end),
            )
        } else {
            None
        }
        .into_iter()
        .flatten();

        itertools::chain(first_block, rest)
    }

    /// Removes all blocks that touch the range from `start` to `end`, in order.
    fn remove_blocks_touching_range(
        &mut self,
        start: u64,
        end: u64,
    ) -> impl '_ + Iterator<Item = Block<T>> {
        let block_starts = self
            .blocks_touching_range(start, end)
            .map(|block| block.start)
            .collect_vec();
        block_starts.into_iter().filter_map(|y| self.0.remove(&y))
    }
    /// Returns the value at `coordinate`, or `None` if it is default.
    pub fn get(&self, coordinate: u64) -> Option<&T> {
        self.get_block_containing(coordinate)
            .map(|block| &block.value)
    }
    /// Removes all values in the range from `start` to `end` and returns a list
    /// of blocks that can be added to restore them.
    pub fn remove_range(&mut self, start: u64, end: u64) -> Vec<Block<T>> {
        let mut to_return = vec![];
        let mut to_put_back: SmallVec<[Block<T>; 2]> = smallvec![];

        for removed_block in self.remove_blocks_touching_range(start, end) {
            let [before, middle, after] = removed_block.split_twice(start, end);
            to_put_back.extend(before);
            to_return.extend(middle);
            to_put_back.extend(after);
        }

        self.add_blocks(to_put_back);

        to_return
    }
    /// Removes all values in the range from `start` to `end` and returns a list
    /// of blocks containing the old values that completely covers the region.
    pub fn remove_range_complete(&mut self, start: u64, end: u64) -> Vec<Block<Option<T>>> {
        let mut ret = vec![];
        let mut index = start;
        for block in self.remove_range(start, end) {
            if index < block.start {
                ret.push(Block {
                    start: index,
                    end: block.start,
                    value: None,
                });
            }
            index = block.end;
            ret.push(block.map(Some));
        }
        if index < end {
            ret.push(Block {
                start: index,
                end,
                value: None,
            });
        }
        ret
    }

    /// Sets values from `other`, and returns the blocks to set to undo it.
    pub fn set_blocks(
        &mut self,
        other: impl IntoIterator<Item = Block<Option<T>>>,
    ) -> ContiguousBlocks<Option<T>> {
        let mut to_return = ContiguousBlocks::new();
        for block in other {
            if block.value.is_some() {
                to_return.add_block(block.map_ref(|_| None));
            }
            for removed_block in self.remove_range(block.start, block.end) {
                to_return.remove_range(removed_block.start, removed_block.end);
                to_return.add_block(removed_block.map(Some));
            }

            if let Some(new_block) = block.as_some() {
                self.add_block(new_block);
            }
        }
        to_return
    }

    /// Sets all values in the range from `start` to `end` and returns a list of
    /// changes to apply for undo.
    pub fn set_range(&mut self, start: u64, end: u64, value: T) -> ContiguousBlocks<Option<T>> {
        self.set_blocks([Block {
            start,
            end,
            value: Some(value),
        }])
    }

    /// Sets a value and returns the old value at `coordinate`.
    pub fn set(&mut self, coordinate: u64, value: T) -> Option<T> {
        self.set_range(coordinate, coordinate.saturating_add(1), value)
            .into_values()
            .next()?
            .value
    }
    /// Removes the value at `coordinate`, returning it.
    pub fn remove(&mut self, coordinate: u64) -> Option<T> {
        self.remove_range(coordinate, coordinate.saturating_add(1))
            .into_iter()
            .next()
            .map(|block| block.value)
    }

    /// Updates a range of values using `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    pub fn update_range<R>(
        &mut self,
        start: u64,
        end: u64,
        update_fn: impl Fn(Option<T>) -> (Option<T>, R),
    ) -> Vec<Block<R>> {
        let mut return_blocks = vec![];
        for old_block in self.remove_range_complete(start, end) {
            let (new_block, return_block) = old_block.map_split(&update_fn);
            if let Some(new_block) = new_block.as_some() {
                self.add_block(new_block);
            }
            return_blocks.push(return_block);
        }
        return_blocks
    }
    /// For each block in `other`, update the range in `self` using `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    pub fn update_from_blocks<U, R: Clone + PartialEq>(
        &mut self,
        other: impl IntoIterator<Item = (u64, Block<U>)>,
        update_fn: impl Fn(Option<T>, &U) -> (Option<T>, R),
    ) -> ContiguousBlocks<R> {
        let mut ret = ContiguousBlocks::new();
        for (_, block) in other {
            let returned_blocks =
                self.update_range(block.start, block.end, |v| update_fn(v, &block.value));
            ret.add_blocks(returned_blocks);
        }
        ret
    }
    /// Updates all non-empty blocks using `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    pub fn update_all_blocks<R: Clone + PartialEq>(
        &mut self,
        update_fn: impl Fn(&mut T) -> Option<R>,
    ) -> ContiguousBlocks<R> {
        let mut ret = ContiguousBlocks::new();
        for block in self.0.values_mut() {
            if let Some(reverse_value) = update_fn(&mut block.value) {
                ret.add_block(Block {
                    start: block.start,
                    end: block.end,
                    value: reverse_value,
                });
            }
        }
        let possible_merge_points = self.0.keys().copied().skip(1).collect_vec();
        for coordinate in possible_merge_points {
            self.try_merge_at(coordinate);
        }
        ret
    }

    fn try_merge_at(&mut self, coordinate: u64) {
        let Some(coordinate_before) = coordinate.checked_sub(1) else {
            return;
        };
        if self
            .0
            .get(&coordinate)
            .is_some_and(|block| Some(&block.value) == self.get(coordinate_before))
        {
            let block1 = self
                .remove_block_containing(coordinate_before)
                .expect("block vanished");
            let block2 = self.0.remove(&coordinate).expect("block vanished");
            self.add_blocks(Block::try_merge(block1, block2));
        }
    }

    /// Inserts a value at `coordinate`, shifting everything after it by 1.
    pub fn shift_insert(&mut self, coordinate: u64, value: Option<T>) {
        let shifted_blocks = self
            .remove_range(coordinate, u64::MAX)
            .into_iter()
            .map(|block| block.add_offset(1));
        self.add_blocks(shifted_blocks);
        if let Some(value) = value {
            self.add_block(Block {
                start: coordinate,
                end: coordinate.saturating_add(1),
                value,
            });
        }
    }
    /// Removes the value at `coordinate`, shifting everything after it by -1.
    pub fn shift_remove(&mut self, coordinate: u64) -> Option<T> {
        let old_value = self.remove(coordinate);
        let shifted_blocks = self
            .remove_range(coordinate.saturating_add(1), u64::MAX)
            .into_iter()
            .map(|block| block.subtract_offset(1));
        self.add_blocks(shifted_blocks);
        old_value
    }
}

/// Block of contiguous values in a specific range.
///
/// `start` is always a reasonable value, but `end` may be `u64::MAX` to
/// indicate an unbounded range.
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Block<T> {
    /// Start of the block.
    pub start: u64,
    /// End of the block, which is `u64::MAX` if unbounded.
    pub end: u64,
    /// Value for every value between `start` (inclusive) and `end` (exclusive).
    pub value: T,
}
impl<T: fmt::Debug> fmt::Debug for Block<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.end {
            u64::MAX => write!(f, "({:?}, {:?})", self.start.., self.value),
            _ => write!(f, "({:?}, {:?})", self.start..self.end, self.value),
        }
    }
}
impl<T: Clone + PartialEq> Block<T> {
    /// Returns the length of the block, or `None` if it is unbounded.
    pub fn len(&self) -> Option<u64> {
        (self.end < u64::MAX || self.start == self.end)
            .then_some(self.end.saturating_sub(self.start))
    }
    /// Returns whether the block is empty (length 0).
    pub fn is_empty(&self) -> bool {
        self.len() == Some(0)
    }
    /// Returns the block if it is nonempty, or `None` if it is empty.
    pub fn if_nonempty(self) -> Option<Self> {
        (!self.is_empty()).then_some(self)
    }

    /// Returns whether the block contains the key `coordinate`.
    pub fn contains(&self, coordinate: u64) -> bool {
        self.start <= coordinate && (coordinate < self.end || self.end == u64::MAX)
    }
    /// Clamps a coordinate to `self`. Both endpoints are allowed.
    fn clamp(&self, coordinate: u64) -> u64 {
        coordinate.clamp(self.start, self.end)
    }

    /// Applies a function to the value in the block.
    pub fn map<U>(self, f: impl FnOnce(T) -> U) -> Block<U> {
        Block {
            start: self.start,
            end: self.end,
            value: f(self.value),
        }
    }
    /// Applies a function to the value in the block.
    pub fn map_ref<U>(&self, f: impl FnOnce(&T) -> U) -> Block<U> {
        Block {
            start: self.start,
            end: self.end,
            value: f(&self.value),
        }
    }
    /// Applies a function to the value in the block and creates two new blocks
    /// with the same range.
    pub fn map_split<U, V>(self, f: impl FnOnce(T) -> (U, V)) -> (Block<U>, Block<V>) {
        let (u, v) = f(self.value);
        (
            Block {
                start: self.start,
                end: self.end,
                value: u,
            },
            Block {
                start: self.start,
                end: self.end,
                value: v,
            },
        )
    }

    /// Splits the block at `coordinate`, returning the halves before and after.
    pub fn split(self, coordinate: u64) -> [Option<Self>; 2] {
        let clamped_coordinate = self.clamp(coordinate);
        [
            Block {
                start: self.start,
                end: clamped_coordinate,
                value: self.value.clone(),
            },
            Block {
                start: clamped_coordinate,
                end: self.end,
                value: self.value,
            },
        ]
        .map(|block| block.if_nonempty())
    }
    /// Splits the block at `start` and `end`, returning in order:
    ///
    /// - the portion of the block before `start` (if any)
    /// - and the portion of the block between `start` and `end` (if any).
    /// - the portion of the block after `end` (if any)
    pub fn split_twice(self, start: u64, end: u64) -> [Option<Self>; 3] {
        let [before, middle_after] = self.split(start);
        let [middle, after] = match middle_after {
            Some(block) => block.split(end),
            None => [None, None],
        };

        [before, middle, after]
    }

    /// Offsets a block by the given positive delta.
    ///
    /// # Panics
    ///
    /// Panics if `self.start + delta` or `self.end + delta` exceeds
    /// [`u64::MAX`].
    pub fn add_offset(self, delta: u64) -> Self {
        Block {
            start: self.start + delta,
            end: self.end.saturating_add(delta),
            value: self.value,
        }
    }
    /// Offsets a block by the given negative delta. Truncates the block if it
    /// goes below 0.
    pub fn subtract_offset(self, delta: u64) -> Self {
        Block {
            start: self.start.saturating_sub(delta),
            end: if self.end == u64::MAX {
                self.end
            } else {
                self.end.saturating_sub(delta)
            },
            value: self.value,
        }
    }

    /// Attempts to merge two blocks, which are assumed to be non-overlapping.
    /// Returns one block if the merge was successful, or two blocks if it was
    /// not.
    ///
    /// Blocks can be merged if they are contiguous and have the same value.
    pub fn try_merge(self, other: Self) -> SmallVec<[Self; 2]> {
        let (start, end) = if self.end == other.start {
            (self.start, other.end)
        } else if other.end == self.start {
            (other.start, self.end)
        } else {
            return smallvec![self, other];
        };

        if self.value == other.value {
            smallvec![Block {
                start,
                end,
                value: self.value
            }]
        } else {
            smallvec![self, other]
        }
    }
}
impl<T: Clone + PartialEq> Block<Option<T>> {
    /// Transposes a `Block<Option<T>>` into an `Option<Block<T>>`.
    pub fn as_some(self) -> Option<Block<T>> {
        Some(Block {
            start: self.start,
            end: self.end,
            value: self.value?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // Comment out variants to test individual operations
    #[derive(Debug, Copy, Clone, proptest_derive::Arbitrary)]
    enum TestOp {
        SetRange {
            start: u8,
            end: Option<u8>,
            value: u8,
        },
        Set {
            index: u8,
            value: u8,
        },
        Remove {
            index: u8,
        },
        ShiftInsert {
            index: u8,
            value: Option<u8>,
        },
        ShiftRemove {
            index: u8,
        },
    }

    proptest! {
        #[test]
        fn test_contiguous_blocks(ops: Vec<TestOp>) {
            let mut bytes: [Option<u8>; 257] = [None; 257];
            let mut blocks = ContiguousBlocks::default();
            let mut shift_inserted = false;
            for op in ops {
                match op {
                    TestOp::SetRange { start, end, value } => {
                        let reverse_blocks =
                            blocks.set_range(start as u64, end.map(|i| i as u64).unwrap_or(u64::MAX), value);

                        // Before we update `bytes`, check that undo works
                        // correctly.
                        let mut test_blocks = blocks.clone();
                        test_blocks.set_blocks(reverse_blocks.into_iter().map(|(
                          _,block)| block));
                        assert_matches_bytes(bytes, test_blocks, shift_inserted);

                        let start = start as usize;
                        let end = match end {
                            Some(i) => i as usize,
                            None => 257,
                        };
                        if start < end {
                            bytes[start..end].fill(Some(value));
                        }
                    }
                    TestOp::Set { index, value } => {
                        let old_value = blocks.set(index as u64, value);
                        assert_eq!(bytes[index as usize], old_value, "wrong old value");
                        bytes[index as usize] = Some(value);
                    }
                    TestOp::Remove { index } => {
                        let old_value = blocks.remove(index as u64);
                        assert_eq!(bytes[index as usize], old_value, "wrong old value");
                        bytes[index as usize] = None;
                    }
                    TestOp::ShiftInsert { index, value } => {
                        blocks.shift_insert(index as u64, value);
                        bytes[index as usize..].rotate_right(1);
                        bytes[index as usize] = value;
                        shift_inserted = true;
                    }
                    TestOp::ShiftRemove { index } => {
                        blocks.shift_remove(index as u64);
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
        println!("{bytes:?}");
        println!("{blocks:?}");

        for i in 0..u8::MAX {
            assert_eq!(
                blocks.get(i as u64),
                bytes[i as usize].as_ref(),
                "wrong value at {i}",
            );
        }

        // If we shift-inserted, then there may be values we aren't aware of
        if !shift_inserted {
            let bytes_is_empty = bytes == [None; 257];
            assert_eq!(bytes_is_empty, blocks.is_empty(), "wrong `is_empty()`");

            assert_eq!(
                bytes.iter().positions(|&v| v.is_some()).last().unwrap_or(0) as u64,
                blocks.max().unwrap_or(256),
                "wrong `max()`",
            );

            // Check that we are using the minimal number of blocks
            let block_count = blocks.0.len();
            let required_block_count = bytes.iter().dedup().filter(|v| v.is_some()).count();
            assert_eq!(required_block_count, block_count, "too many blocks");
        }

        // Make sure we didn't lose any `u64::MAX` coordinates
        const FINITE_LIMIT: u64 = u64::MAX / 2; // doesn't matter exactly what this is
        for block in blocks.0.values() {
            assert!(block.start < FINITE_LIMIT);
            if block.end > FINITE_LIMIT {
                assert_eq!(block.end, u64::MAX);
            }
        }
    }
}
