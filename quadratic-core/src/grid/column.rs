use std::borrow::Cow;
use std::collections::BTreeMap;
use std::fmt;
use std::ops::Range;

use crate::grid::block::{contiguous_optional_blocks, OptionBlock};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::formats::format::Format;
use super::formatting::*;
use super::{Block, BlockContent, SameValue};
use crate::{CellValue, IsBlank};

#[derive(Serialize, Deserialize, Default, Debug, Clone, PartialEq)]
pub struct Column {
    pub x: i64,
    pub values: BTreeMap<i64, CellValue>,
    pub align: ColumnData<SameValue<CellAlign>>,
    pub vertical_align: ColumnData<SameValue<CellVerticalAlign>>,
    pub wrap: ColumnData<SameValue<CellWrap>>,
    pub numeric_format: ColumnData<SameValue<NumericFormat>>,
    pub numeric_decimals: ColumnData<SameValue<i16>>,
    pub numeric_commas: ColumnData<SameValue<bool>>,
    pub bold: ColumnData<SameValue<bool>>,
    pub italic: ColumnData<SameValue<bool>>,
    pub text_color: ColumnData<SameValue<String>>,
    pub fill_color: ColumnData<SameValue<String>>,
    pub render_size: ColumnData<SameValue<RenderSize>>,

    #[serde(default)]
    pub date_time: ColumnData<SameValue<String>>,
}
impl Column {
    pub fn new(x: i64) -> Self {
        Self {
            x,
            ..Default::default()
        }
    }

    pub fn values_range(&self) -> Option<Range<i64>> {
        let min = self.values.first_key_value();
        let max = self.values.last_key_value();
        if let (Some(min), Some(max)) = (min, max) {
            Some(*min.0..*max.0 + 1)
        } else {
            None
        }
    }

    pub fn range(&self, ignore_formatting: bool) -> Option<Range<i64>> {
        if ignore_formatting {
            self.values_range()
        } else {
            crate::util::union_ranges([
                self.values_range(),
                self.align.range(),
                self.vertical_align.range(),
                self.wrap.range(),
                self.numeric_format.range(),
                self.numeric_decimals.range(),
                self.bold.range(),
                self.italic.range(),
                self.text_color.range(),
                self.fill_color.range(),
                self.date_time.range(),
            ])
        }
    }

    /// Returns the range for format values within the column.
    pub fn format_range(&self) -> Option<Range<i64>> {
        crate::util::union_ranges([
            self.align.range(),
            self.vertical_align.range(),
            self.wrap.range(),
            self.numeric_format.range(),
            self.numeric_decimals.range(),
            self.bold.range(),
            self.italic.range(),
            self.text_color.range(),
            self.fill_color.range(),
            self.date_time.range(),
        ])
    }

    pub fn has_data_in_row(&self, y: i64) -> bool {
        self.values.get(&y).is_some_and(|v| !v.is_blank())
    }
    pub fn has_anything_in_row(&self, y: i64) -> bool {
        self.has_data_in_row(y)
            || self.align.get(y).is_some()
            || self.vertical_align.get(y).is_some()
            || self.wrap.get(y).is_some()
            || self.numeric_format.get(y).is_some()
            || self.numeric_decimals.get(y).is_some()
            || self.bold.get(y).is_some()
            || self.italic.get(y).is_some()
            || self.text_color.get(y).is_some()
            || self.fill_color.get(y).is_some()
            || self.date_time.get(y).is_some()
    }

