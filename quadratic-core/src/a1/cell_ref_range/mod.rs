use std::{fmt, str::FromStr};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{Pos, Rect};

use super::{A1Context, A1Error, RefRangeBounds, TableRef, UNBOUNDED};

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
    pub fn test_a1(a1: &str) -> Self {
        use std::str::FromStr;

        Self::Sheet {
            range: RefRangeBounds::from_str(a1).unwrap(),
        }
    }
}
