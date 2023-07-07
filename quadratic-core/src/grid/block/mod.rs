use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};
use std::fmt;
use std::ops::Range;

mod same;
mod value;

pub use same::SameValue;
pub use value::{CellValueBlockContent, CellValueOrSpill};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Block<B> {
    y: i64,
    content: B,
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
        Some(self.content.get(self.index(y)?))
    }
    pub fn set(self, y: i64, value: B::Item) -> Result<SmallVec<[Self; 3]>, Self> {
        match self.index(y) {
            Some(index) => Ok(build_contiguous_blocks(
                self.y,
                self.content.set(index, value),
            )),
            None => Err(self),
        }
    }

    pub fn push_top(self, value: B::Item) -> SmallVec<[Self; 2]> {
        build_contiguous_blocks(self.y - 1, self.content.push_top(value))
    }
    pub fn push_bottom(self, value: B::Item) -> SmallVec<[Self; 2]> {
        build_contiguous_blocks(self.y, self.content.push_bottom(value))
    }
    pub fn remove(self, y: i64) -> Result<SmallVec<[Self; 2]>, Self> {
        match self.index(y) {
            Some(index) => {
                let [left, right] = self.content.remove(index);
                let mut ret = smallvec![];
                if !left.is_empty() {
                    ret.push(Block {
                        y: self.y,
                        content: left,
                    });
                }
                if !right.is_empty() {
                    ret.push(Block {
                        y: y + 1,
                        content: right,
                    })
                }
                Ok(ret)
            }
            None => Err(self),
        }
    }

    fn try_merge(self, other: Self) -> SmallVec<[Self; 2]> {
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
        self.contains(y).then(|| (y - self.y) as usize)
    }
}

pub trait BlockContent: Sized + fmt::Debug {
    type Item: fmt::Debug + Clone;

    fn new(value: Self::Item) -> Self;
    fn len(&self) -> usize;
    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    fn get(&self, index: usize) -> Self::Item;
    fn set(self, index: usize, value: Self::Item) -> SmallVec<[Self; 3]>;

    fn push_top(self, value: Self::Item) -> SmallVec<[Self; 2]>;
    fn push_bottom(self, value: Self::Item) -> SmallVec<[Self; 2]>;
    fn remove(self, index: usize) -> [Self; 2] {
        let [left, right] = self.split(index + 1);
        let [left, _removed] = left.split(index);
        [left, right]
    }

    fn try_merge(self, other: Self) -> Result<Self, [Self; 2]>;

    fn split(self, split_point: usize) -> [Self; 2];
}

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
