use std::collections::{HashMap, HashSet};

use itertools::Itertools;
use rstar::{RTree, RTreeObject, primitives::GeomWithData};
use serde::{Deserialize, Serialize};

use crate::{Rect, SheetPos};

use super::{CodeCellLocation, SheetId};

/// Bidirectional map between code cell locations and (potentially unbounded)
/// rectangular regions.
///
/// Code cell locations can be either:
/// - `Sheet(SheetPos)`: Regular code cells in sheet columns or DataTable code_runs
/// - `Embedded { table_pos, x, y }`: Code cells within a DataTable's value array
///
/// Locations and regions may be in the same sheet or different sheets. One
/// location may be associated to multiple regions, and one region may be
/// associated to multiple locations.
///
/// Sheets are automatically added as needed, but must be manually removed by
/// calling [`RegionMap::remove_sheet()`].
#[derive(Debug, Default, Clone)]
pub struct RegionMap {
    /// Associations organized by region.
    ///
    /// - Regions are represented by `SheetId` and a possibly-unbounded `Rect`.
    /// - Locations are represented by `CodeCellLocation`.
    region_to_loc: HashMap<SheetId, RTree<GeomWithData<Rect, CodeCellLocation>>>,

    /// Associations organized by location.
    ///
    /// - Regions are represented by `(SheetId, Rect)` in the innermost hashmap.
    /// - Locations are represented by `CodeCellLocation` in the hashmap keys.
    loc_to_region: HashMap<CodeCellLocation, Vec<(SheetId, Rect)>>,
}
impl RegionMap {
    /// Constructs a new empty region map.
    pub fn new() -> Self {
        Self::default()
    }

    /// Associates a code cell location with a region. `Rect` may be unbounded.
    pub fn insert(&mut self, loc: CodeCellLocation, region: (SheetId, Rect)) {
        let (region_sheet, region_rect) = region;

        self.region_to_loc
            .entry(region_sheet)
            .or_default()
            .insert(GeomWithData::new(region_rect, loc));

        self.loc_to_region
            .entry(loc)
            .or_default()
            .push((region_sheet, region_rect));
    }

    /// Associates a SheetPos (as a Sheet location) with a region.
    /// Convenience method for backward compatibility.
    pub fn insert_sheet_pos(&mut self, pos: SheetPos, region: (SheetId, Rect)) {
        self.insert(CodeCellLocation::Sheet(pos), region);
    }

    /// Removes all associations with a location and adds new ones. `Rect`s may
    /// be unbounded.
    pub fn set_regions_for_loc(&mut self, loc: CodeCellLocation, regions: Vec<(SheetId, Rect)>) {
        self.remove_loc(loc);
        for region in regions {
            self.insert(loc, region);
        }
    }

    /// Removes all associations with a SheetPos and adds new ones.
    /// Convenience method for backward compatibility.
    pub fn set_regions_for_pos(&mut self, pos: SheetPos, regions: Vec<(SheetId, Rect)>) {
        self.set_regions_for_loc(CodeCellLocation::Sheet(pos), regions);
    }

    /// Removes a sheet, including all associations it interacts with.
    pub fn remove_sheet(&mut self, sheet_id: SheetId) {
        // Remove edges that use `sheet_id` in their location.
        // Collect locations to remove first to avoid borrowing issues
        let locs_to_remove: Vec<CodeCellLocation> = self
            .loc_to_region
            .keys()
            .filter(|loc| loc.sheet_id() == sheet_id)
            .copied()
            .collect();

        for loc in &locs_to_remove {
            if let Some(regions) = self.loc_to_region.remove(loc) {
                for (region_sheet, region_rect) in regions {
                    if let Some(rtree) = self.region_to_loc.get_mut(&region_sheet) {
                        rtree.remove(&GeomWithData::new(region_rect, *loc));
                    }
                }
            }
        }

        // Remove edges that use `sheet_id` in their region.
        let rtree = self.region_to_loc.remove(&sheet_id).unwrap_or_default();
        let locations: HashSet<CodeCellLocation> = rtree
            .into_iter()
            .map(|obj| obj.data)
            // optimization: ignore references within the sheet we're
            // removing because they'll get removed anyway.
            .filter(|loc| loc.sheet_id() != sheet_id)
            .collect();
        for loc in locations {
            if let Some(regions) = self.loc_to_region.get_mut(&loc) {
                regions.retain(|&(region_sheet, _region_rect)| region_sheet != sheet_id);
            }
        }
    }

    /// Removes all associations with a location.
    pub fn remove_loc(&mut self, loc: CodeCellLocation) {
        if let Some(regions) = self.loc_to_region.remove(&loc) {
            for (region_sheet, region_rect) in regions {
                if let Some(rtree) = self.region_to_loc.get_mut(&region_sheet) {
                    rtree.remove(&GeomWithData::new(region_rect, loc));
                }
            }
        }
    }

    /// Removes all associations with a SheetPos.
    /// Convenience method for backward compatibility.
    pub fn remove_pos(&mut self, pos: SheetPos) {
        self.remove_loc(CodeCellLocation::Sheet(pos));
    }

    /// Returns all code cell locations associated with anything overlapping
    /// `region`.
    pub fn get_locations_associated_with_region(
        &self,
        region: (SheetId, Rect),
    ) -> HashSet<CodeCellLocation> {
        let (region_sheet, region_rect) = region;
        match self.region_to_loc.get(&region_sheet) {
            None => HashSet::new(),
            Some(rtree) => rtree
                .locate_in_envelope_intersecting(&region_rect.envelope())
                .map(|obj| obj.data)
                .collect(),
        }
    }

