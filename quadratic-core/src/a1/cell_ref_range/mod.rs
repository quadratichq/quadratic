use std::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[cfg(test)]
use crate::a1::CellRefCoord;
use crate::{Pos, Rect};

use super::{A1Context, A1Error, RefRangeBounds, TableRef};

mod col_row;
mod create;
mod display;
mod intersects;
mod mutate;
mod query;
mod to_table_ref;

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[serde(untagged)]
pub enum CellRefRange {
    Sheet { range: RefRangeBounds },
    Table { range: TableRef },
}

impl CellRefRange {
    pub const ALL: Self = Self::Sheet {
        range: RefRangeBounds::ALL,
    };
}
impl CellRefRange {
    #[cfg(test)]
    pub(crate) fn test_a1(a1: &str) -> Self {
        Self::Sheet {
            range: RefRangeBounds::from_str(a1, None).unwrap(),
        }
    }

    /// Converts the reference to a string, preferring A1 notation.
    pub(crate) fn to_a1_string(&self) -> String {
        match self {
            CellRefRange::Sheet { range } => range.to_string(),
            CellRefRange::Table { range } => range.to_string(),
        }
    }

    /// Converts the reference to a string, preferring RC notation.
    pub(crate) fn as_rc_string(&self, base_pos: Pos) -> String {
        match self {
            CellRefRange::Sheet { range } => range.as_rc_string(base_pos),
            CellRefRange::Table { range } => range.to_string(),
        }
    }

    #[cfg(test)]
    pub(crate) fn new_sheet_ref(
        x1: CellRefCoord,
        y1: CellRefCoord,
        x2: CellRefCoord,
        y2: CellRefCoord,
    ) -> Self {
        use crate::a1::CellRefRangeEnd;

        Self::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd { col: x1, row: y1 },
                end: CellRefRangeEnd { col: x2, row: y2 },
            },
        }
    }
}
