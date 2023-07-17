use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::BlockContent;
use crate::grid::{CellRef, CellValue};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CellValueOrSpill {
    CellValue(CellValue),
    Spill { source: CellRef },
}
impl Default for CellValueOrSpill {
    fn default() -> Self {
        CellValueOrSpill::CellValue(CellValue::Blank)
    }
}
impl<T: Into<CellValue>> From<T> for CellValueOrSpill {
    fn from(value: T) -> Self {
        CellValueOrSpill::CellValue(value.into())
    }
}
impl CellValueOrSpill {
    pub fn unwrap_cell_value(self) -> CellValue {
        match self {
            CellValueOrSpill::CellValue(value) => value,
            CellValueOrSpill::Spill { .. } => panic!("expected raw cell value; got spilled cell"),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum CellValueBlockContent {
    // TODO: add float array, bool array, etc.
    Values(SmallVec<[CellValue; 1]>),
    Spill { source: CellRef, len: usize },
}
impl BlockContent for CellValueBlockContent {
    type Item = CellValueOrSpill;

    fn new(value: Self::Item) -> Self {
        match value {
            CellValueOrSpill::CellValue(value) => Self::Values(smallvec![value]),
            CellValueOrSpill::Spill { source } => Self::Spill { source, len: 1 },
        }
    }
    fn unwrap_single_value(self) -> Self::Item {
        assert!(self.len() == 1, "expected single value");
        match self {
            CellValueBlockContent::Values(values) => values.into_iter().next().unwrap().into(),
            CellValueBlockContent::Spill { source, .. } => CellValueOrSpill::Spill { source },
        }
    }
    fn len(&self) -> usize {
        match self {
            Self::Values(array) => array.len(),
            Self::Spill { len, .. } => *len,
        }
    }

    fn get(&self, index: usize) -> Option<Self::Item> {
        (index < self.len()).then(|| match self {
            Self::Values(array) => array[index].clone().into(),
            &Self::Spill { source, .. } => CellValueOrSpill::Spill { source },
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
                if let CellValueOrSpill::CellValue(value) = value {
                    let old_value = std::mem::replace(&mut array[index], value);
                    return Ok((smallvec![self], old_value.into()));
                }
            }
            Self::Spill { .. } => {
                if self.get(index).is_some_and(|v| v == value) {
                    return Ok((smallvec![self], value));
                }
            }
        }

        let ([left, right], removed) = self.remove(index);
        return Ok((smallvec![left, Self::new(value), right], removed));
    }

    fn push_top(self, value: Self::Item) -> smallvec::SmallVec<[Self; 2]> {
        smallvec![Self::new(value), self] // TODO: optimize
    }
    fn push_bottom(self, value: Self::Item) -> smallvec::SmallVec<[Self; 2]> {
        smallvec![self, Self::new(value)] // TODO: optimize
    }

    fn try_merge(self, other: Self) -> Result<Self, [Self; 2]> {
        todo!("merge blocks {self:?} and {other:?}")
    }

    fn split(self, split_point: usize) -> [Self; 2] {
        match self {
            Self::Values(mut array) => {
                let right = array.drain(split_point..).collect();
                let left = array;
                [Self::Values(left), Self::Values(right)]
            }
            Self::Spill { source, len } => [
                Self::Spill {
                    source,
                    len: split_point,
                },
                Self::Spill {
                    source,
                    len: len - split_point,
                },
            ],
        }
    }
}
