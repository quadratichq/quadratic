use std::collections::{btree_map, BTreeMap};

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::block::Block;

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
    pub(crate) BTreeMap<i64, Block<T>>,
);
impl<T> Default for ContiguousBlocks<T> {
    fn default() -> Self {
        Self(BTreeMap::default())
    }
}
impl<T> IntoIterator for ContiguousBlocks<T> {
    type Item = (i64, Block<T>);
    type IntoIter = btree_map::IntoIter<i64, Block<T>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl<T> FromIterator<(i64, Block<T>)> for ContiguousBlocks<T> {
    fn from_iter<I: IntoIterator<Item = (i64, Block<T>)>>(iter: I) -> Self {
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
    pub fn max(&self) -> Option<i64> {
        match self.0.last_key_value() {
            Some((_, block)) => (block.end < i64::MAX).then_some(block.end.saturating_sub(1)),
            None => Some(0), // no values
        }
    }

    fn get_block_containing(&self, coordinate: i64) -> Option<&Block<T>> {
        self.0
            .range(..=coordinate)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(coordinate))
    }
    fn remove_block_containing(&mut self, coordinate: i64) -> Option<Block<T>> {
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
    fn has_any_in_range(&self, start: i64, end: i64) -> bool {
        self.blocks_touching_range(start, end).next().is_some()
    }

    /// Iterates over blocks that touch the range from `start` to `end`.
    fn blocks_touching_range(&self, start: i64, end: i64) -> impl Iterator<Item = &Block<T>> {
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
        start: i64,
        end: i64,
    ) -> impl '_ + Iterator<Item = Block<T>> {
        let block_starts = self
            .blocks_touching_range(start, end)
            .map(|block| block.start)
            .collect_vec();
        block_starts.into_iter().filter_map(|y| self.0.remove(&y))
    }
    /// Returns the value at `coordinate`, or `None` if it is default.
    pub fn get(&self, coordinate: i64) -> Option<&T> {
        self.get_block_containing(coordinate)
            .map(|block| &block.value)
    }
    /// Removes all values in the range from `start` to `end` and returns a list
    /// of blocks that can be added to restore them.
    pub fn remove_range(&mut self, start: i64, end: i64) -> Vec<Block<T>> {
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
    pub fn remove_range_complete(&mut self, start: i64, end: i64) -> Vec<Block<Option<T>>> {
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
    pub fn set_range(&mut self, start: i64, end: i64, value: T) -> ContiguousBlocks<Option<T>> {
        self.set_blocks([Block {
            start,
            end,
            value: Some(value),
        }])
    }

    /// Sets a value and returns the old value at `coordinate`.
    pub fn set(&mut self, coordinate: i64, value: T) -> Option<T> {
        self.set_range(coordinate, coordinate.saturating_add(1), value)
            .into_values()
            .next()?
            .value
    }
    /// Removes the value at `coordinate`, returning it.
    pub fn remove(&mut self, coordinate: i64) -> Option<T> {
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
        start: i64,
        end: i64,
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
        other: impl IntoIterator<Item = (i64, Block<U>)>,
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

    fn try_merge_at(&mut self, coordinate: i64) {
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
    pub fn shift_insert(&mut self, coordinate: i64, value: Option<T>) {
        let shifted_blocks = self
            .remove_range(coordinate, i64::MAX)
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
    pub fn shift_remove(&mut self, coordinate: i64) -> Option<T> {
        let old_value = self.remove(coordinate);
        let shifted_blocks = self
            .remove_range(coordinate.saturating_add(1), i64::MAX)
            .into_iter()
            .map(|block| block.subtract_offset(1));
        self.add_blocks(shifted_blocks);
        old_value
    }
}
