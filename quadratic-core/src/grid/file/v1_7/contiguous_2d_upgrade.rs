// This file contains code copied from `contiguous_2d.rs`, `contiguous_blocks.rs` and
// `block.rs` in the `contiguous` module. Only the parts necessary for upgrade are included.

use std::collections::{BTreeMap, btree_map};

use itertools::Itertools;
use smallvec::{SmallVec, smallvec};

use crate::grid::file::v1_7_1::{BlockSchema, Contiguous2DSchema};

/// Key-value store from cell positions to values, optimized for contiguous
/// rectangles with the same value, particularly along columns. All (infinitely
/// many) values are initialized to default.
///
/// Supports infinite blocks down, right, and down-right.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Contiguous2DUpgrade<T>(ContiguousBlocks<ContiguousBlocks<T>>);
impl<T: Default> Default for Contiguous2DUpgrade<T> {
    fn default() -> Self {
        Self(ContiguousBlocks::default())
    }
}
impl<T: Default + Clone + PartialEq> From<ContiguousBlocks<Option<ContiguousBlocks<T>>>>
    for Contiguous2DUpgrade<T>
{
    fn from(value: ContiguousBlocks<Option<ContiguousBlocks<T>>>) -> Self {
        Self(value.map(Option::unwrap_or_default))
    }
}
impl<T: Default + Clone + PartialEq> From<Contiguous2DUpgrade<T>>
    for ContiguousBlocks<Option<ContiguousBlocks<T>>>
{
    fn from(value: Contiguous2DUpgrade<T>) -> Self {
        value.0.map(|col| (!col.is_all_default()).then_some(col))
    }
}
impl<T: Default + Clone + PartialEq> Contiguous2DUpgrade<T> {
    /// Constructs a [`Contiguous2DUpgrade`] containing `value` inside a (possibly
    /// infinite) rectangle and `T::default()` everywhere else.
    ///
    /// All coordinates are inclusive.
    ///
    /// If `x2` or `y2` are `None`, the rectangle is infinite in that direction.
    fn from_rect(x1: i64, y1: i64, x2: Option<i64>, y2: Option<i64>, value: T) -> Self {
        match convert_rect(x1, y1, x2, y2) {
            None => Self::default(),
            Some((x1, y1, x2, y2)) => Self(ContiguousBlocks::from_block(BlockSchema {
                start: x1,
                end: x2,
                value: ContiguousBlocks::from_block(BlockSchema {
                    start: y1,
                    end: y2,
                    value,
                }),
            })),
        }
    }

    /// For each non-`None` value in `other`, updates the range in `self` using
    /// `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    fn update_from<U: PartialEq, R: Clone + PartialEq>(
        &mut self,
        other: &Contiguous2DUpgrade<Option<U>>,
        update_fn: impl Fn(&mut T, &U) -> Option<R>,
    ) -> Contiguous2DUpgrade<Option<R>> {
        self.0
            .update_non_default_from(&other.0, |col, col_update| {
                Some(
                    col.update_non_default_from(col_update, |value, value_update| {
                        update_fn(value, value_update.as_ref()?)
                    }),
                )
            })
            .into()
    }

    /// Sets non-`None` values from `other`, and returns the blocks to set to
    /// undo it.
    fn set_from(
        &mut self,
        other: &Contiguous2DUpgrade<Option<T>>,
    ) -> Contiguous2DUpgrade<Option<T>> {
        self.update_from(other, |value, new_value| {
            (value != new_value).then(|| std::mem::replace(value, new_value.clone()))
        })
    }

    /// Returns all data as owned 2D blocks.
    pub(crate) fn into_xy_blocks(
        self,
    ) -> impl Iterator<Item = BlockSchema<impl Iterator<Item = BlockSchema<T>>>> {
        self.0
            .into_iter()
            .map(|column_block| column_block.map(|column_data| column_data.into_iter()))
    }

    /// Sets a rectangle to the same value and returns the blocks to set undo
    /// it.
    ///
    /// All coordinates are inclusive.
    ///
    /// If `x2` or `y2` are `None`, the rectangle is infinite in that direction.
    pub(crate) fn set_rect(
        &mut self,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
        value: T,
    ) -> Contiguous2DUpgrade<Option<T>> {
        self.set_from(&Contiguous2DUpgrade::from_rect(x1, y1, x2, y2, Some(value)))
    }

    pub(crate) fn upgrade_schema(self) -> Contiguous2DSchema<T> {
        self.into_xy_blocks()
            .map(|x_block| BlockSchema {
                start: x_block.start,
                end: x_block.end,
                value: x_block
                    .value
                    .map(|y_block| BlockSchema {
                        start: y_block.start,
                        end: y_block.end,
                        value: y_block.value,
                    })
                    .collect(),
            })
            .collect()
    }
}

// normalizes the bounds so that the first is always less than the second
fn sort_bounds(a: i64, b: Option<i64>) -> (i64, Option<i64>) {
    match b {
        Some(b) if b < a => (b, Some(a)),
        _ => (a, b),
    }
}

