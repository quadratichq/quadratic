use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use ts_rs::TS;

use super::SheetId;
use crate::{CellRefRange, Rect, SheetPos, SheetRect};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, TS)]
pub struct JsCellsAccessed {
    pub cells: HashMap<String, Vec<String>>,
}

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct CellsAccessed {
    pub cells: HashMap<SheetId, HashSet<CellRefRange>>, // TODO: change `CellRefRange` to `A1Selection`
}

impl From<CellsAccessed> for JsCellsAccessed {
    fn from(cells: CellsAccessed) -> Self {
        let mut js_cells = JsCellsAccessed::default();
        for (sheet_id, ranges) in cells.cells {
            js_cells.cells.insert(
                sheet_id.to_string(),
                ranges.into_iter().map(|r| r.to_string()).collect(),
            );
        }
        js_cells
    }
}

impl CellsAccessed {
    /// Add a range to the set of cells accessed for a given sheet.
    pub fn add(&mut self, sheet_id: SheetId, range: CellRefRange) {
        self.cells.entry(sheet_id).or_default().insert(range);
    }

    /// Add a SheetPos to the set of cells accessed. This is a helper function
    /// that adds a relative Pos to teh set of cells accessed. This should be
    /// replaced with an A1Type and deprecated.
    pub fn add_sheet_pos(&mut self, sheet_pos: SheetPos) {
        let range = CellRefRange::new_relative_pos(sheet_pos.into());
        self.add(sheet_pos.sheet_id, range);
    }

    /// Add a SheetRect to the set of cells accessed. This is a helper function
    /// that adds a relative Rect to the set of cells accessed. This should be
    /// replaced with an A1Type and deprecated (except for tests)
    pub fn add_sheet_rect(&mut self, sheet_rect: SheetRect) {
        let range = CellRefRange::new_relative_rect(sheet_rect.into());
        self.add(sheet_rect.sheet_id, range);
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
            .any(|ranges| ranges.iter().any(|range| range.might_intersect_rect(rect)))
    }

    /// Whether this CellsAccessed contains the SheetPos.
    pub fn contains(&self, pos: SheetPos) -> bool {
        self.cells
            .iter()
            .filter_map(|(sheet_id, ranges)| {
                if sheet_id == &pos.sheet_id {
                    Some(ranges)
                } else {
                    None
                }
            })
            .any(|ranges| {
                ranges
                    .iter()
                    .any(|range| range.might_contain_pos(pos.into()))
            })
    }

    /// Clears the CellsAccessed.
    pub fn clear(&mut self) {
        self.cells.clear();
    }

    /// Returns the number of sheets that have been accessed.
    pub fn len(&self, sheet_id: SheetId) -> Option<usize> {
        self.cells.get(&sheet_id).map(|ranges| ranges.len())
    }

    pub fn sheet_iter(&self, sheet_id: SheetId) -> impl Iterator<Item = &CellRefRange> {
        self.cells.get(&sheet_id).into_iter().flatten()
    }
}

#[cfg(test)]
#[serial_test::parallel]
mod tests {

    use super::*;

    #[test]
    fn test_add() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, CellRefRange::ALL);
        assert_eq!(cells.cells.len(), 1);
        assert_eq!(cells.cells[&sheet_id].len(), 1);
        assert!(cells.cells[&sheet_id].contains(&CellRefRange::ALL));
    }

    #[test]
    fn test_add_sheet_rect() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add_sheet_rect(SheetRect::new(1, 2, 3, 4, sheet_id));
        assert_eq!(cells.cells.len(), 1);
        assert_eq!(cells.cells[&sheet_id].len(), 1);
        assert!(cells.cells[&sheet_id]
            .contains(&CellRefRange::new_relative_rect(Rect::new(1, 2, 3, 4))));
    }

    #[test]
    fn test_intersects() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(
            sheet_id,
            CellRefRange::new_relative_rect(Rect::new(1, 1, 3, 3)),
        );
        assert!(cells.intersects(&SheetRect::new(1, 1, 3, 3, sheet_id)));
        assert!(!cells.intersects(&SheetRect::new(4, 4, 5, 5, sheet_id)));
    }

    #[test]
    fn test_is_dependent_on() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, CellRefRange::new_relative_xy(1, 1));
        assert!(cells.contains(SheetPos::new(sheet_id, 1, 1)));
        assert!(!cells.contains(SheetPos::new(sheet_id, 2, 2)));
    }

    #[test]
    fn test_clear() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, CellRefRange::ALL);
        cells.clear();
        assert_eq!(cells.cells.len(), 0);
    }

    #[test]
    fn test_add_sheet_pos() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 1));
        assert!(cells.contains(SheetPos::new(sheet_id, 1, 1)));
    }

    #[test]
    fn test_len() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 1));
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 2));
        assert_eq!(cells.len(sheet_id), Some(2));
        assert_eq!(cells.len(SheetId::new()), None);
    }

    #[test]
    fn test_sheet_iter() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 1));
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 2));
        assert_eq!(cells.sheet_iter(sheet_id).count(), 2);
    }

    #[test]
    fn test_to_js() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, CellRefRange::ALL);
        let js_cells: JsCellsAccessed = cells.into();
        assert_eq!(js_cells.cells.len(), 1);
        assert_eq!(js_cells.cells[&sheet_id.to_string()], vec!["*".to_string()]);
    }
}
