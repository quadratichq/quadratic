//! Stores column data, including formatting.
//!
//! TODO: This file is confusing and should be broken up and refactored.

use std::borrow::Cow;
use std::collections::BTreeMap;
use std::fmt;
use std::ops::Range;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{SmallVec, smallvec};

use super::block::{Block, BlockContent, SameValue};
use crate::grid::block::{OptionBlock, contiguous_optional_blocks};
use crate::{CellValue, IsBlank};

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct Column {
    pub x: i64,
    pub values: BTreeMap<i64, CellValue>,
}

impl Column {
    pub fn new(x: i64) -> Self {
        Self {
            x,
            ..Default::default()
        }
    }

    pub fn range(&self) -> Option<Range<i64>> {
        let min = self.values.first_key_value();
        let max = self.values.last_key_value();
        if let (Some(min), Some(max)) = (min, max) {
            Some(*min.0..*max.0 + 1)
        } else {
            None
        }
    }

    pub fn has_data_in_row(&self, y: i64) -> bool {
        self.values.get(&y).is_some_and(|v| !v.is_blank())
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ColumnData<B: Serialize + for<'d> Deserialize<'d>>(
    #[serde(with = "crate::util::btreemap_serde")] BTreeMap<i64, Block<B>>,
);
impl<B: BlockContent> Default for ColumnData<B> {
    fn default() -> Self {
        Self::new()
    }
}
impl<B: BlockContent> ColumnData<B> {
    pub fn new() -> Self {
        Self(BTreeMap::new())
    }
    pub fn get_block_containing(&self, y: i64) -> Option<&Block<B>> {
        self.0
            .range(..=y)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(y))
    }
    pub fn remove_block_containing(&mut self, y: i64) -> Option<Block<B>> {
        let key = self.get_block_containing(y)?.start();
        self.remove_block_at(key)
    }
    pub fn remove_block_at(&mut self, y: i64) -> Option<Block<B>> {
        self.0.remove(&y)
    }
    pub fn add_block(&mut self, block: Block<B>) {
        if block.is_empty() {
            return;
        }
        debug_assert!(self.blocks_covering_range(block.range()).next().is_none());
        let key = block.start();
        self.0.insert(key, block);
    }

    /// Adds blocks w/o regard to whether they overlap with existing blocks.
    pub fn add_blocks(&mut self, blocks: impl IntoIterator<Item = Block<B>>) {
        for block in blocks {
            self.add_block(block);
        }
    }

    pub fn blocks_covering_range(&self, y_range: Range<i64>) -> impl Iterator<Item = &Block<B>> {
        // There may be a block starting above `y_range.start` that contains
        // `y_range`, so find that.
        let first_block = self
            .get_block_containing(y_range.start)
            // filter to avoid double-counting
            .filter(|block| block.start() != y_range.start);

        let rest = self
            .0
            .range(y_range.clone())
            .map(|(_, block)| block)
            .filter(move |block| block.start() < y_range.end);

        itertools::chain!(first_block, rest)
    }
    pub fn remove_blocks_covering_range(
        &mut self,
        y_range: Range<i64>,
    ) -> impl '_ + Iterator<Item = Block<B>> {
        let block_starts = self
            .blocks_covering_range(y_range)
            .map(|block| block.start())
            .collect_vec();
        block_starts
            .into_iter()
            .filter_map(|y| self.remove_block_at(y))
    }
    pub fn get(&self, y: i64) -> Option<B::Item> {
        self.get_block_containing(y)?.get(y)
    }
    pub fn set(&mut self, y: i64, value: Option<B::Item>) -> Option<B::Item> {
        match (self.remove_block_containing(y), value) {
            (None, None) => None,
            (None, Some(value)) => {
                if let Some(block_above) = self.remove_block_containing(y - 1) {
                    // Push to bottom of block above.
                    self.add_blocks(block_above.push_bottom(value));
                    // Try to merge with block below.
                    self.try_merge_at(y + 1);
                    None
                } else if let Some(block_below) = self.remove_block_at(y + 1) {
                    // Push to top of block below.
                    self.add_blocks(block_below.push_top(value));
                    None
                } else {
                    // There are no adjacent blocks, so insert a new block and
                    // don't run any other checks.
                    self.add_block(Block::new(y, value));
                    None
                }
            }
            (Some(block), None) => {
                let (new_blocks, old_value) =
                    block.remove(y).expect("error removing value from column");
                self.add_blocks(new_blocks);
                Some(old_value)
            }
            (Some(block), Some(value)) => {
                let (new_blocks, old_value) =
                    block.set(y, value).expect("error setting value in column");
                self.add_blocks(new_blocks);
                Some(old_value)
            }
        }
    }

