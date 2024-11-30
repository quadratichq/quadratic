// todo: fix this
#![allow(non_local_definitions)]

use std::{fmt, ops::RangeInclusive};

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash, TS)]
#[cfg_attr(test, derive(proptest_derive::Arbitrary))]
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct CellRefCoord {
    #[cfg_attr(test, proptest(strategy = "super::PROPTEST_COORDINATE_I64"))]
    pub coord: i64,
    pub is_absolute: bool,
}
impl CellRefCoord {
    pub(crate) fn fmt_as_column(self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.is_absolute {
            write!(f, "$")?;
        }
        write!(f, "{}", super::column_name(self.coord as u64))
    }

    pub(crate) fn fmt_as_row(self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
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

    pub fn translate_in_place(&mut self, delta: i64) {
        self.coord = self.coord.saturating_add(delta).max(1);
    }

    pub fn translate(&self, delta: i64) -> Self {
        let mut coord = *self;
        coord.translate_in_place(delta);
        coord
    }
}

/// Returns whether `range` might intersect the region from `start` to `end`.
pub(crate) fn range_might_intersect(
    range: RangeInclusive<i64>,
    mut start: Option<CellRefCoord>,
    mut end: Option<CellRefCoord>,
) -> bool {
    if let (Some(a), Some(b)) = (start, end) {
        if b.coord < a.coord {
            std::mem::swap(&mut start, &mut end);
        }
    }
    let range_excluded_by_start = start.map_or(false, |a| *range.end() < a.coord);
    let range_excluded_by_end = end.map_or(false, |b| b.coord < *range.start());
    !range_excluded_by_start && !range_excluded_by_end
}

/// Returns whether `range` might contain `coord`.
///
/// If `coord` is `None`, returns `true`.
pub(crate) fn range_might_contain_coord(
    range: RangeInclusive<i64>,
    coord: Option<CellRefCoord>,
) -> bool {
    match coord {
        Some(a) => range.contains(&a.coord),
        None => true,
    }
}

#[cfg(test)]
#[serial_test::parallel]
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
            Some(CellRefCoord::new_rel(15)),
            Some(CellRefCoord::new_rel(20))
        ));

        // No intersection when range is after end
        assert!(!range_might_intersect(
            range.clone(),
            Some(CellRefCoord::new_rel(1)),
            Some(CellRefCoord::new_rel(3))
        ));

        // Intersection when range overlaps
        assert!(range_might_intersect(
            range.clone(),
            Some(CellRefCoord::new_rel(3)),
            Some(CellRefCoord::new_rel(7))
        ));

        // Intersection when range is contained
        assert!(range_might_intersect(
            range.clone(),
            Some(CellRefCoord::new_rel(4)),
            Some(CellRefCoord::new_rel(12))
        ));

        // Handles swapped start/end coordinates
        assert!(range_might_intersect(
            range.clone(),
            Some(CellRefCoord::new_rel(12)),
            Some(CellRefCoord::new_rel(4))
        ));

        // Handles None values
        assert!(range_might_intersect(
            range.clone(),
            None,
            Some(CellRefCoord::new_rel(7))
        ));
        assert!(range_might_intersect(
            range.clone(),
            Some(CellRefCoord::new_rel(7)),
            None
        ));
        assert!(range_might_intersect(range, None, None));
    }

    #[test]
    fn test_range_might_contain_coord() {
        let range = 5..=10;

        // Contains coordinate within range
        assert!(range_might_contain_coord(
            range.clone(),
            Some(CellRefCoord::new_rel(7))
        ));

        // Does not contain coordinate before range
        assert!(!range_might_contain_coord(
            range.clone(),
            Some(CellRefCoord::new_rel(3))
        ));

        // Does not contain coordinate after range
        assert!(!range_might_contain_coord(
            range.clone(),
            Some(CellRefCoord::new_rel(12))
        ));

        // Contains edge cases
        assert!(range_might_contain_coord(
            range.clone(),
            Some(CellRefCoord::new_rel(5))
        ));
        assert!(range_might_contain_coord(
            range.clone(),
            Some(CellRefCoord::new_rel(10))
        ));

        // Handles None case
        assert!(range_might_contain_coord(range, None));
    }
}
