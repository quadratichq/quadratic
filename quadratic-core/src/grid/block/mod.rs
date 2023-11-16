use itertools::Itertools;
use std::fmt;
use std::ops::Range;

use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

mod same;
mod value;

pub use same::SameValue;
pub use value::CellValueBlockContent;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Block<B> {
    pub y: i64,
    pub content: B,
}
impl<B: BlockContent> Block<B> {
    pub fn new(y: i64, value: B::Item) -> Self {
        Block {
            y,
            content: B::new(value),
        }
    }
    pub fn len(&self) -> usize {
        self.content.len()
    }
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn start(&self) -> i64 {
        self.y
    }
    pub fn end(&self) -> i64 {
        self.y + self.len() as i64
    }
    pub fn range(&self) -> Range<i64> {
        self.start()..self.end()
    }
    pub fn contains(&self, y: i64) -> bool {
        self.range().contains(&y)
    }

    pub fn get(&self, y: i64) -> Option<B::Item> {
        self.content.get(self.index(y)?)
    }
    pub fn set(self, y: i64, value: B::Item) -> Result<(SmallVec<[Self; 3]>, B::Item), Self> {
        match self.index(y) {
            Some(index) => {
                let (new_contents, old_value) = self.content.set(index, value).expect("bad index");
                let new_blocks = build_contiguous_blocks(self.y, new_contents);
                Ok((new_blocks, old_value))
            }
            None => Err(self),
        }
    }

    pub fn split(self, y: i64) -> [Option<Self>; 2] {
        if y < self.start() {
            [None, Some(self)]
        } else if y >= self.end() {
            [Some(self), None]
        } else {
            let [above, below] = self.content.split((y - self.y) as usize);
            [
                Some(Block {
                    y: self.y,
                    content: above,
                }),
                Some(Block { y, content: below }),
            ]
        }
    }

    pub fn push_top(self, value: B::Item) -> SmallVec<[Self; 2]> {
        build_contiguous_blocks(self.y - 1, self.content.push_top(value))
    }
    pub fn push_bottom(self, value: B::Item) -> SmallVec<[Self; 2]> {
        build_contiguous_blocks(self.y, self.content.push_bottom(value))
    }
    pub fn remove(self, y: i64) -> Result<(SmallVec<[Self; 2]>, B::Item), Self> {
        match self.index(y) {
            Some(index) => {
                let ([left, right], value_removed) = self.content.remove(index);
                let mut resulting_blocks = smallvec![];
                if !left.is_empty() {
                    resulting_blocks.push(Block {
                        y: self.y,
                        content: left,
                    });
                }
                if !right.is_empty() {
                    resulting_blocks.push(Block {
                        y: y + 1,
                        content: right,
                    });
                }
                Ok((resulting_blocks, value_removed))
            }
            None => Err(self),
        }
    }

    pub fn content(&self) -> &B {
        &self.content
    }

    pub fn try_merge(self, other: Self) -> SmallVec<[Self; 2]> {
        match self.content.try_merge(other.content) {
            Ok(merged) => smallvec![Block {
                y: self.y,
                content: merged,
            }],
            Err([upper, lower]) => smallvec![
                Block {
                    y: self.y,
                    content: upper,
                },
                Block {
                    y: other.y,
                    content: lower,
                },
            ],
        }
    }

    fn index(&self, y: i64) -> Option<usize> {
        self.contains(y).then_some((y - self.y) as usize)
    }
}

/// Total content of a contiguous block in a column. Indexes start from zero at
/// the top of the block.
pub trait BlockContent: Sized + Serialize + for<'d> Deserialize<'d> + fmt::Debug + Clone {
    type Item: fmt::Debug + Clone;

    /// Constructs a block containing a single value.
    fn new(value: Self::Item) -> Self;
    /// Returns the single value in a block.
    ///
    /// # Panics
    ///
    /// This method may panic if the block does not contain exactly one value.
    fn unwrap_single_value(self) -> Self::Item;
    /// Returns the number of values in a block.
    fn len(&self) -> usize;
    /// Returns whether the block contains zero values.
    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Returns a value in the block. Returns `None` if `index` is outside the
    /// block.
    fn get(&self, index: usize) -> Option<Self::Item>;
    /// Sets a value in the block. Returns `Err` if `index` is outside the
    /// block.
    fn set(
        self,
        index: usize,
        value: Self::Item,
    ) -> Result<(SmallVec<[Self; 3]>, Self::Item), Self>;

    /// Pushes an element to the top of a block and returns the new sequence of
    /// blocks.
    fn push_top(self, value: Self::Item) -> SmallVec<[Self; 2]>;
    /// Pushes an element to the bottom of a block and returns the new sequence
    /// of blocks.
    fn push_bottom(self, value: Self::Item) -> SmallVec<[Self; 2]>;
    /// Removes an element from a block and returns the new sequence of blocks,
    /// along with the removed element.
    fn remove(self, index: usize) -> ([Self; 2], Self::Item) {
        let [left, right] = self.split(index + 1);
        let [left, removed] = left.split(index);
        let removed = removed.unwrap_single_value();
        ([left, right], removed)
    }

