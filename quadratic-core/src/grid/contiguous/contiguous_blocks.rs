use std::collections::{BTreeMap, btree_map};

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{SmallVec, smallvec};

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
impl<'a, T> IntoIterator for &'a ContiguousBlocks<T> {
    type Item = &'a Block<T>;

    type IntoIter = btree_map::Values<'a, u64, Block<T>>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}
impl<T> ContiguousBlocks<T> {
    /// Iterates over all the blocks.
    pub(crate) fn iter(&self) -> btree_map::Values<'_, u64, Block<T>> {
        self.0.values()
    }
}
impl<T: Default> ContiguousBlocks<T> {
    /// Constructs a mapping with all infinitely many values initialized to
    /// `T::default()`.
    pub(crate) fn new() -> Self {
        Self::default()
    }
}
impl<T: Default + PartialEq> ContiguousBlocks<T> {
    /// Constructs a map with only a single non-default block.
    pub(crate) fn from_block(block: Block<T>) -> Self
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
    pub(crate) fn is_all_default(&self) -> bool {
        let default = T::default();
        self.0.values().all(|block| block.value == default)
    }

    /// Returns whether the values in the range `start..end` are all default.
    pub(crate) fn is_all_default_in_range(&self, start: u64, end: u64) -> bool
    where
        T: Clone,
    {
        let default = T::default();
        self.blocks_touching_range(start, end)
            .all(|value_block| value_block.value == default)
    }

    /// Returns an iterator over all non-default blocks.
    fn non_default_blocks(&self) -> impl DoubleEndedIterator<Item = &Block<T>> {
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
        if self.0.contains_key(&0) {
            return Err("block contains 0");
        }

        Ok(())
    }

