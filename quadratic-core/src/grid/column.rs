use std::borrow::Cow;
use std::collections::BTreeMap;
use std::fmt;
use std::ops::Range;

use crate::grid::block::{contiguous_optional_blocks, OptionBlock};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::formatting::*;
use super::{Block, BlockContent, CellValueBlockContent, SameValue};
use crate::IsBlank;

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct Column {
    pub x: i64,
    pub values: ColumnData<CellValueBlockContent>,
    pub align: ColumnData<SameValue<CellAlign>>,
    pub wrap: ColumnData<SameValue<CellWrap>>,
    pub numeric_format: ColumnData<SameValue<NumericFormat>>,
    pub numeric_decimals: ColumnData<SameValue<i16>>,
    pub numeric_commas: ColumnData<SameValue<bool>>,
    pub bold: ColumnData<SameValue<bool>>,
    pub italic: ColumnData<SameValue<bool>>,
    pub text_color: ColumnData<SameValue<String>>,
    pub fill_color: ColumnData<SameValue<String>>,
    pub render_size: ColumnData<SameValue<RenderSize>>,
}
impl Column {
    pub fn new(x: i64) -> Self {
        Self {
            x,
            ..Default::default()
        }
    }

    pub fn range(&self, ignore_formatting: bool) -> Option<Range<i64>> {
        if ignore_formatting {
            self.values.range()
        } else {
            crate::util::union_ranges([
                self.values.range(),
                self.align.range(),
                self.wrap.range(),
                self.numeric_format.range(),
                self.numeric_decimals.range(),
                self.bold.range(),
                self.italic.range(),
                self.text_color.range(),
                self.fill_color.range(),
            ])
        }
    }

    pub fn has_data_in_row(&self, y: i64) -> bool {
        self.values.get(y).is_some_and(|v| !v.is_blank())
    }
    pub fn has_anything_in_row(&self, y: i64) -> bool {
        self.has_data_in_row(y)
            || self.align.get(y).is_some()
            || self.wrap.get(y).is_some()
            || self.numeric_format.get(y).is_some()
            || self.numeric_decimals.get(y).is_some()
            || self.bold.get(y).is_some()
            || self.italic.get(y).is_some()
            || self.text_color.get(y).is_some()
            || self.fill_color.get(y).is_some()
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
    fn get_block_containing(&self, y: i64) -> Option<&Block<B>> {
        self.0
            .range(..=y)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(y))
    }
    fn remove_block_containing(&mut self, y: i64) -> Option<Block<B>> {
        let key = self.get_block_containing(y)?.start();
        self.remove_block_at(key)
    }
    fn remove_block_at(&mut self, y: i64) -> Option<Block<B>> {
        self.0.remove(&y)
    }
    fn add_block(&mut self, block: Block<B>) {
        if block.is_empty() {
            return;
        }
        debug_assert!(self.blocks_covering_range(block.range()).next().is_none());
        let key = block.start();
        self.0.insert(key, block);
    }
    fn add_blocks(&mut self, blocks: impl IntoIterator<Item = Block<B>>) {
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
                    return None;
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
        if self.0.contains_key(&y) {
            if let Some(block_above) = self.remove_block_containing(y - 1) {
                let block_below = self.remove_block_at(y).expect("block should not vanish");
                self.add_blocks(Block::try_merge(block_above, block_below));
            }
        }
    }

    pub fn blocks(&self) -> impl Iterator<Item = &Block<B>> {
        self.0.values()
    }

    pub fn has_blocks_in_range(&self, y_range: Range<i64>) -> bool {
        self.blocks_covering_range(y_range).next().is_some()
    }

    pub fn blocks_of_range(&self, y_range: Range<i64>) -> impl Iterator<Item = Cow<'_, Block<B>>> {
        self.blocks_covering_range(y_range.clone())
            .with_position()
            .filter_map(move |it| {
                Some(match it {
                    itertools::Position::First(block) => {
                        let [_, b] = block.clone().split(y_range.start);
                        Cow::Owned(b?)
                    }
                    itertools::Position::Middle(block) => Cow::Borrowed(block),
                    itertools::Position::Last(block) => {
                        let [a, _] = block.clone().split(y_range.end);
                        Cow::Owned(a?)
                    }
                    itertools::Position::Only(block) => {
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

        for it in self
            .remove_blocks_covering_range(y_range.clone())
            .with_position()
        {
            match it {
                itertools::Position::First(block) => {
                    let [above, below] = block.split(y_range.start);
                    to_put_back.extend(above);
                    to_return.extend(below);
                }
                itertools::Position::Middle(block) => to_return.push(block),
                itertools::Position::Last(block) => {
                    let [above, below] = block.split(y_range.end);
                    to_return.extend(above);
                    to_put_back.extend(below);
                }
                itertools::Position::Only(block) => {
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
}

impl ColumnData<SameValue<bool>> {
    pub fn bool_summary(&self, y_range: Range<i64>) -> BoolSummary {
        let mut last_block_end = y_range.start;
        let mut ret = BoolSummary::default();

        for block in self.blocks_covering_range(y_range) {
            match block.content().value {
                true => ret.is_any_true = true,
                false => ret.is_any_false = true,
            }

            if block.start() > last_block_end {
                ret.is_any_false = true;
            }
            last_block_end = block.end();

            if ret.is_any_true && ret.is_any_false {
                break;
            }
        }

        ret
    }
}

#[test]
fn test_column_data_set_range() {
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