    /// Merges two adjacent blocks, or returns the two blocks if they cannot be
    /// merged.
    fn try_merge(self, other: Self) -> Result<Self, [Self; 2]>;

    /// Splits a block into two at `split_point`. The element at `split_point`
    /// will be the first element of the second block.
    fn split(self, split_point: usize) -> [Self; 2];
}

/// Constructs a sequence of contiguous blocks starting at a given Y position.
fn build_contiguous_blocks<B: BlockContent, C: FromIterator<Block<B>>>(
    mut y: i64,
    contents: impl IntoIterator<Item = B>,
) -> C {
    contents
        .into_iter()
        .filter(|content| !content.is_empty())
        .map(|content| {
            let len = content.len();
            let block = Block { y, content };
            y += len as i64;
            block
        })
        .collect()
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct EmptyBlock {
    pub y: i64,
    pub len: usize,
}
impl EmptyBlock {
    pub fn start(&self) -> i64 {
        self.y
    }
    pub fn end(&self) -> i64 {
        self.y + self.len as i64
    }
    pub fn range(&self) -> Range<i64> {
        self.start()..self.end()
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum OptionBlock<B: BlockContent> {
    None(EmptyBlock),
    Some(Block<B>),
}

/// Returns a contiguous range of blocks, filled with EmptyBlocks in between content
pub fn contiguous_optional_blocks<B: BlockContent>(
    blocks: Vec<Block<B>>,
    expected_range: Range<i64>,
) -> Vec<OptionBlock<B>> {
    let block_ranges = blocks.iter().map(|block| block.range()).collect_vec();
    let mut block_iter = blocks.into_iter();

    // TODO(jrice): This could be simplified to just a blocks iter (no block_ranges vec) if we tag range equality somehow

    expected_range
        .group_by(|i| block_ranges.iter().find(|block| block.contains(i)))
        .into_iter()
        .map(|(containing_range, indices)| match containing_range {
            None => {
                let group = indices.collect_vec();
                let start = group
                    .first()
                    .expect("group_by should not return empty groups");
                let end = group.last().unwrap_or(start) + 1;
                let len = (end - start) as usize;
                OptionBlock::None(EmptyBlock { y: *start, len })
            }
            Some(_) => {
                let block = block_iter.next().expect("TODO: Assert size before this");
                OptionBlock::Some(block)
            }
        })
        .collect_vec()
}

#[cfg(test)]
mod test_blocks {
    use super::*;

    #[test]
    fn idk() {
        let blocks = vec![
            Block::<SameValue<String>> {
                y: 5,
                content: SameValue {
                    value: "A".into(),
                    len: 2,
                },
            },
            Block::<SameValue<String>> {
                y: 8,
                content: SameValue {
                    value: "B".into(),
                    len: 2,
                },
            },
        ];

        let result = contiguous_optional_blocks(blocks, 3i64..14i64);
        assert_eq!(
            result,
            vec![
                OptionBlock::None(EmptyBlock { y: 3, len: 2 }),
                OptionBlock::Some(Block::<SameValue<String>> {
                    y: 5,
                    content: SameValue {
                        value: "A".into(),
                        len: 2,
                    },
                }),
                OptionBlock::None(EmptyBlock { y: 7, len: 1 }),
                OptionBlock::Some(Block::<SameValue<String>> {
                    y: 8,
                    content: SameValue {
                        value: "B".into(),
                        len: 2,
                    },
                }),
                OptionBlock::None(EmptyBlock { y: 10, len: 4 }),
            ]
        );
    }

    #[test]
    fn contiguous_singles() {
        let blocks = vec![
            Block::<SameValue<String>> {
                y: 5,
                content: SameValue {
                    value: "A".into(),
                    len: 1,
                },
            },
            Block::<SameValue<String>> {
                y: 6,
                content: SameValue {
                    value: "A".into(),
                    len: 1,
                },
            },
            Block::<SameValue<String>> {
                y: 7,
                content: SameValue {
                    value: "A".into(),
                    len: 1,
                },
            },
        ];

        let result = contiguous_optional_blocks(blocks, 3i64..10i64);
        assert_eq!(
            result,
            vec![
                OptionBlock::None(EmptyBlock { y: 3, len: 2 }),
                OptionBlock::Some(Block::<SameValue<String>> {
                    y: 5,
                    content: SameValue {
                        value: "A".into(),
                        len: 1,
                    },
                }),
                OptionBlock::Some(Block::<SameValue<String>> {
                    y: 6,
                    content: SameValue {
                        value: "A".into(),
                        len: 1,
                    },
                }),
                OptionBlock::Some(Block::<SameValue<String>> {
                    y: 7,
                    content: SameValue {
                        value: "A".into(),
                        len: 1,
                    },
                }),
                OptionBlock::None(EmptyBlock { y: 8, len: 2 }),
            ]
        );
    }
}