    fn try_merge_at(&mut self, y: i64) {
        if self.0.contains_key(&y)
            && let Some(block_above) = self.remove_block_containing(y - 1)
        {
            let block_below = self.remove_block_at(y).expect("block should not vanish");
            self.add_blocks(Block::try_merge(block_above, block_below));
        }
    }

    pub fn blocks(&self) -> impl Iterator<Item = &Block<B>> {
        self.0.values()
    }

    pub fn into_blocks(self) -> impl Iterator<Item = Block<B>> {
        self.0.into_values()
    }

    pub fn has_blocks_in_range(&self, y_range: Range<i64>) -> bool {
        self.blocks_covering_range(y_range).next().is_some()
    }

    pub fn blocks_of_range(&self, y_range: Range<i64>) -> impl Iterator<Item = Cow<'_, Block<B>>> {
        self.blocks_covering_range(y_range.clone())
            .with_position()
            .filter_map(move |(it, block)| {
                Some(match it {
                    itertools::Position::First => {
                        let [_, b] = block.clone().split(y_range.start);
                        Cow::Owned(b?)
                    }
                    itertools::Position::Middle => Cow::Borrowed(block),
                    itertools::Position::Last => {
                        let [a, _] = block.clone().split(y_range.end);
                        Cow::Owned(a?)
                    }
                    itertools::Position::Only => {
                        let [_, b] = block.clone().split(y_range.start);
                        let [mid, _] = b?.split(y_range.end);
                        Cow::Owned(mid?)
                    }
                })
            })
    }
    pub fn remove_range(&mut self, y_range: Range<i64>) -> Vec<Block<B>> {
        let mut to_return = vec![];
        let mut to_put_back: SmallVec<[Block<B>; 2]> = smallvec![];

        for (it, block) in self
            .remove_blocks_covering_range(y_range.clone())
            .with_position()
        {
            match it {
                itertools::Position::First => {
                    let [above, below] = block.split(y_range.start);
                    to_put_back.extend(above);
                    to_return.extend(below);
                }
                itertools::Position::Middle => to_return.push(block),
                itertools::Position::Last => {
                    let [above, below] = block.split(y_range.end);
                    to_return.extend(above);
                    to_put_back.extend(below);
                }
                itertools::Position::Only => {
                    let [above, rest] = block.split(y_range.start);
                    to_put_back.extend(above);
                    if let Some(rest) = rest {
                        let [inside, below] = rest.split(y_range.end);
                        to_return.extend(inside);
                        to_put_back.extend(below);
                    }
                }
            }
        }

        self.add_blocks(to_put_back);

        to_return
    }

    pub fn range(&self) -> Option<Range<i64>> {
        let min = *self.0.first_key_value()?.0;
        let max = self.0.last_key_value()?.1.end();
        Some(min..max)
    }

    /// Iterates over all values, skipping cells with no data.
    pub fn values(&self) -> impl '_ + Iterator<Item = (i64, B::Item)> {
        self.range()
            .into_iter()
            .flat_map(|y_range| self.values_in_range(y_range))
    }
    /// Iterates over a range, skipping cells with no data.
    pub fn values_in_range(
        &self,
        y_range: Range<i64>,
    ) -> impl '_ + Iterator<Item = (i64, B::Item)> {
        self.blocks_covering_range(y_range.clone())
            .flat_map(move |block| {
                let start = std::cmp::max(y_range.start, block.start());
                let end = std::cmp::min(y_range.end, block.end());
                (start..end).filter_map(|y| Some((y, block.get(y)?)))
            })
    }

    pub fn min(&self) -> Option<i64> {
        self.0.first_key_value().map(|(y, _)| *y)
    }
    pub fn max(&self) -> Option<i64> {
        self.0
            .last_key_value()
            .map(|(y, block)| *y + block.len() as i64 - 1)
    }

    /// Shift all blocks so there's an empty entry at y.
    ///
    /// Note: this is not designed to handle negative values (since we're deprecating it on the sheet)
    pub fn insert_and_shift_right(&mut self, y: i64) -> bool {
        let mut changed = false;
        let mut new_blocks = BTreeMap::new();

        for (start, block) in self.0.iter() {
            // block is before the insertion point, then copy
            if *start < y && (*start + block.len() as i64) < y {
                new_blocks.insert(*start, block.clone());
            }
            // block is at or after the insertion point, then shift right
            else if *start >= y {
                let mut new_block = block.clone();
                new_block.y += 1;
                new_blocks.insert(*start + 1, new_block);
                changed = true;
            }
            // otherwise we have to split the block
            else {
                let split_point = y;
                let [before, after] = block.clone().split(split_point);
                if let Some(before) = before {
                    new_blocks.insert(*start, before);
                }
                if let Some(mut after) = after {
                    after.y = split_point + 1;
                    new_blocks.insert(split_point + 1, after);
                }
                changed = true;
            }
        }
        self.0 = new_blocks;
        changed
    }

    /// Removes a position and shifts the remaining positions to the left.
    pub fn remove_and_shift_left(&mut self, y: i64) -> bool {
        let mut changed = false;
        let mut new_blocks = BTreeMap::new();

        for (start, block) in self.0.iter() {
            // block is before the removal point, then copy
            if *start < y && (*start + block.len() as i64) < y {
                new_blocks.insert(*start, block.clone());
            }
            // block contains the removal point
            else if *start <= y && (*start + block.len() as i64) >= y {
                let [before, after] = block.clone().split(y);
                if let Some(before) = before {
                    new_blocks.insert(*start, before);
                }
                if let Some(mut after) = after {
                    // if after only contains y, then we're done
                    if after.len() > 1 {
                        // otherwise, we shorten its length
                        after.delta_len(-1);
                        new_blocks.insert(after.y, after);
                    }
                }
                changed = true;
            }
            // block is after the removal point, then shift left
            else if *start >= y {
                let mut new_block = block.clone();
                new_block.y -= 1;
                new_blocks.insert(*start - 1, new_block);
                changed = true;
            }
        }
        self.0 = new_blocks;
        changed
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    #[cfg(test)]
    pub fn print(&self) {
        if let Some(bounds) = self.range() {
            for y in bounds.start..bounds.end {
                if y != bounds.end - 1 {
                    print!("{}: {:?}, ", y, self.get(y));
                } else {
                    print!("{}: {:?}", y, self.get(y));
                }
            }
            println!();
        } else {
            println!("empty");
        }
    }
}

