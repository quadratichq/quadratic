use std::collections::{HashMap, HashSet};

use itertools::Itertools;
use rstar::{AABB, Point, RTree, RTreeObject, primitives::GeomWithData};
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
    pub fn new() -> Self {
        Self::default()
    }

    /// Associates `pos` with `region`. `Rect` may be unbounded.
    pub fn insert(&mut self, pos: SheetPos, region: (SheetId, Rect)) {
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
    pub fn set_regions_for_pos(&mut self, pos: SheetPos, regions: Vec<(SheetId, Rect)>) {
        self.remove_pos(pos);
        for region in regions {
            self.insert(pos, region);
        }
    }

    /// Removes a sheet, including all associations it interacts with.
    pub fn remove_sheet(&mut self, sheet_id: SheetId) {
        // Remove edges that use `sheet_id` in their position.
        let map = self.pos_to_region.remove(&sheet_id).unwrap_or_default();
        for (pos, region) in map {
            for (region_sheet, region_rect) in region {
                if let Some(rtree) = self.region_to_pos.get_mut(&region_sheet) {
                    rtree.remove(&GeomWithData::new(region_rect, pos.to_sheet_pos(sheet_id)));
                }
            }
        }

        // Remove edges that use `sheet_id` in their region.
        let rtree = self.region_to_pos.remove(&sheet_id).unwrap_or_default();
        let positions: HashSet<SheetPos> = rtree
            .into_iter()
            .map(|obj| obj.data)
            // optimization: ignore references within the sheet we're
            // removing because they'll get removed anyway.
            .filter(|pos| pos.sheet_id != sheet_id)
            .collect();
        for pos in positions {
            if let Some(map) = self.pos_to_region.get_mut(&pos.sheet_id) {
                if let Some(regions) = map.get_mut(&pos.into()) {
                    regions.retain(|&(region_sheet, _region_rect)| region_sheet != sheet_id);
                }
            }
        }
    }

    /// Removes all associations with `pos`.
    pub fn remove_pos(&mut self, pos: SheetPos) {
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
    pub fn get_positions_associated_with_region(
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

    #[cfg(test)]
    fn find_all_mentions_of_sheet(&self, sheet_id: SheetId) -> Vec<(SheetPos, (SheetId, Rect))> {
        itertools::chain(
            self.region_to_pos.iter().flat_map(|(region_sheet, rtree)| {
                rtree
                    .iter()
                    .map(|obj| (obj.data, (*region_sheet, *obj.geom())))
            }),
            self.pos_to_region.iter().flat_map(|(pos_sheet, map)| {
                map.iter().flat_map(|(pos, regions)| {
                    regions
                        .iter()
                        .map(|&region| (pos.to_sheet_pos(*pos_sheet), region))
                })
            }),
        )
        .filter(|(pos, (region_sheet, _region_rect))| {
            pos.sheet_id == sheet_id || *region_sheet == sheet_id
        })
        .collect()
    }
}

impl RTreeObject for Rect {
    type Envelope = AABB<Pos>;

    fn envelope(&self) -> Self::Envelope {
        AABB::from_corners(self.min, self.max)
    }
}

impl Point for Pos {
    type Scalar = i64;

    const DIMENSIONS: usize = 2;

    fn generate(mut generator: impl FnMut(usize) -> Self::Scalar) -> Self {
        Pos::new(generator(0), generator(1))
    }

    fn nth(&self, index: usize) -> Self::Scalar {
        [self.x, self.y][index]
    }

    fn nth_mut(&mut self, index: usize) -> &mut Self::Scalar {
        [&mut self.x, &mut self.y][index]
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
                        .map(|&region| (pos.to_sheet_pos(*sheet_id), region))
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

            m.remove_sheet(sheet2);
            assert!(m.find_all_mentions_of_sheet(sheet2).is_empty());
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

        map.insert(pos![sheet1!A1], (sheet1, columns.to_rect_unbounded()));
        map.insert(pos![sheet1!A2], (sheet1, rows.to_rect_unbounded()));
        map.insert(pos![sheet1!A3], (sheet1, all.to_rect_unbounded()));
        map.insert(pos![sheet1!A4], (sheet1, finite.to_rect_unbounded()));

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
                ref_range_bounds![F:].to_rect_unbounded(),
            )),
            HashSet::from_iter([pos![sheet1!A2], pos![sheet1!A3]]),
        );
    }
}
