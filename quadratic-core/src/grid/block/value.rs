use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::BlockContent;
use crate::grid::CellValue;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CellValueBlockContent {
    // TODO: add float array, bool array, etc.
    Values(SmallVec<[CellValue; 1]>),
}
impl BlockContent for CellValueBlockContent {
    type Item = CellValue;

    fn new(value: Self::Item) -> Self {
        Self::Values(smallvec![value])
    }
    fn unwrap_single_value(self) -> Self::Item {
        assert!(self.len() == 1, "expected single value");
        match self {
            CellValueBlockContent::Values(values) => values.into_iter().next().unwrap(),
        }
    }
    fn len(&self) -> usize {
        match self {
            Self::Values(array) => array.len(),
        }
    }

    fn get(&self, index: usize) -> Option<Self::Item> {
        (index < self.len()).then(|| match self {
            Self::Values(array) => array[index].clone(),
        })
    }
    fn set(
        mut self,
        index: usize,
        value: Self::Item,
    ) -> Result<(smallvec::SmallVec<[Self; 3]>, Self::Item), Self> {
        if index >= self.len() {
            return Err(self);
        }

        match &mut self {
            Self::Values(array) => {
                let old_value = std::mem::replace(&mut array[index], value);
                Ok((smallvec![self], old_value))
            }
        }
    }

    fn push_top(mut self, value: Self::Item) -> smallvec::SmallVec<[Self; 2]> {
        match &mut self {
            CellValueBlockContent::Values(array) => array.insert(0, value),
        }
        smallvec![self]
    }
    fn push_bottom(mut self, value: Self::Item) -> smallvec::SmallVec<[Self; 2]> {
        match &mut self {
            CellValueBlockContent::Values(array) => array.push(value),
        }
        smallvec![self]
    }

    fn try_merge(self, other: Self) -> Result<Self, [Self; 2]> {
        match (self, other) {
            (CellValueBlockContent::Values(mut a), CellValueBlockContent::Values(b)) => {
                a.extend(b);
                Ok(CellValueBlockContent::Values(a))
            }
        }
    }

    fn split(self, split_point: usize) -> [Self; 2] {
        match self {
            Self::Values(mut array) => {
                let right = array.drain(split_point..).collect();
                let left = array;
                [Self::Values(left), Self::Values(right)]
            }
        }
    }
}
