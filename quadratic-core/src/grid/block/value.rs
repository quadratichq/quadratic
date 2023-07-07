use serde::{Deserialize, Serialize};
use smallvec::{smallvec, SmallVec};
use std::ops::Range;

use super::BlockContent;
use crate::grid::{value::CellValue, CellId};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CellValueOrSpill {
    CellValue(CellValue),
    Spill {
        source: CellId,
        column: usize,
        row: usize,
    },
}
impl From<CellValue> for CellValueOrSpill {
    fn from(value: CellValue) -> Self {
        CellValueOrSpill::CellValue(value)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum CellValueBlockContent {
    // TODO: add float array, bool array, etc.
    Values(SmallVec<[CellValue; 1]>),
    Spill {
        source: CellId,
        column: usize,
        row_range: Range<usize>,
    },
}
impl BlockContent for CellValueBlockContent {
    type Item = CellValueOrSpill;

    fn new(value: Self::Item) -> Self {
        match value {
            CellValueOrSpill::CellValue(value) => Self::Values(smallvec![value]),
            CellValueOrSpill::Spill {
                source,
                column,
                row,
            } => Self::Spill {
                source,
                column,
                row_range: row..row + 1,
            },
        }
    }
    fn len(&self) -> usize {
        match self {
            Self::Values(array) => array.len(),
            Self::Spill { row_range, .. } => row_range.len(),
        }
    }

    fn get(&self, index: usize) -> Self::Item {
        match self {
            Self::Values(array) => array[index].clone().into(),
            &Self::Spill {
                source,
                column,
                ref row_range,
            } => CellValueOrSpill::Spill {
                source,
                column,
                row: index - row_range.start,
            },
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
        todo!("merge blocks")
    }

    fn split(self, split_point: usize) -> [Self; 2] {
        match self {
            Self::Values(mut array) => {
                let right = array.drain(split_point..).collect();
                let left = array;
                [Self::Values(left), Self::Values(right)]
            }
            Self::Spill {
                source,
                column,
                row_range,
            } => {
                let mid = split_point - row_range.start;
                [
                    Self::Spill {
                        source,
                        column,
                        row_range: row_range.start..mid,
                    },
                    Self::Spill {
                        source,
                        column,
                        row_range: mid..row_range.end,
                    },
                ]
            }
        }
    }
}
