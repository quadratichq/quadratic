use std::collections::{HashMap, HashSet};

use itertools::Itertools;
use rstar::{RTree, RTreeObject, primitives::GeomWithData};
use serde::{Deserialize, Serialize};

use crate::{Pos, Rect};

/// Bidirectional map between positions and (potentially unbounded) rectangular
/// regions.
///
/// Positions and regions may be in the same sheet. One position may be
/// associated to multiple regions, and one region may be associated
/// to multiple positions.
#[derive(Debug, Default, Clone)]
pub struct SheetRegionMap {
    /// Associations organized by region.
    ///
    /// - Regions are represented by `Rect`, possibly-unbounded.
    /// - Positions are represented by `Pos`.
    region_to_pos: RTree<GeomWithData<Rect, Pos>>,

    /// Associations organized by position.
    ///
    /// - Regions are represented by `Rect`.
    /// - Positions are represented by `Pos` in the hashmap keys.
    pos_to_region: HashMap<Pos, Vec<Rect>>,
}

impl SheetRegionMap {
    /// Constructs a new empty region map.
    pub(crate) fn new() -> Self {
        Self::default()
    }

    /// Associates `pos` with `region`. `Rect` may be unbounded.
    pub(crate) fn insert(&mut self, pos: Pos, region: Rect) {
        self.region_to_pos.insert(GeomWithData::new(region, pos));
        self.pos_to_region.entry(pos).or_default().push(region);
    }

    /// Removes all associations with `pos` and adds new ones. `Rect`s may be
    /// unbounded.
    #[cfg(test)]
    pub(crate) fn set_regions_for_pos(&mut self, pos: Pos, regions: Vec<Rect>) {
        self.remove_pos(pos);
        for region in regions {
            self.insert(pos, region);
        }
    }

    /// Removes all associations with `pos`.
    pub(crate) fn remove_pos(&mut self, pos: Pos) {
        // IIFE to mimic try_block
        (|| {
            let regions = self.pos_to_region.remove(&pos)?;
            for region in regions {
                self.region_to_pos.remove(&GeomWithData::new(region, pos));
            }
            Some(())
        })();
    }

    /// Returns all cell positions associated with anything overlapping
    /// `region`.
    pub(crate) fn get_positions_associated_with_region(&self, region: Rect) -> HashSet<Pos> {
        self.region_to_pos
            .locate_in_envelope_intersecting(&region.envelope())
            .map(|obj| obj.data)
            .collect()
    }
}

impl Serialize for SheetRegionMap {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let associations: Vec<(Pos, Vec<Rect>)> = self
            .pos_to_region
            .iter()
            .map(|(pos, regions)| (*pos, regions.clone()))
            .collect_vec();
        associations.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for SheetRegionMap {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let mut result = Self::new();
        for (pos, regions) in Vec::<(Pos, Vec<Rect>)>::deserialize(deserializer)? {
            for region in regions {
                result.insert(pos, region);
            }
        }
        Ok(result)
    }
}

impl PartialEq for SheetRegionMap {
    fn eq(&self, other: &Self) -> bool {
        let region_to_pos_self: HashSet<(Pos, Rect)> = self
            .region_to_pos
            .iter()
            .map(|obj| (obj.data, *obj.geom()))
            .collect();

        let region_to_pos_other: HashSet<(Pos, Rect)> = other
            .region_to_pos
            .iter()
            .map(|obj| (obj.data, *obj.geom()))
            .collect();

        let pos_to_region_self: HashSet<(Pos, Rect)> = self
            .pos_to_region
            .iter()
            .flat_map(|(pos, regions)| regions.iter().map(|&region| (*pos, region)))
            .collect();

        let pos_to_region_other: HashSet<(Pos, Rect)> = other
            .pos_to_region
            .iter()
            .flat_map(|(pos, regions)| regions.iter().map(|&region| (*pos, region)))
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
        let mut map = SheetRegionMap::new();
        map.insert(pos![A1], rect![B2:B3]);
        map.insert(pos![A1], rect![C1:E4]);
        map.insert(pos![A2], rect![C1:E4]);
        map.insert(pos![Q3], rect![A1:A10]);
        map.insert(pos![C3], rect![C4:E4]);

        // Test serialization
        let serialized = serde_json::to_string(&map).unwrap();
        let deserialized: SheetRegionMap = serde_json::from_str(&serialized).unwrap();

        for (msg, mut m) in [
            ("Testing original map ...", map),
            ("Testing deserialized ...", deserialized),
        ] {
            println!("{msg}");
            assert_eq!(
                m.get_positions_associated_with_region(rect![D4:F10]),
                HashSet::from_iter([pos![A1], pos![A2], pos![C3]]),
            );
            assert_eq!(
                m.get_positions_associated_with_region(rect![B4:B4]),
                HashSet::new(),
            );
            assert_eq!(
                m.get_positions_associated_with_region(rect![B2:B2]),
                HashSet::from_iter([pos![A1]]),
            );
            assert_eq!(
                m.get_positions_associated_with_region(rect![A2:B2]),
                HashSet::from_iter([pos![A1], pos![Q3]]),
            );

            m.set_regions_for_pos(pos![A2], vec![rect![F6:F10], rect![H6:H10]]);
            assert_eq!(
                m.get_positions_associated_with_region(rect![H7:H7]),
                HashSet::from_iter([pos![A2]])
            );

            m.remove_pos(pos![A2]);
            assert_eq!(
                m.get_positions_associated_with_region(rect![D4:F10]),
                HashSet::from_iter([pos![A1], pos![C3]]),
            );
        }
    }

    #[test]
    fn test_region_map_unbounded() {
        let mut map = SheetRegionMap::new();

        let columns = ref_range_bounds![C:E];
        let rows = ref_range_bounds![10:50];
        let all = ref_range_bounds![:];
        let finite = ref_range_bounds![B2:D17];

        map.insert(pos![A1], columns.as_rect_unbounded());
        map.insert(pos![A2], rows.as_rect_unbounded());
        map.insert(pos![A3], all.as_rect_unbounded());
        map.insert(pos![A4], finite.as_rect_unbounded());

        assert_eq!(
            map.get_positions_associated_with_region(rect![D4:F10]),
            HashSet::from_iter([pos![A1], pos![A2], pos![A3], pos![A4],]),
        );

        assert_eq!(
            map.get_positions_associated_with_region(ref_range_bounds![F:].as_rect_unbounded()),
            HashSet::from_iter([pos![A2], pos![A3]]),
        );
    }
}