    /// Returns all SheetPos positions associated with anything overlapping
    /// `region`. Only returns Sheet locations, not embedded ones.
    /// Convenience method for backward compatibility.
    pub fn get_positions_associated_with_region(
        &self,
        region: (SheetId, Rect),
    ) -> HashSet<SheetPos> {
        self.get_locations_associated_with_region(region)
            .into_iter()
            .filter_map(|loc| match loc {
                CodeCellLocation::Sheet(pos) => Some(pos),
                CodeCellLocation::Embedded { .. } => None,
            })
            .collect()
    }

    #[cfg(test)]
    fn find_all_mentions_of_sheet(&self, sheet_id: SheetId) -> Vec<(CodeCellLocation, (SheetId, Rect))> {
        itertools::chain(
            self.region_to_loc.iter().flat_map(|(region_sheet, rtree)| {
                rtree
                    .iter()
                    .map(|obj| (obj.data, (*region_sheet, *obj.geom())))
            }),
            self.loc_to_region.iter().flat_map(|(loc, regions)| {
                regions.iter().map(|&region| (*loc, region))
            }),
        )
        .filter(|(loc, (region_sheet, _region_rect))| {
            loc.sheet_id() == sheet_id || *region_sheet == sheet_id
        })
        .collect()
    }
}

impl Serialize for RegionMap {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let associations: Vec<(CodeCellLocation, (SheetId, Rect))> = self
            .loc_to_region
            .iter()
            .flat_map(|(loc, regions)| regions.iter().map(|&region| (*loc, region)))
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
        for (loc, region) in Vec::<(CodeCellLocation, (SheetId, Rect))>::deserialize(deserializer)? {
            result.insert(loc, region);
        }
        Ok(result)
    }
}

impl PartialEq for RegionMap {
    fn eq(&self, other: &Self) -> bool {
        let region_to_loc_self: HashSet<(CodeCellLocation, (SheetId, Rect))> = self
            .region_to_loc
            .iter()
            .flat_map(|(sheet_id, rtree)| {
                rtree.iter().map(|obj| (obj.data, (*sheet_id, *obj.geom())))
            })
            .collect();

        let region_to_loc_other: HashSet<(CodeCellLocation, (SheetId, Rect))> = other
            .region_to_loc
            .iter()
            .flat_map(|(sheet_id, rtree)| {
                rtree.iter().map(|obj| (obj.data, (*sheet_id, *obj.geom())))
            })
            .collect();

        let loc_to_region_self: HashSet<(CodeCellLocation, (SheetId, Rect))> = self
            .loc_to_region
            .iter()
            .flat_map(|(loc, regions)| regions.iter().map(|&region| (*loc, region)))
            .collect();

        let loc_to_region_other: HashSet<(CodeCellLocation, (SheetId, Rect))> = other
            .loc_to_region
            .iter()
            .flat_map(|(loc, regions)| regions.iter().map(|&region| (*loc, region)))
            .collect();

        region_to_loc_self == region_to_loc_other
            && region_to_loc_self == loc_to_region_self
            && region_to_loc_self == loc_to_region_other
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
        map.insert_sheet_pos(pos![sheet1!A1], (sheet1, rect![B2:B3]));
        map.insert_sheet_pos(pos![sheet1!A1], (sheet2, rect![C1:E4]));
        map.insert_sheet_pos(pos![sheet1!A2], (sheet2, rect![C1:E4]));
        map.insert_sheet_pos(pos![sheet2!Q3], (sheet1, rect![A1:A10]));
        map.insert_sheet_pos(pos![sheet2!C3], (sheet2, rect![C4:E4]));

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

        map.insert_sheet_pos(pos![sheet1!A1], (sheet1, columns.to_rect_unbounded()));
        map.insert_sheet_pos(pos![sheet1!A2], (sheet1, rows.to_rect_unbounded()));
        map.insert_sheet_pos(pos![sheet1!A3], (sheet1, all.to_rect_unbounded()));
        map.insert_sheet_pos(pos![sheet1!A4], (sheet1, finite.to_rect_unbounded()));

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

    #[test]
    fn test_region_map_embedded() {
        let mut map = RegionMap::new();
        let sheet1 = SheetId::new();

        let table_pos = pos![sheet1!B2];
        let embedded_loc = CodeCellLocation::embedded(table_pos, 1, 2);

        // Insert an embedded code cell location
        map.insert(embedded_loc, (sheet1, rect![A1:A10]));

        // Should find the embedded location
        let locs = map.get_locations_associated_with_region((sheet1, rect![A5:A5]));
        assert!(locs.contains(&embedded_loc));

        // get_positions_associated_with_region should NOT include embedded locations
        let positions = map.get_positions_associated_with_region((sheet1, rect![A5:A5]));
        assert!(positions.is_empty());

        // Add a sheet position too
        map.insert_sheet_pos(pos![sheet1!C1], (sheet1, rect![A1:A10]));

        // Now get_positions should find the sheet position
        let positions = map.get_positions_associated_with_region((sheet1, rect![A5:A5]));
        assert_eq!(positions.len(), 1);
        assert!(positions.contains(&pos![sheet1!C1]));

        // get_locations should find both
        let locs = map.get_locations_associated_with_region((sheet1, rect![A5:A5]));
        assert_eq!(locs.len(), 2);
        assert!(locs.contains(&embedded_loc));
        assert!(locs.contains(&CodeCellLocation::Sheet(pos![sheet1!C1])));

        // Remove the embedded location
        map.remove_loc(embedded_loc);
        let locs = map.get_locations_associated_with_region((sheet1, rect![A5:A5]));
        assert_eq!(locs.len(), 1);
        assert!(!locs.contains(&embedded_loc));
    }
}
