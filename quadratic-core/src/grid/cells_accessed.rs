use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    str::FromStr,
};
use ts_rs::TS;

use super::SheetId;
use crate::a1::{A1Context, CellRefRange, SheetCellRefRange};
use crate::{Rect, SheetPos, SheetRect};

#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct JsCellsAccessed {
    pub sheet_id: String,
    pub ranges: Vec<CellRefRange>,
}

impl From<SheetCellRefRange> for JsCellsAccessed {
    fn from(value: SheetCellRefRange) -> Self {
        JsCellsAccessed {
            sheet_id: value.sheet_id.to_string(),
            ranges: vec![value.cells],
        }
    }
}

#[derive(Default, Debug, Clone, PartialEq)]
pub struct CellsAccessed {
    pub cells: HashMap<SheetId, HashSet<CellRefRange>>,
}

// This custom serialization is needed because PendingTransaction::forward_operations
// may contain CellsAccessed and is serialized via serde_json.
impl Serialize for CellsAccessed {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(self.cells.len()))?;
        for (sheet_id, ranges) in &self.cells {
            map.serialize_entry(
                &sheet_id.to_string(),
                &ranges
                    .iter()
                    .map(|r| serde_json::to_string(r).unwrap())
                    .collect::<Vec<_>>(),
            )?;
        }
        map.end()
    }
}

impl<'de> Deserialize<'de> for CellsAccessed {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let js_cells = HashMap::<String, Vec<String>>::deserialize(deserializer)?;
        let mut cells = HashMap::new();

        for (sheet_id_str, ranges) in js_cells {
            if let Ok(sheet_id) = SheetId::from_str(&sheet_id_str) {
                let ranges: HashSet<CellRefRange> = ranges
                    .into_iter()
                    .filter_map(|r| serde_json::from_str(&r).ok())
                    .collect();
                if !ranges.is_empty() {
                    cells.insert(sheet_id, ranges);
                }
            }
        }

        Ok(CellsAccessed { cells })
    }
}

impl From<CellsAccessed> for Vec<JsCellsAccessed> {
    fn from(cells: CellsAccessed) -> Self {
        let mut js_cells = Vec::new();
        for (sheet_id, ranges) in cells.cells {
            js_cells.push(JsCellsAccessed {
                sheet_id: sheet_id.to_string(),
                ranges: ranges.into_iter().collect(),
            });
        }
        js_cells
    }
}

impl CellsAccessed {
    pub fn new() -> Self {
        Self {
            cells: HashMap::new(),
        }
    }

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
    pub fn intersects(&self, sheet_rect: &SheetRect, a1_context: &A1Context) -> bool {
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
            .any(|ranges| {
                ranges
                    .iter()
                    .any(|range| range.might_intersect_rect(rect, a1_context))
            })
    }