/// Casts an `i64` rectangle that INCLUDES both bounds to a `u64` rectangle that
/// INCLUDES the starts and EXCLUDES the ends. Clamps the results to greater
/// than 1. Returns `None` if there is no part of the rectangle that intersects
/// the valid region. `u64::MAX` represents infinity.
///
/// TODO: when doing `i64 -> u64` refactor, consider making `Rect` do this
///       validation on construction. this means we'd need to handle infinity
///       everywhere.
fn convert_rect(
    x1: i64,
    y1: i64,
    x2: Option<i64>,
    y2: Option<i64>,
) -> Option<(u64, u64, u64, u64)> {
    let (x1, x2) = sort_bounds(x1, x2);
    let (y1, y2) = sort_bounds(y1, y2);

    let x1 = x1.try_into().unwrap_or(0).max(1);
    let x2 = x2
        .map(|x| x.try_into().unwrap_or(0))
        .unwrap_or(u64::MAX)
        .saturating_add(1);

    let y1 = y1.try_into().unwrap_or(0).max(1);
    let y2 = y2
        .map(|y| y.try_into().unwrap_or(0))
        .unwrap_or(u64::MAX)
        .saturating_add(1);

    (x1 < x2 && y1 < y2).then_some((x1, y1, x2, y2))
}

/// Key-value store from positive integers to values, optimized for contiguous
/// blocks with the same value.
///
/// # Invariants
///
/// - For each `(key, block)` pair, `key == block.start`
/// - All blocks are nonempty (`block.start < block.end`)
/// - Every coordinate from `1` to `u64::MAX` is covered by exactly one block
/// - There is no block that covers the coordinate `0`
#[derive(Debug, Clone, PartialEq, Eq)]
struct ContiguousBlocks<T>(BTreeMap<u64, BlockSchema<T>>);
impl<T: Default> Default for ContiguousBlocks<T> {
    fn default() -> Self {
        Self(BTreeMap::from_iter([(
            1,
            BlockSchema::new_total(T::default()),
        )]))
    }
}
impl<T> IntoIterator for ContiguousBlocks<T> {
    type Item = BlockSchema<T>;
    type IntoIter = btree_map::IntoValues<u64, BlockSchema<T>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_values()
    }
}
impl<'a, T> IntoIterator for &'a ContiguousBlocks<T> {
    type Item = &'a BlockSchema<T>;

    type IntoIter = btree_map::Values<'a, u64, BlockSchema<T>>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}
impl<T> ContiguousBlocks<T> {
    /// Iterates over all the blocks.
    fn iter(&self) -> btree_map::Values<'_, u64, BlockSchema<T>> {
        self.0.values()
    }
}
impl<T: Default> ContiguousBlocks<T> {
    /// Constructs a mapping with all infinitely many values initialized to
    /// `T::default()`.
    fn new() -> Self {
        Self::default()
    }
}
impl<T: Default + PartialEq> ContiguousBlocks<T> {
    /// Constructs a map with only a single non-default block.
    fn from_block(block: BlockSchema<T>) -> Self
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
    fn is_all_default(&self) -> bool {
        let default = T::default();
        self.0.values().all(|block| block.value == default)
    }

    /// Returns an iterator over all non-default blocks.
    fn non_default_blocks(&self) -> impl DoubleEndedIterator<Item = &BlockSchema<T>> {
        self.0.values().filter(|block| block.value != T::default())
    }
}
impl<T: Clone + PartialEq> ContiguousBlocks<T> {
    /// Constructs a new [`ContiguousBlocks`] by applying a pure function to
    /// every value.
    fn map<U: Clone + PartialEq>(self, f: impl Fn(T) -> U) -> ContiguousBlocks<U> {
        let mut ret = ContiguousBlocks(
            self.into_iter()
                .map(|block| (block.start, block.map(&f)))
                .collect(),
        );
        ret.try_merge_everywhere();
        ret
    }

