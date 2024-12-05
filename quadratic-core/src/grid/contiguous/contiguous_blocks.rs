use std::collections::{btree_map, BTreeMap};

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::block::Block;

/// Key-value store from positive integers to values, optimized for contiguous
/// blocks with the same value.
///
/// # Invariants
///
/// - For each `(key, block)` pair, `key == block.start`
/// - All blocks are nonempty (`block.start < block.end`)
/// - Every coordinate from `1` to `u64::MAX` is covered by exactly one block
/// - There is no block that covers the coordinate `0`
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct ContiguousBlocks<T>(
    #[serde(
        bound = "T: Serialize + for<'a> Deserialize<'a>", // shouldn't serde infer this?
        with = "crate::util::btreemap_serde"
    )]
    BTreeMap<u64, Block<T>>,
);
impl<T: Default> Default for ContiguousBlocks<T> {
    fn default() -> Self {
        Self(BTreeMap::from_iter([(1, Block::new_total(T::default()))]))
    }
}
impl<T> IntoIterator for ContiguousBlocks<T> {
    type Item = Block<T>;
    type IntoIter = btree_map::IntoValues<u64, Block<T>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_values()
    }
}
impl<T> ContiguousBlocks<T> {
    /// Iterates over all the blocks.
    pub fn iter(&self) -> btree_map::Values<'_, u64, Block<T>> {
        self.0.values()
    }
}
impl<T: Default> ContiguousBlocks<T> {
    /// Constructs a mapping with all infinitely many values initialized to
    /// `T::default()`.
    pub fn new() -> Self {
        Self::default()
    }
}
impl<T: Default + PartialEq> ContiguousBlocks<T> {
    /// Constructs a map with only a single non-default block.
    pub fn from_block(block: Block<T>) -> Self
    where
        T: Clone,
    {
        let mut ret = Self::new();
        if !block.is_empty() && block.value != T::default() {
            ret.raw_set_block(block);
        }
        ret
    }

    /// Returns whether the contiguous blocks are all default values.
    pub fn is_all_default(&self) -> bool {
        let default = T::default();
        self.0.values().all(|block| block.value == default)
    }

    /// Returns an iterator over all non-default blocks.
    fn non_default_blocks(&self) -> impl DoubleEndedIterator + Iterator<Item = &Block<T>> {
        self.0.values().filter(|block| block.value != T::default())
    }
}
impl<T: Clone + PartialEq> ContiguousBlocks<T> {
    /// Returns an error if any invariant of the data structure is broken.
    #[cfg(test)]
    fn check_validity(&self) -> Result<(), &'static str> {
        // For each `(key, block)` pair, `key == block.start`
        if !self.0.iter().all(|(&key, block)| key == block.start) {
            return Err("invariant broken due to key != value.start");
        }

        // All blocks are nonempty (`block.start < block.end`)
        if !self.0.values().all(|block| block.start < block.end) {
            return Err("invariant broken due to empty block");
        }

        // Every coordinate from `1` to `u64::MAX` is covered by exactly one block
        let mut last_index = 1;
        while last_index < u64::MAX {
            let Some(block) = self.0.get(&last_index) else {
                return Err("invariant broken due to missing coordinate");
            };
            last_index = block.end;
        }

        // There is no block that covers the coordinate `0`
        if self.0.get(&0).is_some() {
            return Err("block contains 0");
        }

