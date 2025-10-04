use std::collections::{HashMap, HashSet};

use itertools::Itertools;
use rstar::{RTree, RTreeObject, primitives::GeomWithData};
use serde::{Deserialize, Serialize};

use crate::{Pos, Rect, SheetPos};

use super::SheetId;

/// Bidirectional map between positions and (potentially unbounded) rectangular
/// regions.
///
/// Positions and regions may be in the same sheet or different sheets. One
/// position may be associated to multiple regions, and one region may be
/// associated to multiple positions.
///
/// Sheets are automatically added as needed, but must be manually removed by
/// calling [`RegionMap::remove_sheet()`].
#[derive(Debug, Default, Clone)]
pub struct RegionMap {
    /// Associations organized by region.
    ///
    /// - Regions are represented by `SheetId` and a possibly-unbounded `Rect`.
    /// - Positions are represented by `SheetPos`.
    region_to_pos: HashMap<SheetId, RTree<GeomWithData<Rect, SheetPos>>>,

    /// Associations organized by position.
    ///
    /// - Regions are represented by `(SheetId, Rect)` in the innermost hashmap.
    /// - Positions are represented by `SheetId` and `Pos` in the hashmap keys.
    pos_to_region: HashMap<SheetId, HashMap<Pos, Vec<(SheetId, Rect)>>>,
}
impl RegionMap {
    /// Constructs a new empty region map.
    pub(crate) fn new() -> Self {
        Self::default()
    }

    /// Associates `pos` with `region`. `Rect` may be unbounded.
    pub(crate) fn insert(&mut self, pos: SheetPos, region: (SheetId, Rect)) {
        let (region_sheet, region_rect) = region;

        self.region_to_pos
            .entry(region_sheet)
            .or_default()
            .insert(GeomWithData::new(region_rect, pos));

        self.pos_to_region
            .entry(pos.sheet_id)
            .or_default()
            .entry(pos.into())
            .or_default()
            .push((region_sheet, region_rect));
    }

    /// Removes all associations with `pos` and adds new ones. `Rect`s may be
    /// unbounded.
    #[cfg(test)]
    pub(crate) fn set_regions_for_pos(&mut self, pos: SheetPos, regions: Vec<(SheetId, Rect)>) {
        self.remove_pos(pos);
        for region in regions {
            self.insert(pos, region);
        }
    }

    /// Removes all associations with `pos`.
    pub(crate) fn remove_pos(&mut self, pos: SheetPos) {
        // IIFE to mimic try_block
        (|| {
            let map = self.pos_to_region.get_mut(&pos.sheet_id)?;
            let regions = map.remove(&pos.into())?;
            for (region_sheet, region_rect) in regions {
                if let Some(rtree) = self.region_to_pos.get_mut(&region_sheet) {
                    rtree.remove(&GeomWithData::new(region_rect, pos));
                }
            }
            Some(())
        })();
    }

    /// Returns all cell positions associated with anything overlapping
    /// `region`.
    pub(crate) fn get_positions_associated_with_region(
        &self,
        region: (SheetId, Rect),
    ) -> HashSet<SheetPos> {
        let (region_sheet, region_rect) = region;
        match self.region_to_pos.get(&region_sheet) {
            None => HashSet::new(),
            Some(rtree) => rtree
                .locate_in_envelope_intersecting(&region_rect.envelope())
                .map(|obj| obj.data)
                .collect(),
        }
    }
}

impl Serialize for RegionMap {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let associations: Vec<(SheetPos, (SheetId, Rect))> = self
            .pos_to_region
            .iter()
            .flat_map(|(sheet_id, map)| {
                map.iter().flat_map(|(pos, regions)| {
                    regions
                        .iter()
                        .map(|&region| (pos.as_sheet_pos(*sheet_id), region))
                })
            })
            .collect_vec();
        associations.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for RegionMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let mut result = Self::new();
        for (pos, region) in Vec::<(SheetPos, (SheetId, Rect))>::deserialize(deserializer)? {
            result.insert(pos, region);
        }
        Ok(result)
    }
}