    /// Returns the block containing `coordinate`, if any.
    fn get_block_containing(&self, coordinate: u64) -> Option<&BlockSchema<T>> {
        self.0
            .range(..=coordinate)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(coordinate))
    }
    /// Adds a block to the data structure. **This breaks the invariant that
    /// every key is covered exactly once.**
    fn add_block(&mut self, mut block: BlockSchema<T>) {
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
    fn add_blocks(&mut self, blocks: impl IntoIterator<Item = BlockSchema<T>>) {
        for block in blocks {
            self.add_block(block);
        }
    }

    /// Returns whether `self` has any values in the range from `start` to `end`.
    fn has_any_in_range(&self, start: u64, end: u64) -> bool {
        self.blocks_touching_range(start, end).next().is_some()
    }

    /// Iterates over blocks that touch the range from `start` to `end`.
    fn blocks_touching_range(&self, start: u64, end: u64) -> impl Iterator<Item = &BlockSchema<T>> {
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

    /// Removes all blocks that touch the range from `start` to `end`, in order.
    /// **This breaks the invariant that every key is covered exactly once.**
    fn remove_blocks_touching_range(
        &mut self,
        start: u64,
        end: u64,
    ) -> impl '_ + Iterator<Item = BlockSchema<T>> {
        let block_starts = self
            .blocks_touching_range(start, end)
            .map(|block| block.start)
            .collect_vec();
        block_starts.into_iter().filter_map(|y| self.0.remove(&y))
    }

    /// Removes all values in the range from `start` to `end`. **This breaks the
    /// invariant that every key is covered exactly once.**
    fn raw_remove_range(&mut self, start: u64, end: u64) {
        let mut to_put_back: SmallVec<[BlockSchema<T>; 2]> = smallvec![];

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
    fn remove_range(&mut self, start: u64, end: u64) -> Vec<BlockSchema<T>> {
        let mut to_return = vec![];
        let mut to_put_back: SmallVec<[BlockSchema<T>; 2]> = smallvec![];

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
    fn raw_set_block(&mut self, block: BlockSchema<T>) {
        // `remove_range()` and `add_block()` each perform their own input
        // validation.
        self.raw_remove_range(block.start, block.end);
        self.add_block(block);
    }

    /// Updates a range of values using `update_fn` and returns a list of blocks
    /// to perform the reverse operation.
    ///
    /// - `R` is the data required to perform the reverse operation.
    fn update_range<R>(
        &mut self,
        start: u64,
        end: u64,
        update_fn: impl Fn(&mut T) -> R,
    ) -> Vec<BlockSchema<R>> {
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
        other: impl IntoIterator<Item = BlockSchema<U>>,
        update_fn: impl Fn(&mut T, &U) -> R,
    ) -> Vec<BlockSchema<R>> {
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
    fn update_non_default_from<U: Default + PartialEq, R: Clone + PartialEq>(
        &mut self,
        other: &ContiguousBlocks<U>,
        update_fn: impl Fn(&mut T, &U) -> Option<R>,
    ) -> ContiguousBlocks<Option<R>> {
        let mut ret = ContiguousBlocks::new();
        let return_blocks = self.update_blocks(
            other.non_default_blocks().map(BlockSchema::as_ref),
            |t, &u| update_fn(t, u),
        );
        for return_block in return_blocks {
            ret.raw_set_block(return_block);
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
}

impl<T: std::fmt::Debug> std::fmt::Debug for BlockSchema<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self.end {
            u64::MAX => write!(f, "({:?}, {:?})", self.start.., self.value),
            _ => write!(f, "({:?}, {:?})", self.start..self.end, self.value),
        }
    }
}
impl<T> BlockSchema<T> {
    /// Return a block that covers the entire space
    fn new_total(value: T) -> Self {
        Self {
            start: 1,
            end: u64::MAX,
            value,
        }
    }
}
impl<T> BlockSchema<T> {
    /// Returns the length of the block, or `None` if it is unbounded.
    fn len(&self) -> Option<u64> {
        (self.end < u64::MAX || self.start == self.end)
            .then_some(self.end.saturating_sub(self.start))
    }
    /// Returns whether the block is empty (length 0).
    fn is_empty(&self) -> bool {
        self.len() == Some(0)
    }
    /// Returns the block if it is nonempty, or `None` if it is empty.
    fn if_nonempty(self) -> Option<Self> {
        (!self.is_empty()).then_some(self)
    }

    /// Returns whether the block contains a coordinate.
    fn contains(&self, coordinate: u64) -> bool {
        self.start <= coordinate && (coordinate < self.end || self.end == u64::MAX)
    }
    /// Clamps a coordinate to `self`. Both endpoints are allowed.
    fn clamp(&self, coordinate: u64) -> u64 {
        coordinate.clamp(self.start, self.end)
    }

    /// Applies a function to the value in the block.
    fn map<U>(self, f: impl FnOnce(T) -> U) -> BlockSchema<U> {
        BlockSchema {
            start: self.start,
            end: self.end,
            value: f(self.value),
        }
    }
    /// Applies a function to the value in the block.
    fn map_ref<'a, U>(&'a self, f: impl FnOnce(&'a T) -> U) -> BlockSchema<U> {
        BlockSchema {
            start: self.start,
            end: self.end,
            value: f(&self.value),
        }
    }
    /// Converts a `&Block<T>` to a `Block<&T>`.
    fn as_ref(&self) -> BlockSchema<&T> {
        self.map_ref(|value| value)
    }
}
impl<T: Clone + PartialEq> BlockSchema<T> {
    /// Splits the block at `coordinate`, returning the halves before and after.
    fn split(self, coordinate: u64) -> [Option<Self>; 2] {
        let clamped_coordinate = self.clamp(coordinate);
        [
            BlockSchema {
                start: self.start,
                end: clamped_coordinate,
                value: self.value.clone(),
            },
            BlockSchema {
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
    fn split_twice(self, start: u64, end: u64) -> [Option<Self>; 3] {
        let [before, middle_after] = self.split(start);
        let [middle, after] = match middle_after {
            Some(block) => block.split(end),
            None => [None, None],
        };

        [before, middle, after]
    }
}
