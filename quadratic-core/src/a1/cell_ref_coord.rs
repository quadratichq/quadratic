use std::{
    fmt,
    ops::{Add, RangeInclusive},
};

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use wasm_bindgen::prelude::*;

/// Unbounded coordinate on lower or upper end.
pub const UNBOUNDED: i64 = i64::MAX;

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct CellRefCoord {
    #[cfg_attr(test, proptest(strategy = "super::PROPTEST_COORDINATE_I64"))]
    pub coord: i64,
    pub is_absolute: bool,
}

// Add custom serialization implementation
impl Serialize for CellRefCoord {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("CellRefCoord", 2)?;
        // Convert UNBOUNDED to -1 during serialization
        let coord = if self.coord == UNBOUNDED {
            -1
        } else {
            self.coord
        };
        state.serialize_field("coord", &coord)?;
        state.serialize_field("is_absolute", &self.is_absolute)?;
        state.end()
    }
}

// Add custom deserialization implementation
impl<'de> Deserialize<'de> for CellRefCoord {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Helper {
            coord: i64,
            is_absolute: bool,
        }

        let helper = Helper::deserialize(deserializer)?;
        // Convert -1 back to UNBOUNDED during deserialization
        let coord = if helper.coord == -1 {
            UNBOUNDED
        } else {
            helper.coord
        };

        Ok(CellRefCoord {
            coord,
            is_absolute: helper.is_absolute,
        })
    }
}

impl CellRefCoord {
    pub const START: Self = Self {
        coord: 1,
        is_absolute: false,
    };
    pub const UNBOUNDED: Self = Self {
        coord: UNBOUNDED,
        is_absolute: false,
    };

    pub(crate) fn fmt_as_column(self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.coord == UNBOUNDED {
            return Ok(());
        }
        if self.is_absolute {
            write!(f, "$")?;
        }
        write!(f, "{}", super::column_name(self.coord))
    }

    pub(crate) fn fmt_as_row(self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.coord == UNBOUNDED {
            return Ok(());
        }
        if self.is_absolute {
            write!(f, "$")?;
        }
        write!(f, "{}", self.coord)
    }

    /// Returns the number as a string for use in RC-style notation.
    ///
    /// - If the coordinate is relative, returns a string containing the number
    ///   surrounded by square brackets.
    /// - If the coordinate is absolute, returns a string containing the number.
    pub(crate) fn to_rc_string(self, base_coord: i64) -> String {
        match self.is_absolute {
            true => format!("{{{}}}", self.coord),
            false => format!("[{}]", self.coord.saturating_sub(base_coord)), // when changing to `u64`, this MUST stay `i64`
        }
    }

    pub fn new_rel(coord: i64) -> Self {
        let is_absolute = false;
        Self { coord, is_absolute }
    }

    pub fn new_abs(coord: i64) -> Self {
        let is_absolute = true;
        Self { coord, is_absolute }
    }

    pub fn translate_in_place(&mut self, delta: i64) {
        if !self.is_absolute && !self.is_unbounded() {
            self.coord = self.coord.saturating_add(delta).max(1);
        }
    }

    pub fn translate(&self, delta: i64) -> Self {
        let mut coord = *self;
        coord.translate_in_place(delta);
        coord
    }

    pub fn is_unbounded(&self) -> bool {
        self.coord == UNBOUNDED
    }
}

impl Add<i64> for CellRefCoord {
    type Output = Self;

    fn add(self, rhs: i64) -> Self::Output {
        let coord = self.coord + rhs;
        Self { coord, ..self }
    }
}

/// Returns whether `range` might intersect the region from `start` to `end`.
pub(crate) fn range_might_intersect(
    range: RangeInclusive<i64>,
    mut start: CellRefCoord,
    mut end: CellRefCoord,
) -> bool {
    if end.coord < start.coord {
        std::mem::swap(&mut start, &mut end);
    }
    let range_excluded_by_start = *range.end() < start.coord;
    let range_excluded_by_end = end.coord < *range.start();
    !range_excluded_by_start && !range_excluded_by_end
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_translate_in_place() {
        let mut coord = CellRefCoord::new_rel(1);
        coord.translate_in_place(-1);
        assert_eq!(coord, CellRefCoord::new_rel(1));

        let mut coord = CellRefCoord::new_rel(1);
        coord.translate_in_place(1);
        assert_eq!(coord, CellRefCoord::new_rel(2));
    }

    #[test]
    fn test_translate() {
        assert_eq!(
            CellRefCoord::new_rel(1).translate(-1),
            CellRefCoord::new_rel(1)
        );
        assert_eq!(
            CellRefCoord::new_rel(1).translate(1),
            CellRefCoord::new_rel(2)
        );
    }

    #[test]
    fn test_range_might_intersect() {
        let range = 5..=10;

        // No intersection when range is before start
        assert!(!range_might_intersect(
            range.clone(),
            CellRefCoord::new_rel(15),
            CellRefCoord::new_rel(20)
        ));

        // No intersection when range is after end
        assert!(!range_might_intersect(
            range.clone(),
            CellRefCoord::new_rel(1),
            CellRefCoord::new_rel(3)
        ));

        // Intersection when range overlaps
        assert!(range_might_intersect(
            range.clone(),
            CellRefCoord::new_rel(3),
            CellRefCoord::new_rel(7)
        ));

        // Intersection when range is contained
        assert!(range_might_intersect(
            range.clone(),
            CellRefCoord::new_rel(4),
            CellRefCoord::new_rel(12)
        ));

        // Handles swapped start/end coordinates
        assert!(range_might_intersect(
            range.clone(),
            CellRefCoord::new_rel(4),
            CellRefCoord::new_rel(12),
        ));
    }

    #[test]
    fn test_is_unbounded() {
        assert!(CellRefCoord::UNBOUNDED.is_unbounded());
        assert!(!CellRefCoord::new_rel(1).is_unbounded());
        assert!(!CellRefCoord::new_abs(1).is_unbounded());
    }

    #[test]
    fn test_serializer() {
        let coord = CellRefCoord::new_rel(1);
        let serialized = serde_json::to_string(&coord).unwrap();
        assert_eq!(coord, serde_json::from_str(&serialized).unwrap());

        let coord = CellRefCoord::new_abs(1);
        let serialized = serde_json::to_string(&coord).unwrap();
        assert_eq!(coord, serde_json::from_str(&serialized).unwrap());

        let coord = CellRefCoord::UNBOUNDED;
        let serialized = serde_json::to_string(&coord).unwrap();
        assert_eq!(coord, serde_json::from_str(&serialized).unwrap());
    }
}
