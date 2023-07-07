use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ops::Range;

use super::{formatting::*, Block, BlockContent, CellValueBlockContent, SameValue};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Column {
    pub values: ColumnData<CellValueBlockContent>,
    pub align: ColumnData<SameValue<CellAlign>>,
    pub wrap: ColumnData<SameValue<CellWrap>>,
    pub borders: ColumnData<SameValue<CellBorders>>,
    pub numeric_formats: ColumnData<SameValue<NumericFormat>>,
    pub bold: ColumnData<SameValue<bool>>,
    pub italic: ColumnData<SameValue<bool>>,
    pub text_color: ColumnData<SameValue<[u8; 3]>>,
    pub fill_color: ColumnData<SameValue<[u8; 3]>>,
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
    fn get_block_containing_mut(&mut self, y: i64) -> Option<&mut Block<B>> {
        self.0
            .range_mut(..=y)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(y))
    }
    fn remove_block_containing(&mut self, y: i64) -> Option<Block<B>> {
        let key = self.get_block_containing(y)?.start();
        self.0.remove(&key)
    }
    fn add_block(&mut self, block: Block<B>) {
        debug_assert!(self
            .get_blocks_covering_range(block.range())
            .next()
            .is_none());
        let key = block.start();
        self.0.insert(key, block);
    }
    fn add_blocks(&mut self, blocks: impl IntoIterator<Item = Block<B>>) {
        for block in blocks {
            self.add_block(block);
        }
    }

    pub fn get_blocks_covering_range(
        &self,
        y_range: Range<i64>,
    ) -> impl Iterator<Item = &Block<B>> {
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
    pub fn get(&self, y: i64) -> Option<B::Item> {
        self.get_block_containing(y)?.get(y)
    }
    pub fn set(&mut self, y: i64, value: B::Item) {
        if let Some(block) = self.remove_block_containing(y) {
            self.add_blocks(block.set(y, value).expect("error setting value in column"));
        } else {
            self.add_block(Block::new(y, value));
        }
        // TODO: try merge with blocks above & below
    }
}
