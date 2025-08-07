use std::{fmt, ops::RangeInclusive};

use serde::{Deserialize, Serialize};

#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::RefError;

/// Unbounded coordinate on lower or upper end.
pub const UNBOUNDED: i64 = i64::MAX;

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(feature = "js", derive(ts_rs::TS), wasm_bindgen)]
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
    pub const REL_START: Self = Self {
        coord: 1,
        is_absolute: false,
    };
    pub const ABS_START: Self = Self {
        coord: 1,
        is_absolute: true,
    };

    pub const REL_UNBOUNDED: Self = Self {
        coord: UNBOUNDED,
        is_absolute: false,
    };
    pub const ABS_UNBOUNDED: Self = Self {
        coord: UNBOUNDED,
        is_absolute: true,
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

    pub fn new_rel(coord: i64) -> Self {
        let is_absolute = false;
        Self { coord, is_absolute }
    }

    pub fn new_abs(coord: i64) -> Self {
        let is_absolute = true;
        Self { coord, is_absolute }
    }

    /// Adjusts the coordinate by `delta`.
    ///
    /// - Unbounded coordinates are unmodified.
    /// - If `relatively_only` is true, then absolute coordinates are
    ///   unmodified.
    ///
    /// Returns an error if the result is out of bounds.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn adjust(self, relative_only: bool, delta: i64) -> Result<Self, RefError> {
        if (relative_only && self.is_absolute) || self.is_unbounded() {
            Ok(self)
        } else {
            match self.coord.saturating_add(delta) {
                ..=0 => Err(RefError),
                other => Ok(Self {
                    coord: other,
                    is_absolute: self.is_absolute,
                }),
            }
        }
    }

    /// Adjusts the coordinate by `delta` if it is at least `start`. See
    /// [`Self::adjust()`]. If the coordinate ends up out of range, it is
    /// clamped to A1.
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn saturating_adjust(self, relative_only: bool, delta: i64) -> Self {
        self.adjust(relative_only, delta).unwrap_or(Self {
            coord: 1,
            is_absolute: self.is_absolute,
        })
    }

    // TODO: remove this function when switching to u64
    #[must_use = "this method returns a new value instead of modifying its input"]
    pub fn translate_unchecked(mut self, delta: i64) -> Self {
        if !self.is_unbounded() {
            self.coord = self.coord.saturating_add(delta);
        }
        self
    }

    pub fn is_unbounded(&self) -> bool {
        self.coord == UNBOUNDED
    }

    /// Returns a new coordinate with the value bounded to the given position
    /// at the start of the range.
    pub fn to_bounded_start(self, coord: i64) -> Self {
        Self {
            coord: self.coord.max(coord),
            is_absolute: self.is_absolute,
        }
    }

    /// Returns a new coordinate with the value bounded to the given position
    /// at the end of the range.
    pub fn to_bounded_end(self, coord: i64) -> Self {
        Self {
            coord: self.coord.min(coord),
            is_absolute: self.is_absolute,
        }
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
    fn test_translate() {
        for (init, delta, expected) in [
            (1, 0, Ok(1)),
            (10, 0, Ok(10)),
            (UNBOUNDED, 0, Ok(UNBOUNDED)),
            (1, 1, Ok(2)),
            (10, 1, Ok(11)),
            (UNBOUNDED, 1, Ok(UNBOUNDED)),
            (1, 3, Ok(4)),
            (10, 3, Ok(13)),
            (UNBOUNDED, 3, Ok(UNBOUNDED)),
            (1, -1, Err(RefError)),
            (10, -1, Ok(9)),
            (UNBOUNDED, -1, Ok(UNBOUNDED)),
            (1, -999, Err(RefError)),
            (10, -999, Err(RefError)),
            (UNBOUNDED, -999, Ok(UNBOUNDED)),
        ] {
            let abs_init = CellRefCoord::new_abs(init);
            let rel_init = CellRefCoord::new_rel(init);
            let abs_translated = expected.map(CellRefCoord::new_abs);
            let rel_translated = expected.map(CellRefCoord::new_rel);

            assert_eq!(Ok(abs_init), abs_init.adjust(true, delta));
            assert_eq!(rel_translated, rel_init.adjust(true, delta));
            assert_eq!(abs_translated, abs_init.adjust(false, delta));
            assert_eq!(rel_translated, rel_init.adjust(false, delta));

            let abs_clamped = abs_translated.unwrap_or(CellRefCoord::new_abs(1));
            let rel_clamped = rel_translated.unwrap_or(CellRefCoord::new_rel(1));

            assert_eq!(abs_init, abs_init.saturating_adjust(true, delta));
            assert_eq!(rel_clamped, rel_init.saturating_adjust(true, delta));
            assert_eq!(abs_clamped, abs_init.saturating_adjust(false, delta));
            assert_eq!(rel_clamped, rel_init.saturating_adjust(false, delta));
        }
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
        assert!(CellRefCoord::REL_UNBOUNDED.is_unbounded());
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

        let coord = CellRefCoord::REL_UNBOUNDED;
        let serialized = serde_json::to_string(&coord).unwrap();
        assert_eq!(coord, serde_json::from_str(&serialized).unwrap());
    }

    #[test]
    fn test_cell_ref_coord_ordering() {
        // sort primarily by number; abs vs. rel doesn't actually matter
        let sorted = [
            CellRefCoord::new_rel(1),
            CellRefCoord::new_abs(1),
            CellRefCoord::new_rel(2),
            CellRefCoord::new_abs(2),
            CellRefCoord::new_rel(3),
            CellRefCoord::new_abs(3),
        ];
        assert!(sorted.is_sorted());
    }
}