        Ok(())
    }

    /// Constructs a new [`ContiguousBlocks`] by applying a pure function to
    /// every value.
    pub fn map<U: Clone + PartialEq>(self, f: impl Fn(T) -> U) -> ContiguousBlocks<U> {
        let mut ret = ContiguousBlocks(
            self.into_iter()
                .map(|block| (block.start, block.map(&f)))
                .collect(),
        );
        ret.try_merge_everywhere();
        ret
    }

    /// Constructs a new [`ContiguousBlocks`] by applying a pure function to
    /// every value.
    pub fn map_ref<U: Clone + PartialEq>(&self, f: impl Fn(&T) -> U) -> ContiguousBlocks<U> {
        let mut ret = ContiguousBlocks(
            self.iter()
                .map(|block| (block.start, block.map_ref(&f)))
                .collect(),
        );
        ret.try_merge_everywhere();
        ret
    }

    /// Returns the coordinate of the last non-default value. If the infinite
    /// block at the end is non-default, then its starting coordinate is
    /// returned. If all values are default, then `0` is returned.
    pub fn finite_max(&self) -> u64
    where
        T: Default,
    {
        self.non_default_blocks()
            .last()
            .map(|block| block.finite_max())
            .unwrap_or(0)
    }

    /// Returns the block containing `coordinate`, or `None` if there is no such
    /// block (which should only happen if `coordinate == 0`).
    fn get_block_containing(&self, coordinate: u64) -> Option<&Block<T>> {
        self.0
            .range(..=coordinate)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(coordinate))
    }
    /// Adds a block to the data structure. **This breaks the invariant that
    /// every key is covered exactly once.**
    fn add_block(&mut self, mut block: Block<T>) {
        if block.start < 1 {
            block.start = 1;
        }
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
    /// Adds multiple blocks to the data structure. **This breaks the invariant
    /// that every key is covered exactly once.**
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
    /// **This breaks the invariant that every key is covered exactly once.**
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
    /// Returns the value at `coordinate`, or `None` if `coordinate == 0`.
    pub fn get(&self, coordinate: u64) -> Option<&T> {
        self.get_block_containing(coordinate)
            .map(|block| &block.value)
    }
    /// Removes all values in the range from `start` to `end`. **This breaks the
    /// invariant that every key is covered exactly once.**
    fn raw_remove_range(&mut self, start: u64, end: u64) {
        let mut to_put_back: SmallVec<[Block<T>; 2]> = smallvec![];

        for removed_block in self.remove_blocks_touching_range(start, end) {
            let [before, _, after] = removed_block.split_twice(start, end);
            to_put_back.extend(before);
            to_put_back.extend(after);
        }

        self.add_blocks(to_put_back);
    }
    /// Removes all values in the range from `start` to `end` and returns a list
    /// of blocks that can be added to restore them. **This breaks the invariant
    /// that every key is covered exactly once.**
    #[must_use = "if reverse operation doesn't matter, use `raw_remove_range()`"]
    fn remove_range(&mut self, start: u64, end: u64) -> Vec<Block<T>> {
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

    /// Sets a contiguous range of values.
    pub(super) fn raw_set_block(&mut self, block: Block<T>) {
        // `remove_range()` and `add_block()` each perform their own input
        // validation.
        self.raw_remove_range(block.start, block.end);
        self.add_block(block);
    }
    /// Sets a contiguous range of values and returns a list of blocks to set to
    /// undo the operation.
    #[must_use = "if reverse operation doesn't matter, use `raw_set_block()`"]
    fn set_block(&mut self, block: Block<T>) -> SmallVec<[Block<T>; 1]> {
        if block.is_empty() {
            return smallvec![];
        }

        let mut to_return = smallvec![];

        for removed_block in self.remove_range(block.start, block.end) {
            to_return.push(removed_block);
        }

        self.add_block(block);

        to_return
    }

    /// Sets values from `other`, and returns the blocks to set to undo it.
    pub fn set_blocks(
        &mut self,
        other: ContiguousBlocks<Option<T>>,
    ) -> ContiguousBlocks<Option<T>> {
        let mut to_return = ContiguousBlocks::new();
        for block in other.into_iter().filter_map(Block::into_some) {
            let reverse_blocks = self.set_block(block);
            for reverse_block in reverse_blocks {
                to_return.raw_set_block(reverse_block.map(Some));
            }
        }
        to_return
    }

    /// Sets the value at `coordinate` and returns the old value. Returns `None`
    /// if `coordinate == 0`.
    pub fn set(&mut self, coordinate: u64, value: T) -> Option<T> {
        let reverse_blocks = self.set_block(Block {
            start: coordinate,
            end: coordinate.saturating_add(1),
            value,
        });
        debug_assert!(reverse_blocks.len() <= 1); // empty iff `coordinate == 0`
        reverse_blocks.into_iter().next().map(|block| block.value)
    }
    /// Updates the value at `coordinate` using `f` and returns data to perform
    /// the reverse operation. Returns `None` if `coordinate == 0`.
    ///
    /// - `R` is the data required to perform the reverse operation.
    pub fn update<R>(&mut self, coordinate: u64, f: impl FnOnce(&mut T) -> R) -> Option<R> {
        let mut value = self.get(coordinate)?.clone();
        let ret = f(&mut value);
        self.set(coordinate, value);
        Some(ret)
    }

    /// Updates a range of values using `update_fn` and returns a list of blocks
    /// to perform the reverse operation.
    ///
    /// - `R` is the data required to perform the reverse operation.
    pub(super) fn update_range<R>(
        &mut self,
        start: u64,
        end: u64,
        update_fn: impl Fn(&mut T) -> R,
    ) -> Vec<Block<R>> {
        let mut return_blocks = vec![];
        for mut block in self.remove_range(start, end) {
            let return_value = update_fn(&mut block.value);
            let return_block = block.map_ref(|_| return_value);
            self.add_block(block);
            return_blocks.push(return_block);
        }
        return_blocks
    }
    /// For each block in `other`, updates the range in `self` using
    /// `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    fn update_blocks<'a, U: 'a, R>(
        &mut self,
        other: impl IntoIterator<Item = Block<U>>,
        update_fn: impl Fn(&mut T, &U) -> R,
    ) -> Vec<Block<R>> {
        let mut ret = vec![];
        for block in other {
            let return_blocks =
                self.update_range(block.start, block.end, |t| update_fn(t, &block.value));
            ret.extend(return_blocks);
        }
        ret
    }
    /// For each non-default value in `other`, updates the range in `self` using
    /// `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    pub fn update_non_default_from<U: Default + PartialEq, R: Clone + PartialEq>(
        &mut self,
        other: &ContiguousBlocks<U>,
        update_fn: impl Fn(&mut T, &U) -> Option<R>,
    ) -> ContiguousBlocks<Option<R>> {
        let mut ret = ContiguousBlocks::new();
        let return_blocks = self
            .update_blocks(other.non_default_blocks().map(Block::as_ref), |t, &u| {
                update_fn(t, u)
            });
        for return_block in return_blocks {
            ret.raw_set_block(return_block);
        }
        ret
    }
    /// Updates all non-empty values using `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    pub fn update_all<R: Clone + PartialEq>(
        &mut self,
        update_fn: impl Fn(&mut T) -> Option<R>,
    ) -> ContiguousBlocks<R> {
        let mut ret_blocks = BTreeMap::new();
        for block in self.0.values_mut() {
            if let Some(reverse_value) = update_fn(&mut block.value) {
                ret_blocks.insert(
                    block.start,
                    Block {
                        start: block.start,
                        end: block.end,
                        value: reverse_value,
                    },
                );
            }
        }
        // The blocks are guaranteed to be disjoint and cover the whole space.
        let mut ret = ContiguousBlocks(ret_blocks);

        let possible_merge_points = self.0.keys().copied().skip(1).collect_vec();
        for coordinate in possible_merge_points {
            self.try_merge_at(coordinate);
            ret.try_merge_at(coordinate);
        }

        ret
    }

    /// Merges the two blocks sharing a border at `coordinate`, if such blocks
    /// exist and can be merged.
    fn try_merge_at(&mut self, coordinate: u64) {
        let Some(coordinate_before) = coordinate.checked_sub(1) else {
            return;
        };

        let Some(block_before) = self.get_block_containing(coordinate_before) else {
            return;
        };
        let Some(block_at) = self.0.get(&coordinate) else {
            return;
        };

        if block_at.value == block_before.value {
            let start = block_before.start;
            let mid = block_at.start; // same as `block_before.end`
            let end = block_at.end;

            // Extend first block.
            let block_before = self.0.get_mut(&start).expect("block vanished");
            block_before.end = end;

            // Remove second block.
            self.0.remove(&mid).expect("block vanished");
        }
    }

    /// Merges all blocks that can be merged.
    fn try_merge_everywhere(&mut self) {
        for coordinate in self.0.keys().copied().collect_vec() {
            self.try_merge_at(coordinate);
        }
    }

    /// Shifts everything after `start` by `end-start` and then sets the values
    /// from `start` (inclusive) to `end` (exclusive).
    pub fn shift_insert(&mut self, start: u64, end: u64, value: T) {
        let Some(offset) = end.checked_sub(start) else {
            return;
        };
        let shifted_blocks = self
            .remove_range(start, u64::MAX)
            .into_iter()
            .filter_map(|block| block.add_offset(offset));
        self.add_blocks(shifted_blocks);
        self.add_block(Block { start, end, value });
    }
    /// Removes the values from `start` (inclusive) to `end` (exclusive) and
    /// shifts everything after `end` by `start-end`.
    pub fn shift_remove(&mut self, start: u64, end: u64) {
        let Some(offset) = start.checked_sub(end) else {
            return;
        };
        self.raw_remove_range(start, end);
        let shifted_blocks = self
            .remove_range(end, u64::MAX)
            .into_iter()
            .filter_map(|block| block.subtract_offset(offset));
        self.add_blocks(shifted_blocks);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use itertools::Itertools;
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
        ShiftInsert {
            start: u8,
            end: u8,
            value: u8,
        },
        ShiftRemove {
            start: u8,
            end: u8,
        },
    }

    proptest! {
        #[test]
        fn test_contiguous_blocks_from_block(start: u8, end: Option<u8>, value: u8) {
            let finite_end = match end {
                Some(x) => x as usize,
                None => start as usize + 42,
            };            let mut expected = vec![0; finite_end];
            expected[start as usize..finite_end].fill(value);
            let infinity = match end {
                Some(_) => value,
                None => 0,
            };

            let actual = ContiguousBlocks::from_block(Block {
                start: start as u64,
                end: end.map(|x| x as u64).unwrap_or(u64::MAX),
                value,
            });

            assert_matches_vec(expected, infinity, actual);
        }

        // #[test]
        // fn test_contiguous_blocks(ops: Vec<TestOp>) {
        //     let mut expected = vec![];
        //     let mut infinity = 0;
        //     let mut actual = ContiguousBlocks::default();

        //     for op in ops {
        //         match op {
        //             TestOp::SetRange { start, end, value } => {
        //                 let reverse_blocks =
        //                     blocks.set_range(start as i64, end.map(|i| i as i64).unwrap_or(i64::MAX), value);

        //                 // Before we update `bytes`, check that undo works
        //                 // correctly.
        //                 let mut test_blocks = blocks.clone();
        //                 test_blocks.set_blocks(reverse_blocks.into_iter().map(|(
        //                   _,block)| block));
        //                 assert_matches_vec(bytes, test_blocks, shift_inserted);

        //                 let start = start as usize;
        //                 let end = match end {
        //                     Some(i) => i as usize,
        //                     None => 256,
        //                 };
        //                 if start < end {
        //                     bytes[start..end].fill(Some(value));
        //                 }
        //             }
        //             TestOp::Set { index, value } => {
        //                 let old_value = blocks.set(index as u64, value);
        //                 assert_eq!(bytes[index as usize], old_value, "wrong old value");
        //                 bytes[index as usize] = Some(value);
        //             }
        //             TestOp::ShiftInsert { start, end, value } => {
        //                 blocks.shift_insert(start as u64, end as u64, value);
        //                 if let Some(delta) = end.checked_sub(start) {
        //                     bytes[start as usize..].rotate_right(delta as usize);
        //                     bytes[start as usize..end as usize].fill(value);
        //                     shift_inserted = true;
        //                 }
        //             }
        //             TestOp::ShiftRemove { start, end } => {
        //                 blocks.shift_remove(start as u64, end as u64);
        //                 if let Some(delta) = end.checked_sub(start) {
        //                     bytes[start as usize..].rotate_left(delta as usize);
        //                     // Oops, we actually don't know what these indices
        //                     // are supposed to be
        //                     for i in 256 - delta as usize..256 {
        //                         bytes[i] = blocks.get(i).expect("missing value");
        //                     }
        //                 }
        //             }
        //         }
        //     }

        //     assert_matches_vec(bytes, blocks, shift_inserted);
        // }
    }

    fn assert_matches_vec(mut expected: Vec<u8>, infinity: u8, actual: ContiguousBlocks<u8>) {
        // println!("{expected:?}");
        // println!("{actual:?}");

        actual.check_validity().unwrap();

        assert_eq!(None, actual.get(0));
        for i in 1..expected.len() {
            assert_eq!(expected.get(i), actual.get(i as u64), "wrong value at {i}");
        }
        assert_eq!(Some(&infinity), actual.get(expected.len().max(1) as u64));

        let is_all_default = expected[1..].iter().all(|&val| val == 0) && infinity == 0;
        assert_eq!(is_all_default, actual.is_all_default());

        while expected.last() == Some(&infinity) {
            expected.pop();
        }
        if expected.is_empty() {
            assert_eq!(0, actual.finite_max());
        } else if infinity == 0 {
            assert_eq!(expected.len() as u64 - 1, actual.finite_max());
        } else {
            assert_eq!(expected.len() as u64, actual.finite_max());
        }

        // Check that we are using the minimal number of blocks
        let actual_block_count = actual.0.len();
        let expected_block_count = expected.iter().dedup().count() + 1;
        assert_eq!(expected_block_count, actual_block_count, "too many blocks");

        // Make sure we didn't lose any `u64::MAX` coordinates
        const FINITE_LIMIT: u64 = u64::MAX / 2; // doesn't matter exactly what this is
        for block in actual.iter() {
            assert!(block.start < FINITE_LIMIT);
            if block.end > FINITE_LIMIT {
                assert_eq!(block.end, u64::MAX);
            }
        }
    }
}
