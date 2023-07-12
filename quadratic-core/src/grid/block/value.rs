use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};

use super::BlockContent;
use crate::grid::{value::CellValue, CellRef};

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
impl From<CellValue> for CellValueOrSpill {
    fn from(value: CellValue) -> Self {
        CellValueOrSpill::CellValue(value)
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
    fn len(&self) -> usize {
        match self {
            Self::Values(array) => array.len(),
            Self::Spill { len, .. } => *len,
        }
    }

    fn get(&self, index: usize) -> Self::Item {
        match self {
            Self::Values(array) => array[index].clone().into(),
            &Self::Spill { source, .. } => CellValueOrSpill::Spill { source },
        }
    }
    fn set(mut self, index: usize, value: Self::Item) -> smallvec::SmallVec<[Self; 3]> {
        match &mut self {
            Self::Values(array) => {
                if let CellValueOrSpill::CellValue(value) = value {
                    array[index] = value;
                    return smallvec![self];
                }
            }
            Self::Spill { .. } => {
                if self.get(index) == value {
                    return smallvec![self];
                }
            }
        }

        let [left, right] = self.remove(index);
        return smallvec![left, Self::new(value), right];
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