    /// Gets the Format for a column (which will eventually replace the data structure)
    pub fn format(&self, y: i64) -> Option<Format> {
        let format = Format {
            align: self.align.get(y),
            vertical_align: self.vertical_align.get(y),
            wrap: self.wrap.get(y),
            numeric_format: self.numeric_format.get(y),
            numeric_decimals: self.numeric_decimals.get(y),
            numeric_commas: self.numeric_commas.get(y),
            bold: self.bold.get(y),
            italic: self.italic.get(y),
            text_color: self.text_color.get(y),
            fill_color: self.fill_color.get(y),
            render_size: self.render_size.get(y),
            date_time: self.date_time.get(y),
        };
        if format.is_default() {
            None
        } else {
            Some(format)
        }
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

    /// Adds blocks w/o regard to whether they overlap with existing blocks.
    /// This is temporary and for use with column.values only!
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

    pub fn min(&self) -> Option<i64> {
        self.0.first_key_value().map(|(y, _)| *y)
    }
    pub fn max(&self) -> Option<i64> {
        self.0
            .last_key_value()
            .map(|(y, block)| *y + block.len() as i64 - 1)
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

#[cfg(test)]
mod test {
    use super::*;
    use serial_test::parallel;

    #[test]
    #[parallel]
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
    #[parallel]
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
    #[parallel]
    fn format() {
        let mut cd: Column = Column::new(0);

        cd.align
            .set_range(Range { start: 0, end: 10 }, CellAlign::Center);
        cd.vertical_align
            .set_range(Range { start: 0, end: 10 }, CellVerticalAlign::Middle);
        cd.wrap
            .set_range(Range { start: 0, end: 10 }, CellWrap::Wrap);
        cd.numeric_format.set_range(
            Range { start: 0, end: 10 },
            NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            },
        );
        cd.numeric_decimals
            .set_range(Range { start: 0, end: 10 }, 2);
        cd.numeric_commas
            .set_range(Range { start: 0, end: 10 }, true);
        cd.bold.set_range(Range { start: 0, end: 10 }, true);
        cd.italic.set_range(Range { start: 0, end: 10 }, true);
        cd.text_color
            .set_range(Range { start: 0, end: 10 }, "red".to_string());
        cd.fill_color
            .set_range(Range { start: 0, end: 10 }, "blue".to_string());
        cd.render_size.set_range(
            Range { start: 0, end: 10 },
            RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            },
        );

        let format = cd.format(0).unwrap();
        assert_eq!(format.align, Some(CellAlign::Center));
        assert_eq!(format.vertical_align, Some(CellVerticalAlign::Middle));
        assert_eq!(format.wrap, Some(CellWrap::Wrap));
        assert_eq!(
            format.numeric_format,
            Some(NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None
            })
        );
        assert_eq!(format.numeric_decimals, Some(2));
        assert_eq!(format.numeric_commas, Some(true));
        assert_eq!(format.bold, Some(true));
        assert_eq!(format.italic, Some(true));
        assert_eq!(format.text_color, Some("red".to_string()));
        assert_eq!(format.fill_color, Some("blue".to_string()));
        assert_eq!(
            format.render_size,
            Some(RenderSize {
                w: "1".to_string(),
                h: "2".to_string()
            })
        );
    }

    #[test]
    #[parallel]
    fn format_range() {
        let mut cd: Column = Column::new(0);

        cd.align
            .set_range(Range { start: 0, end: 10 }, CellAlign::Center);
        cd.vertical_align
            .set_range(Range { start: 0, end: 10 }, CellVerticalAlign::Middle);
        cd.wrap
            .set_range(Range { start: 0, end: 10 }, CellWrap::Wrap);
        cd.numeric_format.set_range(
            Range { start: 0, end: 10 },
            NumericFormat {
                kind: NumericFormatKind::Percentage,
                symbol: None,
            },
        );
        cd.numeric_decimals
            .set_range(Range { start: 0, end: 10 }, 2);
        cd.numeric_commas
            .set_range(Range { start: 0, end: 10 }, true);
        cd.bold.set_range(Range { start: 0, end: 10 }, true);
        cd.italic.set_range(Range { start: 0, end: 10 }, true);
        cd.text_color
            .set_range(Range { start: 0, end: 10 }, "red".to_string());
        cd.fill_color
            .set_range(Range { start: 0, end: 10 }, "blue".to_string());
        cd.render_size.set_range(
            Range { start: 0, end: 10 },
            RenderSize {
                w: "1".to_string(),
                h: "2".to_string(),
            },
        );

        let range = cd.format_range().unwrap();
        assert_eq!(range.start, 0);
        assert_eq!(range.end, 10);
    }

    #[test]
    #[parallel]
    fn min_max() {
        let mut cd: ColumnData<SameValue<bool>> = ColumnData::new();

        cd.set(1, Some(true));
        cd.set(2, Some(true));
        cd.set(3, Some(true));

        assert_eq!(cd.min(), Some(1));
        assert_eq!(cd.max(), Some(3));
    }
}
