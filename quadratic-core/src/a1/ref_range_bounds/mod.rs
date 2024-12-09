use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use ts_rs::TS;

use super::{range_might_contain_coord, range_might_intersect, A1Error, CellRefRangeEnd};
use crate::{Pos, Rect};

pub mod ref_range_bounds_contains;
pub mod ref_range_bounds_create;
pub mod ref_range_bounds_intersection;
pub mod ref_range_bounds_query;
pub mod ref_range_bounds_translate;

#[derive(Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(test, proptest(filter = "|range| range.is_valid()"))]
pub struct RefRangeBounds {
    pub start: CellRefRangeEnd,
    pub end: Option<CellRefRangeEnd>,
}

impl fmt::Debug for RefRangeBounds {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "RefRangeBounds(")?;
        fmt::Display::fmt(self, f)?;
        write!(f, ")")?;
        Ok(())
    }
}

impl fmt::Display for RefRangeBounds {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if *self == Self::ALL {
            write!(f, "*")?;
        } else {
            write!(f, "{}", self.start)?;
            if let Some(end) = self.end {
                // we don't need to print the end range if start == end
                if end != self.start {
                    write!(f, ":{end}")?;
                }
            }
        }
        Ok(())
    }
}

impl RefRangeBounds {
    /// Range that contains the entire sheet.
    pub const ALL: Self = Self {
        start: CellRefRangeEnd::UNBOUNDED,
        end: Some(CellRefRangeEnd::UNBOUNDED),
    };
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {
    use super::*;

    use proptest::prelude::*;

    proptest! {
        #[test]
        fn proptest_cell_ref_range_parsing(ref_range_bounds: RefRangeBounds) {
            // We skip tests where start = end since we remove the end when parsing
            if ref_range_bounds.end.is_none_or(|end| end != ref_range_bounds.start) {
                assert_eq!(ref_range_bounds, ref_range_bounds.to_string().parse().unwrap());
            }
        }
    }
}
