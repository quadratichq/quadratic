use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{A1RangeType, Rect, RelPos, RelRect, SheetPos, SheetRect};

use super::SheetId;

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct CellsAccessed {
    pub cells: HashMap<SheetId, HashSet<A1RangeType>>,
}

impl CellsAccessed {
    /// Add a range to the set of cells accessed for a given sheet.
    pub fn add(&mut self, sheet_id: SheetId, range: A1RangeType) {
        self.cells.entry(sheet_id).or_default().insert(range);
    }

    /// Add a SheetRect to the set of cells accessed. This is a helper function
    /// that adds a relative Rect to the set of cells accessed. This should be
    /// replaced with an A1Type and deprecated (except for tests)
    pub fn add_sheet_rect(&mut self, sheet_rect: SheetRect) {
        let rel_rect = RelRect {
            min: RelPos::new(sheet_rect.min.x as u64, sheet_rect.min.y as u64, true, true),
            max: RelPos::new(sheet_rect.max.x as u64, sheet_rect.max.y as u64, true, true),
        };
        self.add(sheet_rect.sheet_id, A1RangeType::Rect(rel_rect));
    }

    /// Whether the CellsAccessed intersects the SheetRect.
    pub fn intersects(&self, sheet_rect: &SheetRect) -> bool {
        let rect: Rect = (*sheet_rect).into();
        self.cells
            .iter()
            .filter_map(|(sheet_id, ranges)| {
                if sheet_id == &sheet_rect.sheet_id {
                    Some(ranges)
                } else {
                    None
                }
            })
            .any(|ranges| ranges.iter().any(|range| range.intersects(&rect)))
    }

    /// Whether this CellsAccessed contains the SheetPos.
    pub fn contains(&self, other_pos: SheetPos) -> bool {
        self.cells
            .iter()
            .filter_map(|(sheet_id, ranges)| {
                if sheet_id == &other_pos.sheet_id {
                    Some(ranges)
                } else {
                    None
                }
            })
            .any(|ranges| ranges.iter().any(|range| range.contains(other_pos.into())))
    }

    /// Clears the CellsAccessed.
    pub fn clear(&mut self) {
        self.cells.clear();
    }
}

#[cfg(test)]
mod tests {
    use serial_test::parallel;

    use super::*;

    #[test]
    #[parallel]
    fn test_add() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, A1RangeType::All);
        assert_eq!(cells.cells.len(), 1);
        assert_eq!(cells.cells[&sheet_id].len(), 1);
        assert!(cells.cells[&sheet_id].contains(&A1RangeType::All));
    }

    #[test]
    #[parallel]
    fn test_add_sheet_rect() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add_sheet_rect(SheetRect::new(1, 2, 3, 4, sheet_id));
        assert_eq!(cells.cells.len(), 1);
        assert_eq!(cells.cells[&sheet_id].len(), 1);
        assert!(cells.cells[&sheet_id].contains(&A1RangeType::Rect(RelRect {
            min: RelPos::new(1, 2, true, true),
            max: RelPos::new(3, 4, true, true),
        })));
    }

    #[test]
    #[parallel]
    fn test_intersects() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(
            sheet_id,
            A1RangeType::Rect(RelRect {
                min: RelPos::new(1, 1, true, true),
                max: RelPos::new(3, 3, true, true),
            }),
        );
        assert!(cells.intersects(&SheetRect::new(1, 1, 3, 3, sheet_id)));
        assert!(!cells.intersects(&SheetRect::new(4, 4, 5, 5, sheet_id)));
    }

    #[test]
    #[parallel]
    fn test_is_dependent_on() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, A1RangeType::Pos(RelPos::new(1, 1, true, true)));
        assert!(cells.contains(SheetPos::new(sheet_id, 1, 1)));
        assert!(!cells.contains(SheetPos::new(sheet_id, 2, 2)));
    }

    #[test]
    #[parallel]
    fn test_clear() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, A1RangeType::All);
        cells.clear();
        assert_eq!(cells.cells.len(), 0);
    }
}
