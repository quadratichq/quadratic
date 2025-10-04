//! Stores column data, including formatting.
//!
//! TODO: This file is confusing and should be broken up and refactored.

use std::collections::BTreeMap;
use std::ops::Range;

use serde::{Deserialize, Serialize};

use super::block::Block;
use crate::{CellValue, IsBlank, grid::block::BlockContent};

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct Column {
    pub x: i64,
    pub values: BTreeMap<i64, CellValue>,
}

impl Column {
    pub(crate) fn new(x: i64) -> Self {
        Self {
            x,
            ..Default::default()
        }
    }

    pub(crate) fn range(&self) -> Option<Range<i64>> {
        let min = self.values.first_key_value();
        let max = self.values.last_key_value();
        if let (Some(min), Some(max)) = (min, max) {
            Some(*min.0..*max.0 + 1)
        } else {
            None
        }
    }

    pub(crate) fn has_data_in_row(&self, y: i64) -> bool {
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
    pub(crate) fn new() -> Self {
        Self(BTreeMap::new())
    }
    pub(crate) fn get_block_containing(&self, y: i64) -> Option<&Block<B>> {
        self.0
            .range(..=y)
            .next_back()
            .map(|(_, block)| block)
            .filter(|block| block.contains(y))
    }
    pub(crate) fn remove_block_containing(&mut self, y: i64) -> Option<Block<B>> {
        let key = self.get_block_containing(y)?.start();
        self.remove_block_at(key)
    }
    pub(crate) fn remove_block_at(&mut self, y: i64) -> Option<Block<B>> {
        self.0.remove(&y)
    }
    pub(crate) fn add_block(&mut self, block: Block<B>) {
        if block.is_empty() {
            return;
        }
        debug_assert!(self.blocks_covering_range(block.range()).next().is_none());
        let key = block.start();
        self.0.insert(key, block);
    }

    /// Adds blocks w/o regard to whether they overlap with existing blocks.
    pub(crate) fn add_blocks(&mut self, blocks: impl IntoIterator<Item = Block<B>>) {
        for block in blocks {
            self.add_block(block);
        }
    }

    pub(crate) fn blocks_covering_range(
        &self,
        y_range: Range<i64>,
    ) -> impl Iterator<Item = &Block<B>> {
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

    pub(crate) fn set(&mut self, y: i64, value: Option<B::Item>) -> Option<B::Item> {
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

    pub(crate) fn blocks(&self) -> impl Iterator<Item = &Block<B>> {
        self.0.values()
    }
}