impl<T: Serialize + for<'d> Deserialize<'d> + fmt::Debug + Clone + PartialEq>
    ColumnData<SameValue<T>>
{
    pub fn set_range(&mut self, y_range: Range<i64>, value: T) -> Vec<Block<SameValue<T>>> {
        let removed = self.remove_range(y_range.clone());
        self.add_block(Block {
            y: y_range.start,
            content: SameValue {
                value,
                len: (y_range.end - y_range.start) as usize,
            },
        });
        self.try_merge_at(y_range.start);
        self.try_merge_at(y_range.end);
        removed
    }
    pub fn clone_range(&mut self, source: &Self, y_range: Range<i64>) -> Vec<Block<SameValue<T>>> {
        let mut replaced = vec![];

        let value_blocks = source
            .blocks_of_range(y_range.clone())
            .map(|cow_block| cow_block.into_owned())
            .collect_vec();
        for new_block in contiguous_optional_blocks(value_blocks, y_range) {
            let replaced_blocks = match new_block {
                OptionBlock::None(empty) => self.remove_range(empty.range()),
                OptionBlock::Some(block) => self.set_range(block.range(), block.content.value),
            };
            replaced.extend(replaced_blocks.into_iter());
        }
        replaced
    }

    /// Sets a block at a specific y value without merging. This is used by serialize functions.
    pub fn insert_block(&mut self, y: i64, len: usize, value: T) {
        debug_assert!(!self.0.contains_key(&y));
        self.set_range(y..y + len as i64, value);
    }
}

#[cfg(test)]
mod test {

    use super::*;

    #[test]
    fn column_data_set_range() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();

        // range 0 - 10 (true)
        cd.set_range(Range { start: -2, end: 10 }, true);
        assert_eq!(cd.get(-2), Some(true));
        assert_eq!(cd.get(0), Some(true));
        assert_eq!(cd.get(10), None);
        assert_eq!(cd.get(-3), None);
        assert_eq!(cd.blocks().count(), 1);

        // adding range 11 - 20 (true)
        cd.set_range(Range { start: 10, end: 20 }, true);
        assert_eq!(cd.get(11), Some(true));
        assert_eq!(cd.get(20), None);
        assert_eq!(cd.blocks().count(), 1);