    /// Whether this CellsAccessed contains the SheetPos.
    pub fn contains(&self, pos: SheetPos, a1_context: &A1Context) -> bool {
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
                    .any(|range| range.might_contain_pos(pos.into(), a1_context))
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

    pub fn iter_rects_unbounded(
        &self,
        a1_context: &A1Context,
    ) -> impl Iterator<Item = (SheetId, Rect)> {
        self.cells.iter().flat_map(|(sheet_id, ranges)| {
            ranges.iter().flat_map(|range| {
                range
                    .to_rect_unbounded(a1_context)
                    .map(|rect| (*sheet_id, rect))
            })
        })
    }

    pub fn merge(&self, other: Self) -> Self {
        let mut cells = self.cells.clone();
        for (sheet_id, ranges) in other.cells {
            cells.entry(sheet_id).or_default().extend(ranges);
        }
        Self { cells }
    }
}

#[cfg(test)]
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
        assert!(
            cells.cells[&sheet_id]
                .contains(&CellRefRange::new_relative_rect(Rect::new(1, 2, 3, 4)))
        );
    }

    #[test]
    fn test_intersects() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(
            sheet_id,
            CellRefRange::new_relative_rect(Rect::new(1, 1, 3, 3)),
        );
        let context = A1Context::default();
        assert!(cells.intersects(&SheetRect::new(1, 1, 3, 3, sheet_id), &context));
        assert!(!cells.intersects(&SheetRect::new(4, 4, 5, 5, sheet_id), &context));
    }

    #[test]
    fn test_is_dependent_on() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, CellRefRange::new_relative_xy(1, 1));
        let context = A1Context::default();
        assert!(cells.contains(SheetPos::new(sheet_id, 1, 1), &context));
        assert!(!cells.contains(SheetPos::new(sheet_id, 2, 2), &context));
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
        let context = A1Context::default();
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 1));
        assert!(cells.contains(SheetPos::new(sheet_id, 1, 1), &context));
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
        let js_cells: Vec<JsCellsAccessed> = cells.into();
        assert_eq!(js_cells.len(), 1);
        assert_eq!(js_cells[0].sheet_id, sheet_id.to_string());
        assert_eq!(js_cells[0].ranges, vec![CellRefRange::ALL]);
    }

    #[test]
    fn test_serialize_deserialize() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add(sheet_id, CellRefRange::ALL);
        cells.add(sheet_id, CellRefRange::new_relative_xy(1, 1));

        // Test serialization
        let serialized = serde_json::to_string(&cells).unwrap();

        // Test deserialization
        let deserialized: CellsAccessed = serde_json::from_str(&serialized).unwrap();

        assert_eq!(cells, deserialized);
        assert_eq!(deserialized.cells.len(), 1);
        assert_eq!(deserialized.cells[&sheet_id].len(), 2);
    }

    #[test]
    fn test_merge() {
        // Test merging two CellsAccessed with different sheet IDs
        let mut cells1 = CellsAccessed::default();
        let sheet_id1 = SheetId::new();
        cells1.add(sheet_id1, CellRefRange::ALL);
        cells1.add(sheet_id1, CellRefRange::new_relative_xy(1, 1));

        let mut cells2 = CellsAccessed::default();
        let sheet_id2 = SheetId::new();
        cells2.add(sheet_id2, CellRefRange::new_relative_xy(2, 2));
        cells2.add(
            sheet_id2,
            CellRefRange::new_relative_rect(Rect::new(3, 3, 5, 5)),
        );

        let merged = cells1.merge(cells2);
        assert_eq!(merged.cells.len(), 2);
        assert_eq!(merged.cells[&sheet_id1].len(), 2);
        assert_eq!(merged.cells[&sheet_id2].len(), 2);
        assert!(merged.cells[&sheet_id1].contains(&CellRefRange::ALL));
        assert!(merged.cells[&sheet_id1].contains(&CellRefRange::new_relative_xy(1, 1)));
        assert!(merged.cells[&sheet_id2].contains(&CellRefRange::new_relative_xy(2, 2)));
        assert!(
            merged.cells[&sheet_id2]
                .contains(&CellRefRange::new_relative_rect(Rect::new(3, 3, 5, 5)))
        );

        // Test merging two CellsAccessed with the same sheet ID (ranges should be combined)
        let mut cells3 = CellsAccessed::default();
        cells3.add(sheet_id1, CellRefRange::new_relative_xy(3, 3));

        let merged_same_sheet = cells1.merge(cells3);
        assert_eq!(merged_same_sheet.cells.len(), 1);
        assert_eq!(merged_same_sheet.cells[&sheet_id1].len(), 3);
        assert!(merged_same_sheet.cells[&sheet_id1].contains(&CellRefRange::ALL));
        assert!(merged_same_sheet.cells[&sheet_id1].contains(&CellRefRange::new_relative_xy(1, 1)));
        assert!(merged_same_sheet.cells[&sheet_id1].contains(&CellRefRange::new_relative_xy(3, 3)));

        // Test merging with an empty CellsAccessed
        let empty = CellsAccessed::default();
        let merged_with_empty = cells1.merge(empty);
        assert_eq!(merged_with_empty, cells1);

        // Test merging an empty CellsAccessed with a non-empty one
        let empty = CellsAccessed::default();
        let merged_empty_with_cells = empty.merge(cells1.clone());
        assert_eq!(merged_empty_with_cells, cells1);
    }
}
