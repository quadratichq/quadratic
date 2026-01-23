use std::fmt;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{Pos, Rect};

use super::{
    A1Context, A1Error, CellRefCoord, CellRefRangeEnd, RefRangeBounds, TableRef, UNBOUNDED,
};

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

    pub fn normalize(&mut self) -> &Self {
        if let Self::Sheet { range } = self {
            range.normalize_in_place();
        };

        self
    }
}
impl CellRefRange {
    #[cfg(test)]
    pub fn test_a1(a1: &str) -> Self {
        Self::Sheet {
            range: RefRangeBounds::from_str(a1, None).unwrap(),
        }
    }

    /// Converts the reference to a string, preferring A1 notation.
    /// For Table references, requires context to resolve table names.
    pub fn to_a1_string_with_context(&self, a1_context: &A1Context) -> String {
        match self {
            CellRefRange::Sheet { range } => range.to_string(),
            CellRefRange::Table { range } => range
                .to_string_with_context(a1_context)
                .unwrap_or_else(|| format!("Table[{}]", range.table_id)),
        }
    }

    /// Converts the reference to a string, preferring RC notation.
    /// For Table references, requires context to resolve table names.
    pub fn to_rc_string_with_context(&self, base_pos: Pos, a1_context: &A1Context) -> String {
        match self {
            CellRefRange::Sheet { range } => range.to_rc_string(base_pos),
            CellRefRange::Table { range } => range
                .to_string_with_context(a1_context)
                .unwrap_or_else(|| format!("Table[{}]", range.table_id)),
        }
    }

    /// Converts the reference to a string, replacing the table name if it matches old_name.
    /// Used for updating formula strings when a table is renamed.
    pub fn to_a1_string_replacing_table_name(
        &self,
        a1_context: &A1Context,
        old_name: &str,
        new_name: &str,
    ) -> String {
        match self {
            CellRefRange::Sheet { range } => range.to_string(),
            CellRefRange::Table { range } => {
                if let Some(current_name) = range.table_name(a1_context) {
                    if current_name.eq_ignore_ascii_case(old_name) {
                        range.to_string_with_name(new_name)
                    } else {
                        range.to_string_with_name(current_name)
                    }
                } else {
                    format!("Table[{}]", range.table_id)
                }
            }
        }
    }

    pub fn new_sheet_ref(
        x1: CellRefCoord,
        y1: CellRefCoord,
        x2: CellRefCoord,
        y2: CellRefCoord,
    ) -> Self {
        Self::Sheet {
            range: RefRangeBounds {
                start: CellRefRangeEnd { col: x1, row: y1 },
                end: CellRefRangeEnd { col: x2, row: y2 },
            },
        }
    }
}
