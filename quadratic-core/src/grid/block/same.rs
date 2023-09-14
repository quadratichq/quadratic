use std::fmt;

use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::BlockContent;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq)]
pub struct SameValue<T> {
    pub value: T,
    pub len: usize,
}
impl<T: Serialize + for<'d> Deserialize<'d> + fmt::Debug + Clone + PartialEq> BlockContent
    for SameValue<T>
{
    type Item = T;

    fn new(value: Self::Item) -> Self {
        SameValue { value, len: 1 }
    }
    fn unwrap_single_value(self) -> Self::Item {
        self.value
    }
    fn len(&self) -> usize {
        self.len
    }

    fn get(&self, index: usize) -> Option<Self::Item> {
        (index < self.len()).then(|| self.value.clone())
    }
    fn set(self, index: usize, value: Self::Item) -> Result<(SmallVec<[Self; 3]>, T), Self> {
        if index >= self.len() {
            return Err(self);
        }

        if value == self.value {
            return Ok((smallvec![self], value));
        }

        let before = SameValue {
            value: self.value.clone(),
            len: index,
        };
        let after = SameValue {
            value: self.value.clone(),
            len: self.len - index - 1,
        };
        let new_contents = [before, SameValue::new(value), after]
            .into_iter()
            .filter(|block| !block.is_empty())
            .collect();
        Ok((new_contents, self.value))
    }

    fn push_top(self, value: Self::Item) -> SmallVec<[Self; 2]> {
        if value == self.value {
            smallvec![SameValue {
                value,
                len: self.len + 1,
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
                value: self.value,
                len: self.len + other.len,
            })
        } else {
            Err([self, other])
        }
    }

    fn split(self, split_point: usize) -> [Self; 2] {
        [
            SameValue {
                value: self.value.clone(),
                len: split_point,
            },
            SameValue {
                value: self.value,
                len: self.len - split_point,
            },
        ]
    }
}