impl PartialEq for RegionMap {
    fn eq(&self, other: &Self) -> bool {
        let region_to_pos_self: HashSet<(SheetPos, (SheetId, Rect))> = self
            .region_to_pos
            .iter()
            .flat_map(|(sheet_id, rtree)| {
                rtree.iter().map(|obj| (obj.data, (*sheet_id, *obj.geom())))
            })
            .collect();

        let region_to_pos_other: HashSet<(SheetPos, (SheetId, Rect))> = other
            .region_to_pos
            .iter()
            .flat_map(|(sheet_id, rtree)| {
                rtree.iter().map(|obj| (obj.data, (*sheet_id, *obj.geom())))
            })
            .collect();

        let pos_to_region_self: HashSet<(SheetPos, (SheetId, Rect))> = self
            .pos_to_region
            .iter()
            .flat_map(|(sheet_id, map)| {
                map.iter().flat_map(|(pos, regions)| {
                    regions
                        .iter()
                        .map(|&region| (pos.as_sheet_pos(*sheet_id), region))
                })
            })
            .collect();

        let pos_to_region_other: HashSet<(SheetPos, (SheetId, Rect))> = other
            .pos_to_region
            .iter()
            .flat_map(|(sheet_id, map)| {
                map.iter().flat_map(|(pos, regions)| {
                    regions
                        .iter()
                        .map(|&region| (pos.as_sheet_pos(*sheet_id), region))
                })
            })
            .collect();

        region_to_pos_self == region_to_pos_other
            && region_to_pos_self == pos_to_region_self
            && region_to_pos_self == pos_to_region_other
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_region_map() {
        let mut map = RegionMap::new();
        let sheet1 = SheetId::new();
        let sheet2 = SheetId::new();
        map.insert(pos![sheet1!A1], (sheet1, rect![B2:B3]));
        map.insert(pos![sheet1!A1], (sheet2, rect![C1:E4]));
        map.insert(pos![sheet1!A2], (sheet2, rect![C1:E4]));
        map.insert(pos![sheet2!Q3], (sheet1, rect![A1:A10]));
        map.insert(pos![sheet2!C3], (sheet2, rect![C4:E4]));

        // Test serialization
        let serialized = serde_json::to_string(&map).unwrap();
        let deserialized: RegionMap = serde_json::from_str(&serialized).unwrap();

        for (msg, mut m) in [
            ("Testing original map ...", map),
            ("Testing deserialized ...", deserialized),
        ] {
            println!("{msg}");
            assert_eq!(
                m.get_positions_associated_with_region((sheet2, rect![D4:F10])),
                HashSet::from_iter([pos![sheet1!A1], pos![sheet1!A2], pos![sheet2!C3]]),
            );
            assert_eq!(
                m.get_positions_associated_with_region((sheet1, rect![B4:B4])),
                HashSet::new(),
            );
            assert_eq!(
                m.get_positions_associated_with_region((sheet1, rect![B2:B2])),
                HashSet::from_iter([pos![sheet1!A1]]),
            );
            assert_eq!(
                m.get_positions_associated_with_region((sheet1, rect![A2:B2])),
                HashSet::from_iter([pos![sheet1!A1], pos![sheet2!Q3]]),
            );

            m.set_regions_for_pos(
                pos![sheet1!A2],
                vec![(sheet1, rect![F6:F10]), (sheet1, rect![H6:H10])],
            );
            assert_eq!(
                m.get_positions_associated_with_region((sheet1, rect![H7:H7])),
                HashSet::from_iter([pos![sheet1!A2]])
            );
            assert_eq!(
                m.get_positions_associated_with_region((sheet2, rect![D4:F10])),
                HashSet::from_iter([pos![sheet1!A1], pos![sheet2!C3]]),
            );

            m.remove_pos(pos![sheet1!A2]);
            assert_eq!(
                m.get_positions_associated_with_region((sheet2, rect![D4:F10])),
                HashSet::from_iter([pos![sheet1!A1], pos![sheet2!C3]]),
            );
        }
    }

    #[test]
    fn test_region_map_unbounded() {
        let mut map = RegionMap::new();
        let sheet1 = SheetId::new();

        let columns = ref_range_bounds![C:E];
        let rows = ref_range_bounds![10:50];
        let all = ref_range_bounds![:];
        let finite = ref_range_bounds![B2:D17];

        map.insert(pos![sheet1!A1], (sheet1, columns.as_rect_unbounded()));
        map.insert(pos![sheet1!A2], (sheet1, rows.as_rect_unbounded()));
        map.insert(pos![sheet1!A3], (sheet1, all.as_rect_unbounded()));
        map.insert(pos![sheet1!A4], (sheet1, finite.as_rect_unbounded()));

        assert_eq!(
            map.get_positions_associated_with_region((sheet1, rect![D4:F10])),
            HashSet::from_iter([
                pos![sheet1!A1],
                pos![sheet1!A2],
                pos![sheet1!A3],
                pos![sheet1!A4],
            ]),
        );

        assert_eq!(
            map.get_positions_associated_with_region((
                sheet1,
                ref_range_bounds![F:].as_rect_unbounded(),
            )),
            HashSet::from_iter([pos![sheet1!A2], pos![sheet1!A3]]),
        );
    }
}
