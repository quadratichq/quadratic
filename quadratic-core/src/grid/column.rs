use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};
use std::collections::BTreeMap;
use std::ops::Range;

use super::{
    block::CellValueOrSpill, formatting::*, value::CellValue, Block, BlockContent,
    CellValueBlockContent, ColumnId, SameValue,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Column {
    pub id: ColumnId,

    pub values: ColumnData<CellValueBlockContent>,
    pub align: ColumnData<SameValue<CellAlign>>,
    pub wrap: ColumnData<SameValue<CellWrap>>,
    pub borders: ColumnData<SameValue<CellBorders>>,
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
            align: ColumnData::default(),
            wrap: ColumnData::default(),
            borders: ColumnData::default(),
            numeric_format: ColumnData::default(),
            bold: ColumnData::default(),
            italic: ColumnData::default(),
            text_color: ColumnData::default(),
            fill_color: ColumnData::default(),
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
                self.borders.range(),
                self.numeric_format.range(),
                self.bold.range(),
                self.italic.range(),
                self.text_color.range(),
                self.fill_color.range(),
            ])
        }
    }

    pub fn has_data(&self) -> bool {
        !self.values.0.is_empty()
    }
    pub fn has_anything(&self) -> bool {
        self.has_data()
            || !self.align.0.is_empty()
            || !self.wrap.0.is_empty()
            || !self.borders.0.is_empty()
            || !self.numeric_format.0.is_empty()
            || !self.bold.0.is_empty()
            || !self.italic.0.is_empty()
            || !self.text_color.0.is_empty()
            || !self.fill_color.0.is_empty()
    }

    pub fn has_data_in_row(&self, y: i64) -> bool {
        self.values
            .get(y)
            .is_some_and(|v| v != CellValueOrSpill::CellValue(CellValue::Blank))
    }
    pub fn has_anything_in_row(&self, y: i64) -> bool {
        self.has_data_in_row(y)
            || self.align.get(y).is_some()
            || self.wrap.get(y).is_some()
            || self.borders.get(y).is_some()
            || self.numeric_format.get(y).is_some()
            || self.bold.get(y).is_some()
            || self.italic.get(y).is_some()
            || self.text_color.get(y).is_some()
            || self.fill_color.get(y).is_some()
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

        // TODO: try merge with blocks above & below
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

    // TODO: set_range() function

    pub fn range(&self) -> Option<Range<i64>> {
        let min = *self.0.first_key_value()?.0;
        let max = self.0.last_key_value()?.1.end();
        Some(min..max)
    }
}
