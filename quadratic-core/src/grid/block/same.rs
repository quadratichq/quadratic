use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};
use std::fmt;

use super::BlockContent;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq)]
pub struct SameValue<T> {
    len: usize,
    value: T,
}
impl<T: fmt::Debug + Clone + PartialEq> BlockContent for SameValue<T> {
    type Item = T;

    fn new(value: Self::Item) -> Self {
        SameValue { len: 1, value }
    }
    fn len(&self) -> usize {
        self.len
    }

    fn get(&self, _index: usize) -> Self::Item {
        self.value.clone()
    }
    fn set(self, index: usize, value: Self::Item) -> SmallVec<[Self; 3]> {
        if value == self.value {
            smallvec![self]
        } else {
            let before = SameValue {
                len: index,
                value: self.value.clone(),
            };
            let after = SameValue {
                len: self.len - index - 1,
                value: self.value,
            };
            [before, SameValue::new(value), after]
                .into_iter()
                .filter(|block| !block.is_empty())
                .collect()
        }
    }

    fn push_top(self, value: Self::Item) -> SmallVec<[Self; 2]> {
        if value == self.value {
            smallvec![SameValue {
                len: self.len + 1,
                value,
            }]
        } else {
            smallvec![SameValue::new(value), self]
        }
    }
    fn push_bottom(self, value: Self::Item) -> SmallVec<[Self; 2]> {
        if value == self.value {
            smallvec![SameValue {
                len: self.len + 1,
                value,
            }]
        } else {
            smallvec![self, SameValue::new(value)]
        }
    }

    fn try_merge(self, other: Self) -> Result<Self, [Self; 2]> {
        if self.value == other.value {
            Ok(SameValue {
                len: self.len + other.len,
                value: self.value,
            })
        } else {
            Err([self, other])
        }
    }

    fn split(self, split_point: usize) -> [Self; 2] {
        [
            SameValue {
                len: split_point,
                value: self.value.clone(),
            },
            SameValue {
                len: self.len - split_point - 1,
                value: self.value,
            },
        ]
    }
}
