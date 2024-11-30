use std::collections::{btree_map, BTreeMap};

use itertools::Itertools;
use smallvec::{smallvec, SmallVec};

use super::{BlockSchema, FormatSchema};

#[derive(Default)]
pub struct SheetFormattingUpgrade(Contiguous2D<FormatSchema>);
impl IntoIterator for SheetFormattingUpgrade {
    type Item = (i64, BlockSchema<ContiguousBlocks<FormatSchema>>);
    type IntoIter = btree_map::IntoIter<i64, BlockSchema<ContiguousBlocks<FormatSchema>>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl SheetFormattingUpgrade {
    pub fn set_all(&mut self, values: Option<FormatSchema>) {
        self.0.set_rect(0, 0, None, None, values);
    }

    pub fn set_column(&mut self, column: i64, values: Option<FormatSchema>) {
        self.0.set_column(column, values);
    }

    pub fn set_row(&mut self, row: i64, values: Option<FormatSchema>) {
        self.0.set_row(row, values);
    }

    pub fn set_column_repeat(&mut self, x: i64, y: i64, len: u32, values: Option<FormatSchema>) {
        self.0
            .set_rect(x, y, Some(x), Some(y + len as i64 - 1), values);
    }
}

/// Key-value store from cell positions to values, optimized for contiguous
/// rectangles with the same value, particularly along columns. All (infinitely
/// many) values are initialized to default.
///
/// Supports infinite blocks down, right, and down-right.
struct Contiguous2D<T>(ContiguousBlocks<ContiguousBlocks<T>>);
impl<T> Default for Contiguous2D<T> {
    fn default() -> Self {
        Self(ContiguousBlocks::default())
    }
}
impl<T> IntoIterator for Contiguous2D<T> {
    type Item = (i64, BlockSchema<ContiguousBlocks<T>>);
    type IntoIter = btree_map::IntoIter<i64, BlockSchema<ContiguousBlocks<T>>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl<T: Clone + PartialEq> Contiguous2D<T> {
    /// Sets values from `other`, and returns the blocks to set to undo it.
    fn set_from(&mut self, other: Contiguous2D<Option<T>>) -> Contiguous2D<Option<T>> {
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
    fn set_rect(
        &mut self,
        x1: i64,
        y1: i64,
        x2: Option<i64>,
        y2: Option<i64>,
        value: Option<T>,
    ) -> Contiguous2D<Option<T>> {
        self.set_from(Contiguous2D(ContiguousBlocks::from_block(BlockSchema {
            start: x1,
            end: x2.unwrap_or(i64::MAX).saturating_add(1),
            value: ContiguousBlocks::from_block(BlockSchema {
                start: y1,
                end: y2.unwrap_or(i64::MAX).saturating_add(1),
                value,
            }),
        })))
    }

    fn set_column(&mut self, column: i64, value: Option<T>) -> Contiguous2D<Option<T>> {
        self.set_rect(column, 1, Some(column), None, value)
    }

    fn set_row(&mut self, row: i64, value: Option<T>) -> Contiguous2D<Option<T>> {
        self.set_rect(1, row, None, Some(row), value)
    }
}

/// Key-value store from nonnegative integers to values, optimized for
/// contiguous blocks with the same value. All (infinitely many) values are
/// initialized to default.
///
/// Supports a single infinite block of the same value at the end.
#[derive(Clone, PartialEq)]
pub struct ContiguousBlocks<T>(BTreeMap<i64, BlockSchema<T>>);
impl<T> Default for ContiguousBlocks<T> {
    fn default() -> Self {
        Self(BTreeMap::default())
    }
}
impl<T> IntoIterator for ContiguousBlocks<T> {
    type Item = (i64, BlockSchema<T>);
    type IntoIter = btree_map::IntoIter<i64, BlockSchema<T>>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl<T: Clone + PartialEq> ContiguousBlocks<T> {
    /// Constructs an empty map.
    fn new() -> Self {
        Self::default()
    }

    /// Constructs a map with only a single block.
    fn from_block(block: BlockSchema<T>) -> Self {
        let mut ret = Self::new();
        ret.add_block(block);
        ret
    }

    /// Returns whether the contiguous blocks are all default values.
    fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    fn get_block_containing(&self, coordinate: i64) -> Option<&BlockSchema<T>> {
        self.0
            .range(..=coordinate)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(coordinate))
    }

    fn remove_block_containing(&mut self, coordinate: i64) -> Option<BlockSchema<T>> {
        let key = self.get_block_containing(coordinate)?.start;
        self.0.remove(&key)
    }

    fn add_block(&mut self, block: BlockSchema<T>) {
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

    fn add_blocks(&mut self, blocks: impl IntoIterator<Item = BlockSchema<T>>) {
        for block in blocks {
            self.add_block(block);
        }
    }

    /// Returns whether `self` has any values in the range from `start` to `end`.
    fn has_any_in_range(&self, start: i64, end: i64) -> bool {
        self.blocks_touching_range(start, end).next().is_some()
    }

    /// Iterates over blocks that touch the range from `start` to `end`.
    fn blocks_touching_range(&self, start: i64, end: i64) -> impl Iterator<Item = &BlockSchema<T>> {
        let first_block = self
            .get_block_containing(start)
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
    ) -> impl '_ + Iterator<Item = BlockSchema<T>> {
        let block_starts = self
            .blocks_touching_range(start, end)
            .map(|block| block.start)
            .collect_vec();
        block_starts.into_iter().filter_map(|y| self.0.remove(&y))
    }

    /// Returns the value at `coordinate`, or `None` if it is default.
    fn get(&self, coordinate: i64) -> Option<&T> {
        self.get_block_containing(coordinate)
            .map(|block| &block.value)
    }

    /// Removes all values in the range from `start` to `end` and returns a list
    /// of blocks that can be added to restore them.
    fn remove_range(&mut self, start: i64, end: i64) -> Vec<BlockSchema<T>> {
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

    /// Removes all values in the range from `start` to `end` and returns a list
    /// of blocks containing the old values that completely covers the region.
    fn remove_range_complete(&mut self, start: i64, end: i64) -> Vec<BlockSchema<Option<T>>> {
        let mut ret = vec![];
        let mut index = start;
        for block in self.remove_range(start, end) {
            if index < block.start {
                ret.push(BlockSchema {
                    start: index,
                    end: block.start,
                    value: None,
                });
            }
            index = block.end;
            ret.push(block.map(Some));
        }
        if index < end {
            ret.push(BlockSchema {
                start: index,
                end,
                value: None,
            });
        }
        ret
    }

    /// Updates a range of values using `update_fn`.
    ///
    /// - `U` is the data required to update the value.
    /// - `R` is the data required to perform the reverse operation.
    fn update_range<R>(
        &mut self,
        start: i64,
        end: i64,
        update_fn: impl Fn(Option<T>) -> (Option<T>, R),
    ) -> Vec<BlockSchema<R>> {
        let mut return_blocks = vec![];
        for old_block in self.remove_range_complete(start, end) {
            let (new_block, return_block) = old_block.map_split(&update_fn);
            if let Some(new_block) = new_block.into_some() {
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
    fn update_from_blocks<U, R: Clone + PartialEq>(
        &mut self,
        other: impl IntoIterator<Item = (i64, BlockSchema<U>)>,
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
            self.add_blocks(BlockSchema::try_merge(block1, block2));
        }
    }
}

impl<T: Clone + PartialEq> BlockSchema<T> {
    /// Returns the length of the block, or `None` if it is unbounded.
    fn len(&self) -> Option<i64> {
        (self.end < i64::MAX || self.start == self.end)
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

    /// Returns whether the block contains the key `coordinate`.
    fn contains(&self, coordinate: i64) -> bool {
        self.start <= coordinate && (coordinate < self.end || self.end == i64::MAX)
    }

    /// Clamps a coordinate to `self`. Both endpoints are allowed.
    fn clamp(&self, coordinate: i64) -> i64 {
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

    /// Applies a function to the value in the block and creates two new blocks
    /// with the same range.
    fn map_split<U, V>(self, f: impl FnOnce(T) -> (U, V)) -> (BlockSchema<U>, BlockSchema<V>) {
        let (u, v) = f(self.value);
        (
            BlockSchema {
                start: self.start,
                end: self.end,
                value: u,
            },
            BlockSchema {
                start: self.start,
                end: self.end,
                value: v,
            },
        )
    }

    /// Splits the block at `coordinate`, returning the halves before and after.
    fn split(self, coordinate: i64) -> [Option<Self>; 2] {
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
    fn split_twice(self, start: i64, end: i64) -> [Option<Self>; 3] {
        let [before, middle_after] = self.split(start);
        let [middle, after] = match middle_after {
            Some(block) => block.split(end),
            None => [None, None],
        };

        [before, middle, after]
    }

    /// Attempts to merge two blocks, which are assumed to be non-overlapping.
    /// Returns one block if the merge was successful, or two blocks if it was
    /// not.
    ///
    /// Blocks can be merged if they are contiguous and have the same value.
    fn try_merge(self, other: Self) -> SmallVec<[Self; 2]> {
        let (start, end) = if self.end == other.start {
            (self.start, other.end)
        } else if other.end == self.start {
            (other.start, self.end)
        } else {
            return smallvec![self, other];
        };

        if self.value == other.value {
            smallvec![BlockSchema {
                start,
                end,
                value: self.value
            }]
        } else {
            smallvec![self, other]
        }
    }
}
impl<T: Clone + PartialEq> BlockSchema<Option<T>> {
    /// Transposes a `Block<Option<T>>` into an `Option<Block<T>>`.
    fn into_some(self) -> Option<BlockSchema<T>> {
        Some(BlockSchema {
            start: self.start,
            end: self.end,
            value: self.value?,
        })
    }
}
