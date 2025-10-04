// TODO: remove if unused. I don't think this is needed anymore.

use std::fmt;
use std::ops::Range;

use serde::{Deserialize, Serialize};
use smallvec::{SmallVec, smallvec};

mod same;

pub use same::SameValue;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Block<B> {
    pub y: i64,
    pub content: B,
}
impl<B: BlockContent> Block<B> {
    pub(crate) fn new(y: i64, value: B::Item) -> Self {
        Block {
            y,
            content: B::new(value),
        }
    }
    pub(crate) fn len(&self) -> usize {
        self.content.len()
    }
    pub(crate) fn is_empty(&self) -> bool {
        self.len() == 0
    }
    pub(crate) fn start(&self) -> i64 {
        self.y
    }
    pub(crate) fn end(&self) -> i64 {
        self.y + self.len() as i64
    }
    pub(crate) fn range(&self) -> Range<i64> {
        self.start()..self.end()
    }
    pub(crate) fn contains(&self, y: i64) -> bool {
        self.range().contains(&y)
    }
    pub(crate) fn set(
        self,
        y: i64,
        value: B::Item,
    ) -> Result<(SmallVec<[Self; 3]>, B::Item), Self> {
        match self.index(y) {
            Some(index) => {
                let (new_contents, old_value) = self.content.set(index, value).expect("bad index");
                let new_blocks = build_contiguous_blocks(self.y, new_contents);
                Ok((new_blocks, old_value))
            }
            None => Err(self),
        }
    }
    pub(crate) fn push_top(self, value: B::Item) -> SmallVec<[Self; 2]> {
        build_contiguous_blocks(self.y - 1, self.content.push_top(value))
    }
    pub(crate) fn push_bottom(self, value: B::Item) -> SmallVec<[Self; 2]> {
        build_contiguous_blocks(self.y, self.content.push_bottom(value))
    }
    pub(crate) fn remove(self, y: i64) -> Result<(SmallVec<[Self; 2]>, B::Item), Self> {
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
    pub(crate) fn try_merge(self, other: Self) -> SmallVec<[Self; 2]> {
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
    /// Increments the length of the block by `delta`.
    fn delta_len(&mut self, delta: isize);
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
