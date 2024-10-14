use serde::de::{MapAccess, Visitor};
use serde::ser::SerializeMap;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::str::FromStr;
use ts_rs::TS;

use super::SheetId;
use crate::{A1RangeType, Rect, RelPos, RelRect, SheetPos, SheetRect};

#[derive(Default, Debug, Clone, PartialEq, TS)]
pub struct CellsAccessed {
    pub cells: HashMap<SheetId, HashSet<A1RangeType>>,
}

// todo: this is only needed b/c SheetId does not serialize directly to a String (it should)
impl Serialize for CellsAccessed {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(Some(self.cells.len()))?;
        for (k, v) in &self.cells {
            map.serialize_entry(&k.to_string(), v)?;
        }
        map.end()
    }
}

impl<'de> Deserialize<'de> for CellsAccessed {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct CellsAccessedVisitor;

        impl<'de> Visitor<'de> for CellsAccessedVisitor {
            type Value = CellsAccessed;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a map of SheetId to HashSet<A1RangeType>")
            }

            fn visit_map<M>(self, mut access: M) -> Result<Self::Value, M::Error>
            where
                M: MapAccess<'de>,
            {
                let mut cells = HashMap::new();
                while let Some((key, value)) =
                    access.next_entry::<String, HashSet<A1RangeType>>()?
                {
                    let sheet_id = SheetId::from_str(&key).map_err(serde::de::Error::custom)?;
                    cells.insert(sheet_id, value);
                }
                Ok(CellsAccessed { cells })
            }
        }

        deserializer.deserialize_map(CellsAccessedVisitor)
    }
}

impl CellsAccessed {
    /// Add a range to the set of cells accessed for a given sheet.
    pub fn add(&mut self, sheet_id: SheetId, range: A1RangeType) {
        self.cells.entry(sheet_id).or_default().insert(range);
    }

    /// Add a SheetPos to the set of cells accessed. This is a helper function
    /// that adds a relative Pos to teh set of cells accessed. This should be
    /// replaced with an A1Type and deprecated.
    pub fn add_sheet_pos(&mut self, sheet_pos: SheetPos) {
        self.add(
            sheet_pos.sheet_id,
            A1RangeType::Pos(RelPos::new(
                sheet_pos.x as u64,
                sheet_pos.y as u64,
                true,
                true,
            )),
        );
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

    /// Returns the number of sheets that have been accessed.
    pub fn len(&self, sheet_id: SheetId) -> Option<usize> {
        self.cells.get(&sheet_id).map(|ranges| ranges.len())
    }

    pub fn sheet_iter(&self, sheet_id: SheetId) -> impl Iterator<Item = &A1RangeType> {
        self.cells.get(&sheet_id).into_iter().flatten()
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

    #[test]
    #[parallel]
    fn test_add_sheet_pos() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 1));
        assert!(cells.contains(SheetPos::new(sheet_id, 1, 1)));
    }

    #[test]
    #[parallel]
    fn test_len() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 1));
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 2));
        assert_eq!(cells.len(sheet_id), Some(2));
        assert_eq!(cells.len(SheetId::new()), None);
    }

    #[test]
    #[parallel]
    fn test_sheet_iter() {
        let mut cells = CellsAccessed::default();
        let sheet_id = SheetId::new();
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 1));
        cells.add_sheet_pos(SheetPos::new(sheet_id, 1, 2));
        assert_eq!(cells.sheet_iter(sheet_id).count(), 2);
    }
}
