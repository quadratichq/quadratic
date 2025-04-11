use std::collections::{HashMap, HashSet};

use rstar::{AABB, Point, RTree, RTreeObject, primitives::GeomWithData};
use serde::{Deserialize, Serialize};

use crate::{Pos, Rect, SheetPos};

use super::SheetId;

/// Structure storing dependencies from cells to regions. These dependencies may
/// be within one sheet or may span from one sheet to another.
///
/// We use the term **arrow** to refer to one of these dependencies. The
/// **position** is the tail of the arrow (where it's coming from) and the
/// **region** is the head of the arrow (where it's pointing to).
///
/// Sheets are automatically added as needed, but must be manually removed by
/// calling [`DependencyMap::remove_sheet()`].
#[derive(Debug, Default, Clone)]
pub struct DependencyMap {
    /// Arrows organized by region.
    ///
    /// - Regions are represented by `SheetId` and a possibly-unbounded `Rect`.
    /// - Positions are represented by `SheetPos`.
    region_to_pos: HashMap<SheetId, RTree<GeomWithData<Rect, SheetPos>>>,

    /// Arrows organized by position.
    ///
    /// - Regions are represented by `(SheetId, Rect)` in the innermost hashmap.
    /// - Positions are represented by `SheetId` and `Pos` in the hashmap keys.
    pos_to_region: HashMap<SheetId, HashMap<Pos, Vec<(SheetId, Rect)>>>,
}
impl DependencyMap {
    /// Constructs a new empty dependency map.
    pub fn new() -> Self {
        Self::default()
    }

    /// Records that `pos` depends on `region`. `Rect` may be unbounded.
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

    /// Removes all dependencies of `pos` and adds new ones. `Rect`s may be
    /// unbounded.
    pub fn set_regions_for_pos(&mut self, pos: SheetPos, regions: Vec<(SheetId, Rect)>) {
        self.remove_pos(pos);
        for region in regions {
            self.insert(pos, region);
        }
    }

    /// Removes a sheet, including all dependencies it interacts with.
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

    /// Removes all dependencies of `pos`.
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

    /// Returns all cell positions with an arrow pointing toward `region`.
    pub fn get_positions_dependent_on_region(&self, region: (SheetId, Rect)) -> HashSet<SheetPos> {
        let (region_sheet, region_rect) = region;
        match self.region_to_pos.get(&region_sheet) {
            None => HashSet::new(),
            Some(rtree) => dbg!(rtree)
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

impl Serialize for DependencyMap {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.collect_seq(self.pos_to_region.iter().flat_map(|(sheet_id, map)| {
            map.iter()
                .map(|(pos, region)| (pos.to_sheet_pos(*sheet_id), region))
        }))
    }
}

impl<'de> Deserialize<'de> for DependencyMap {
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
    fn test_dependency_map() {
        let mut map = DependencyMap::new();
        let sheet1 = SheetId::new();
        let sheet2 = SheetId::new();
        map.insert(pos![sheet1!A1], (sheet1, rect![B2:B3]));
        map.insert(pos![sheet1!A1], (sheet2, rect![C1:E4]));
        map.insert(pos![sheet1!A2], (sheet2, rect![C1:E4]));
        map.insert(pos![sheet2!Q3], (sheet1, rect![A1:A10]));
        map.insert(pos![sheet2!C3], (sheet2, rect![C4:E4]));
        assert_eq!(
            map.get_positions_dependent_on_region((sheet2, rect![D4:F10])),
            HashSet::from_iter([pos![sheet1!A1], pos![sheet1!A2], pos![sheet2!C3]]),
        );
        assert_eq!(
            map.get_positions_dependent_on_region((sheet1, rect![B4:B4])),
            HashSet::new(),
        );
        assert_eq!(
            map.get_positions_dependent_on_region((sheet1, rect![B2:B2])),
            HashSet::from_iter([pos![sheet1!A1]]),
        );
        assert_eq!(
            map.get_positions_dependent_on_region((sheet1, rect![A2:B2])),
            HashSet::from_iter([pos![sheet1!A1], pos![sheet2!Q3]]),
        );

        map.remove_pos(pos![sheet1!A2]);
        assert_eq!(
            map.get_positions_dependent_on_region((sheet2, rect![D4:F10])),
            HashSet::from_iter([pos![sheet1!A1], pos![sheet2!C3]]),
        );

        map.remove_sheet(sheet2);
        assert!(map.find_all_mentions_of_sheet(sheet2).is_empty());
    }
}