        // adding range 19 - 30 (false) - creating a second block and overlapping previous one
        cd.set_range(Range { start: 19, end: 30 }, false);
        assert_eq!(cd.get(19), Some(false));
        assert_eq!(cd.get(18), Some(true));
        assert_eq!(cd.get(30), None);
        assert_eq!(cd.blocks().count(), 2);
    }

    #[test]
    fn has_blocks_in_range() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();

        // range 0 - 10 (true)
        cd.set_range(Range { start: -2, end: 10 }, true);
        assert!(cd.has_blocks_in_range(Range { start: -2, end: 10 }));
        assert!(cd.has_blocks_in_range(Range { start: 0, end: 10 }));
        assert!(cd.has_blocks_in_range(Range { start: -2, end: 9 }));
        assert!(cd.has_blocks_in_range(Range { start: -3, end: 10 }));
        assert!(cd.has_blocks_in_range(Range { start: -3, end: 9 }));
        assert!(!cd.has_blocks_in_range(Range { start: 11, end: 20 }));
        assert!(!cd.has_blocks_in_range(Range {
            start: -10,
            end: -3
        }));
    }

    #[test]
    fn min_max() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();

        cd.set(1, Some(true));
        cd.set(2, Some(true));
        cd.set(3, Some(true));

        assert_eq!(cd.min(), Some(1));
        assert_eq!(cd.max(), Some(3));
    }

    #[test]
    fn insert_block() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();

        cd.insert_block(3, 2, true);
        assert_eq!(cd.get(3), Some(true));
        assert_eq!(cd.get(4), Some(true));
        assert_eq!(cd.get(5), None);
    }

    #[test]
    fn insert_and_shift_right_simple() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();
        cd.set_range(10..13, true);
        cd.insert_and_shift_right(11);
        assert_eq!(cd.get(10), Some(true));
        assert_eq!(cd.get(11), None);
        assert_eq!(cd.get(12), Some(true));
        assert_eq!(cd.get(13), Some(true));
        assert_eq!(cd.get(14), None);
    }

    #[test]
    fn insert_and_shift_right_start() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();
        cd.set_range(1..4, true);
        cd.set_range(5..6, false);
        cd.insert_and_shift_right(1);
        assert_eq!(cd.get(1), None);
        assert_eq!(cd.get(2), Some(true));
        assert_eq!(cd.get(3), Some(true));
        assert_eq!(cd.get(4), Some(true));
        assert_eq!(cd.get(5), None);
        assert_eq!(cd.get(6), Some(false));
        assert_eq!(cd.get(7), None);
    }

    #[test]
    fn insert_and_shift_right_middle() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();
        cd.set_range(1..4, true);
        cd.set_range(5..6, false);
        cd.insert_and_shift_right(3);
        assert_eq!(cd.get(1), Some(true));
        assert_eq!(cd.get(2), Some(true));
        assert_eq!(cd.get(3), None);
        assert_eq!(cd.get(4), Some(true));
        assert_eq!(cd.get(5), None);
        assert_eq!(cd.get(6), Some(false));
        assert_eq!(cd.get(7), None);
    }

    #[test]
    fn insert_and_shift_right_end() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();
        assert!(!cd.insert_and_shift_right(1));
        cd.set_range(1..4, true);
        cd.set_range(5..6, false);
        assert!(cd.insert_and_shift_right(4));
        assert_eq!(cd.get(1), Some(true));
        assert_eq!(cd.get(2), Some(true));
        assert_eq!(cd.get(3), Some(true));
        assert_eq!(cd.get(4), None);
        assert_eq!(cd.get(5), None);
        assert_eq!(cd.get(6), Some(false));
        assert_eq!(cd.get(7), None);
    }

    #[test]
    fn remove_and_shift_left_start() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();
        cd.set_range(1..4, true);
        cd.set_range(5..6, false);
        cd.remove_and_shift_left(1);
        assert_eq!(cd.get(1), Some(true));
        assert_eq!(cd.get(2), Some(true));
        assert_eq!(cd.get(3), None);
        assert_eq!(cd.get(4), Some(false));
        assert_eq!(cd.get(5), None);
    }

    #[test]
    fn remove_and_shift_left_middle() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();
        cd.set_range(1..4, true);
        cd.set_range(5..6, false);
        cd.remove_and_shift_left(2);
        assert_eq!(cd.get(1), Some(true));
        assert_eq!(cd.get(2), Some(true));
        assert_eq!(cd.get(3), None);
        assert_eq!(cd.get(4), Some(false));
        assert_eq!(cd.get(5), None);
    }

    #[test]
    fn remove_and_shift_left_end() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();
        assert!(!cd.remove_and_shift_left(1));
        cd.set_range(1..4, true);
        cd.set_range(5..6, false);
        assert!(cd.remove_and_shift_left(3));
        assert_eq!(cd.get(1), Some(true));
        assert_eq!(cd.get(2), Some(true));
        assert_eq!(cd.get(3), None);
        assert_eq!(cd.get(4), Some(false));
        assert_eq!(cd.get(5), None);
    }

    #[test]
    fn is_empty() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();
        assert!(cd.is_empty());
        cd.set(1, Some(true));
        assert!(!cd.is_empty());
    }
}