    /// Constructs a new [`ContiguousBlocks`] by applying a pure function to
    /// every value.
    pub(crate) fn map<U: Clone + PartialEq>(self, f: impl Fn(T) -> U) -> ContiguousBlocks<U> {
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
    pub(crate) fn map_ref<U: Clone + PartialEq>(&self, f: impl Fn(&T) -> U) -> ContiguousBlocks<U> {
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
    pub(crate) fn finite_max(&self) -> u64
    where
        T: Default,
    {
        self.non_default_blocks()
            .last()
            .map(|block| block.finite_max())
            .unwrap_or(0)
    }

    /// Returns the lower bound on the finite regions. Returns 0 if there are no
    pub(crate) fn min(&self) -> Option<u64>
    where
        T: Default,
    {
        self.non_default_blocks()
            .rev()
            .next_back()
            .map(|block| block.start)
    }

    /// Returns the block containing `coordinate`, if any.
    pub(crate) fn get_block_containing(&self, coordinate: u64) -> Option<&Block<T>> {
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

    /// Returns whether `self` has any values in the range `start..end`.
    fn has_any_in_range(&self, start: u64, end: u64) -> bool {
        self.blocks_touching_range(start, end).next().is_some()
    }

    /// Iterates over blocks that touch the range `start..end`.
    pub(super) fn blocks_touching_range(
        &self,
        start: u64,
        end: u64,
    ) -> impl Iterator<Item = &Block<T>> {
        // There may be a block starting above `y_range.start` that contains
        // `y_range`, so find that.
        let first_block = self
            .get_block_containing(start)
            // filter to avoid double-counting
            .filter(|block| block.start != start)
            // filter to avoid bad ranges
            .filter(|_| start < end);

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

    /// Returns an exact set of blocks representing the values in the range from
    /// `start..end`.
    pub(crate) fn blocks_for_range(&self, start: u64, end: u64) -> impl Iterator<Item = Block<&T>> {
        self.blocks_touching_range(start, end)
            .map(move |block| Block {
                start: u64::max(block.start, start),
                end: u64::min(block.end, end),
                value: &block.value,
            })
    }

    /// Removes all blocks that touch the range `start..end`, in order. **This
    /// breaks the invariant that every key is covered exactly once.**
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
    pub(crate) fn get(&self, coordinate: u64) -> Option<&T> {
        self.get_block_containing(coordinate)
            .map(|block| &block.value)
    }
    /// Removes all values in the range `start..end`. **This breaks the
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
    /// Removes all values in the range `start..end` and returns a list of
    /// blocks that can be added to restore them. **This breaks the invariant
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
    #[cfg(test)]
    pub(crate) fn set_blocks(
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
    pub(crate) fn set(&mut self, coordinate: u64, value: T) -> Option<T> {
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
    pub(crate) fn update<R>(&mut self, coordinate: u64, f: impl FnOnce(&mut T) -> R) -> Option<R> {
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
    pub(crate) fn update_non_default_from<U: Default + PartialEq, R: Clone + PartialEq>(
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
    pub(crate) fn update_all<R: Clone + PartialEq>(
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

    /// For each non-default value in `other`, calls `predicate` with the
    /// corresponding values in `self` and `other`. Returns `true` if **any**
    /// invocation of `predicate` returns true.
    pub(crate) fn zip_any<U: Default + PartialEq>(
        &self,
        other: &ContiguousBlocks<U>,
        predicate: impl Fn(&T, &U) -> bool,
    ) -> bool {
        other.iter().any(|other_block| {
            self.blocks_touching_range(other_block.start, other_block.end)
                .any(|self_block| predicate(&self_block.value, &other_block.value))
        })
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

    /// Shifts everything from `start` onwards by `end-start` and then sets the
    /// values `start..end`.
    pub(crate) fn shift_insert(&mut self, start: u64, end: u64, value: T) {
        let start = start.max(1);
        let end = end.max(1);
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
    /// Removes the values `start..end` and shifts everything from `end` onwards
    /// by `start-end`.
    pub(crate) fn shift_remove(&mut self, start: u64, end: u64) {
        let start = start.max(1);
        let end = end.max(1);
        let Some(offset) = end.checked_sub(start) else {
            return;
        };
        self.raw_remove_range(start, end);
        let shifted_blocks = self
            .remove_range(end, u64::MAX)
            .into_iter()
            .filter_map(|block| block.subtract_offset(offset));
        self.add_blocks(shifted_blocks);
    }

    /// Translates all non-default values.
    ///
    /// Values before position 1 are truncated.
    pub(crate) fn translate_in_place(&mut self, delta: i64)
    where
        T: Default,
    {
        match delta {
            ..0 => self.shift_remove(1, (1 - delta) as u64),
            1.. => self.shift_insert(1, (1 + delta) as u64, T::default()),
            0 => (),
        }
    }

    pub(crate) fn values_mut(&mut self) -> impl Iterator<Item = &mut Block<T>> {
        self.0.values_mut()
    }
}

#[cfg(test)]
mod tests {
    use itertools::Itertools;
    use proptest::prelude::*;

    use super::*;

    // Comment out variants to test individual operations
    #[derive(Debug, Copy, Clone, proptest_derive::Arbitrary)]
    enum TestOp {
        SetBlock {
            start: u8,
            end: Option<u8>,
            value: u8,
        },
        Set {
            index: u8,
            value: u8,
        },
        Increment {
            index: u8,
        },
        IncrementRange {
            start: u8,
            end: Option<u8>,
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
            };
            let mut expected = vec![0; finite_end];
            let mut infinity = 0;
            if (start as usize) < finite_end {
                expected[start as usize..finite_end].fill(value);
                if end.is_none() {
                    infinity = value;
                }
            }

            let actual = ContiguousBlocks::from_block(Block {
                start: start as u64,
                end: end.map(|x| x as u64).unwrap_or(u64::MAX),
                value,
            });

            assert_matches_vec(expected, infinity, actual);
        }

        #[test]
        fn test_contiguous_blocks(ops: Vec<TestOp>) {
            let mut expected = vec![];
            let mut infinity = 0;
            let mut actual = ContiguousBlocks::default();

            for op in ops {
                let required_len = match op {
                    TestOp::SetBlock { start, end, .. } => end.unwrap_or(start),
                    TestOp::Set { index, .. } => index,
                    TestOp::Increment { index } => index,
                    TestOp::IncrementRange { start, end, .. } => end.unwrap_or(start),
                    TestOp::ShiftInsert { end, .. } => end,
                    TestOp::ShiftRemove { end, .. } => end,
                };
                while expected.len() <= required_len as usize {
                    expected.push(infinity);
                }

                match op {
                    TestOp::SetBlock { start, end, value } => {
                        let reverse_op = actual.set_blocks(ContiguousBlocks::from_block(Block {
                            start: start as u64,
                            end: end.map(|i| i as u64).unwrap_or(u64::MAX),
                            value: Some(value),
                        }));

                        // Before we update `expected`, check that undo works
                        // correctly.
                        let mut test = actual.clone();
                        test.set_blocks(reverse_op);
                        assert_matches_vec(expected.clone(), infinity, test);

                        let start = start as usize;
                        let end = match end {
                            Some(i) => i as usize,
                            None => {
                                infinity = value;
                                expected.len()
                            }
                        };
                        if start < end {
                            expected[start..end].fill(value);
                        }
                    }
                    TestOp::Set { index, value } => {
                        while expected.len() <= index as usize {
                            expected.push(infinity);
                        }
                        let old_value = actual.set(index as u64, value);
                        let expected_old_value = (index > 0).then_some(expected[index as usize]);
                        assert_eq!(expected_old_value, old_value, "wrong old value");
                        expected[index as usize] = value;
                    }
                    TestOp::Increment { index } => {
                        let ret = actual.update(index as u64, |n| {
                            *n = n.wrapping_add(1);
                            42
                        });
                        assert_eq!((index > 0).then_some(42), ret);
                        expected[index as usize] = expected[index as usize].wrapping_add(1);
                    }
                    TestOp::IncrementRange { start, end } => {
                        let reverse_op = actual.update_range(
                            start as u64,
                            end.map(|i| i as u64).unwrap_or(u64::MAX),
                            |n| std::mem::replace(n, n.wrapping_add(1)),
                        );

                        // Before we update `expected`, check that undo works
                        // correctly.
                        let mut test = actual.clone();
                        for block in reverse_op {
                            test.raw_set_block(block);
                        }
                        assert_matches_vec(expected.clone(), infinity, test);

                        let start = start as usize;
                        let end = match end {
                            Some(i) => i as usize,
                            None => {
                                infinity = infinity.wrapping_add(1);
                                expected.len()
                            }
                        };
                        #[allow(clippy::needless_range_loop)]
                        for i in start..end {
                            expected[i] = expected[i].wrapping_add(1);
                        }
                    }
                    TestOp::ShiftInsert { start, end, value } => {
                        actual.shift_insert(start as u64, end as u64, value);
                        for i in start.max(1)..end.max(1) {
                            expected.insert(i as usize, value);
                        }
                    }
                    TestOp::ShiftRemove { start, end } => {
                        actual.shift_remove(start as u64, end as u64);
                        for _ in start.max(1)..end.max(1) {
                            expected.remove(start as usize);
                        }
                    }
                }
            }

            assert_matches_vec(expected, infinity, actual);
        }
    }

    fn assert_matches_vec(mut expected: Vec<u8>, infinity: u8, actual: ContiguousBlocks<u8>) {
        actual.check_validity().unwrap();

        assert_eq!(None, actual.get(0));
        for i in 1..expected.len() {
            assert_eq!(expected.get(i), actual.get(i as u64), "wrong value at {i}");
        }
        assert_eq!(
            Some(&infinity),
            actual.get(expected.len().max(1) as u64),
            "wrong value at infinity",
        );

        // remove index 0 from `expected` because `actual` skips index 0
        if !expected.is_empty() {
            expected.remove(0);
        }

        let is_all_default = expected.iter().all(|&val| val == 0) && infinity == 0;
        assert_eq!(is_all_default, actual.is_all_default());

        while expected.last() == Some(&infinity) {
            expected.pop();
        }
        let expected_finite_max = if infinity == 0 {
            expected.len() as u64 // finite values only
        } else {
            expected.len() as u64 + 1 // infinite values starting at last block
        };
        assert_eq!(expected_finite_max, actual.finite_max(), "wrong finite max");

        // Check that we are using the minimal number of blocks
        let expected_block_count = expected.iter().dedup().count() + 1;
        let actual_block_count = actual.0.len();
        assert_eq!(expected_block_count, actual_block_count, "too many blocks");

        expected.push(infinity);
        let expected_non_default_blocks = expected.iter().dedup().filter(|&&x| x != 0);
        let actual_non_default_blocks = actual.non_default_blocks().map(|block| &block.value);
        itertools::assert_equal(expected_non_default_blocks, actual_non_default_blocks);

        // Make sure we didn't lose any `u64::MAX` coordinates
        const FINITE_LIMIT: u64 = u64::MAX / 2; // doesn't matter exactly what this is
        for block in &actual {
            assert!(block.start < FINITE_LIMIT);
            if block.end > FINITE_LIMIT {
                assert_eq!(block.end, u64::MAX);
            }
        }
    }

    #[test]
    fn test_translate() {
        let mut blocks = ContiguousBlocks::new();
        blocks.set(1, "hello");
        blocks.set(5, "world");

        blocks.translate_in_place(10);
        blocks.check_validity().unwrap();

        let mut expected = ContiguousBlocks::new();
        expected.set(11, "hello");
        expected.set(15, "world");
        assert_eq!(blocks, expected);

        blocks.translate_in_place(-11);
        blocks.check_validity().unwrap();

        let mut expected = ContiguousBlocks::new();
        expected.set(4, "world");
        assert_eq!(blocks, expected);

        blocks.translate_in_place(-10);
        assert_eq!(blocks, ContiguousBlocks::new());
    }
}
