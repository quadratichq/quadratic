use std::borrow::Cow;
use std::collections::BTreeMap;
use std::fmt;
use std::ops::Range;

use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::formatting::*;
use super::{Block, BlockContent, CellRef, CellValueBlockContent, ColumnId, SameValue};
use crate::IsBlank;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Column {
    pub id: ColumnId,

    pub values: ColumnData<CellValueBlockContent>,
    pub spills: ColumnData<SameValue<CellRef>>,

    pub align: ColumnData<SameValue<CellAlign>>,
    pub wrap: ColumnData<SameValue<CellWrap>>,
    pub numeric_format: ColumnData<SameValue<NumericFormat>>,
    pub bold: ColumnData<SameValue<bool>>,
    pub italic: ColumnData<SameValue<bool>>,
    pub text_color: ColumnData<SameValue<String>>,
    pub fill_color: ColumnData<SameValue<String>>,
}
impl Column {
    pub fn new() -> Self {
        Column::with_id(ColumnId::new())
    }
    pub fn with_id(id: ColumnId) -> Self {
        Column {
            id,

            values: ColumnData::default(),
            spills: ColumnData::default(),

            align: ColumnData::default(),
            wrap: ColumnData::default(),
            numeric_format: ColumnData::default(),
            bold: ColumnData::default(),
            italic: ColumnData::default(),
            text_color: ColumnData::default(),
            fill_color: ColumnData::default(),
        }
    }

    pub fn range(&self, ignore_formatting: bool) -> Option<Range<i64>> {
        if ignore_formatting {
            crate::util::union_ranges([self.values.range(), self.spills.range()])
        } else {
            crate::util::union_ranges([
                self.values.range(),
                self.spills.range(),
                self.align.range(),
                self.wrap.range(),
                self.numeric_format.range(),
                self.bold.range(),
                self.italic.range(),
                self.text_color.range(),
                self.fill_color.range(),
            ])
        }
    }

    pub fn has_data_in_row(&self, y: i64) -> bool {
        self.values.get(y).is_some_and(|v| !v.is_blank()) || self.spills.get(y).is_some()
    }
    pub fn has_anything_in_row(&self, y: i64) -> bool {
        self.has_data_in_row(y)
            || self.align.get(y).is_some()
            || self.wrap.get(y).is_some()
            || self.numeric_format.get(y).is_some()
            || self.bold.get(y).is_some()
            || self.italic.get(y).is_some()
            || self.text_color.get(y).is_some()
            || self.fill_color.get(y).is_some()
    }

    /// copies formats column into a new column with y starting at 0
    pub fn copy_formats_to_column(&self, range: Range<i64>) -> Column {
        let mut column = Column::new();
        self.align
            .copy_range_to_column_data(&range, &mut column.align);
        self.wrap
            .copy_range_to_column_data(&range, &mut column.wrap);
        self.numeric_format
            .copy_range_to_column_data(&range, &mut column.numeric_format);
        self.bold
            .copy_range_to_column_data(&range, &mut column.bold);
        self.italic
            .copy_range_to_column_data(&range, &mut column.italic);
        self.text_color
            .copy_range_to_column_data(&range, &mut column.text_color);
        self.fill_color
            .copy_range_to_column_data(&range, &mut column.fill_color);
        column
    }
    /// removes formats column into a new column with y starting at 0
    pub fn remove_formats_to_column(&mut self, range: Range<i64>) -> Column {
        let mut column = Column::new();
        self.align
            .remove_range_to_column_data(&range, &mut column.align);
        self.wrap
            .remove_range_to_column_data(&range, &mut column.wrap);
        self.numeric_format
            .remove_range_to_column_data(&range, &mut column.numeric_format);
        self.bold
            .remove_range_to_column_data(&range, &mut column.bold);
        self.italic
            .remove_range_to_column_data(&range, &mut column.italic);
        self.text_color
            .remove_range_to_column_data(&range, &mut column.text_color);
        self.fill_color
            .remove_range_to_column_data(&range, &mut column.fill_color);
        column
    }
    pub fn merge_formats_from_column(&mut self, y: i64, source: &Column) {
        self.align.merge_from_column_data(y, &source.align);
        self.wrap.merge_from_column_data(y, &source.wrap);
        self.numeric_format
            .merge_from_column_data(y, &source.numeric_format);
        self.bold.merge_from_column_data(y, &source.bold);
        self.italic.merge_from_column_data(y, &source.italic);
        self.text_color
            .merge_from_column_data(y, &source.text_color);
        self.fill_color
            .merge_from_column_data(y, &source.fill_color);
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ColumnData<B>(BTreeMap<i64, Block<B>>);
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
            (None, None) => return None,
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
        self.0.iter().map(|(_, block)| block)
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
                    to_return.extend(below)
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

    pub fn remove_range_to_column_data(
        &mut self,
        y_range: &Range<i64>,
        column_data: &mut ColumnData<B>,
    ) {
        let mut blocks = self.remove_range(y_range.clone());
        if blocks.len() != 0 {
            blocks.iter_mut().for_each(|block| block.y -= y_range.start);
            column_data.add_blocks(blocks);
        }
    }

    // copy from the y_start through the length of the from (which always starts at y = 0)
    pub fn copy_range_to_column_data(&self, y_range: &Range<i64>, column_data: &mut ColumnData<B>) {
        let mut to_copy = vec![];
        for it in self.blocks_covering_range(y_range.clone()).with_position() {
            match it {
                itertools::Position::First(block) => {
                    let [_, below] = block.clone().split(y_range.start);
                    to_copy.extend(below)
                }
                itertools::Position::Middle(block) => to_copy.push(block.clone()),
                itertools::Position::Last(block) => {
                    let [above, _] = block.clone().split(y_range.end);
                    to_copy.extend(above);
                }
                itertools::Position::Only(block) => {
                    let [_, rest] = block.clone().split(y_range.start);
                    if let Some(rest) = rest {
                        let [inside, _] = rest.split(y_range.end);
                        to_copy.extend(inside);
                    }
                }
            }
        }

        if to_copy.len() != 0 {
            // normalize the y-values where the range.start = 0
            to_copy
                .iter_mut()
                .for_each(|block| block.y -= y_range.start);
            column_data.add_blocks(to_copy);
        }
    }

    pub fn merge_from_column_data(&mut self, y_start: i64, clipboard: &ColumnData<B>) {
        clipboard.blocks().for_each(|block| {
            let mut to_add = block.clone();
            to_add.y += y_start;
            self.add_block(to_add);
            self.try_merge_at(block.y);
            self.try_merge_at(block.y + (block.len() as i64) + 1);
        });
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

impl<T: fmt::Debug + Clone + PartialEq> ColumnData<SameValue<T>> {
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
    assert_eq!(cd.get(25), Some(false));
    assert_eq!(cd.get(30), None);
    assert_eq!(cd.blocks().count(), 2);
}
