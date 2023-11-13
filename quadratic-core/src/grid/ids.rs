use core::fmt;
use core::fmt::Display;
use std::collections::{BTreeMap, HashMap};
use std::hash::Hash;
use std::str::FromStr;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

use crate::ArraySize;

macro_rules! uuid_wrapper_struct {
    ($name:ident) => {
        #[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
        #[cfg_attr(feature = "js", wasm_bindgen, derive(ts_rs::TS))]
        pub struct $name {
            id: Uuid,
        }

        impl $name {
            pub(crate) fn new() -> Self {
                $name { id: Uuid::new_v4() }
            }
        }

        impl FromStr for $name {
            type Err = anyhow::Error;

            fn from_str(s: &str) -> Result<Self> {
                let id = Uuid::parse_str(s);
                Ok($name { id: id? })
            }
        }

        impl Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", self.id)
            }
        }
    };
}

uuid_wrapper_struct!(SheetId);
uuid_wrapper_struct!(RowId);
uuid_wrapper_struct!(ColumnId);

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", wasm_bindgen, derive(ts_rs::TS))]
pub struct CellRef {
    pub sheet: SheetId,
    pub column: ColumnId,
    pub row: RowId,
}
impl Display for CellRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}, {}, {}", self.sheet, self.column, self.row)
    }
}

/// Reference to a set of cells which stays the same, even as columns and rows
/// move around. It typically is constructed as a rectangle, but if columns and
/// rows move then it may no longer be rectangular.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub struct RegionRef {
    pub sheet: SheetId,
    pub columns: Vec<ColumnId>,
    pub rows: Vec<RowId>,
}
impl From<CellRef> for RegionRef {
    fn from(value: CellRef) -> Self {
        RegionRef {
            sheet: value.sheet,
            columns: vec![value.column],
            rows: vec![value.row],
        }
    }
}

impl RegionRef {
    /// Iterates over cells in row-major order.
    pub fn iter(&self) -> impl '_ + Iterator<Item = CellRef> {
        let sheet = self.sheet;
        itertools::iproduct!(&self.rows, &self.columns).map(move |(&row, &column)| CellRef {
            sheet,
            column,
            row,
        })
    }

    /// Returns the size of an array containing the cells in the region, or
    /// `None` if the region is empty.
    pub fn size(&self) -> Option<ArraySize> {
        ArraySize::new(self.columns.len() as u32, self.rows.len() as u32)
    }

    /// Returns the number of cells in the region.
    pub fn len(&self) -> usize {
        self.columns.len() * self.rows.len()
    }

    pub fn is_empty(&self) -> bool {
        self.columns.len() == 0 && self.rows.len() == 0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IdMap<Id: Hash + Eq, Idx: Ord> {
    id_to_index: HashMap<Id, Idx>,
    index_to_id: BTreeMap<Idx, Id>,
}
impl<Id: Hash + Eq, Idx: Ord> Serialize for IdMap<Id, Idx>
where
    Id: Copy + Serialize,
    Idx: Copy + Serialize,
{
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let map: HashMap<String, Idx> = self
            .id_to_index
            .iter()
            .map(|(id, idx)| (serde_json::to_string(id).unwrap(), *idx))
            .collect();
        map.serialize(serializer)
    }
}
impl<'de, Id: Hash + Eq, Idx: Ord> Deserialize<'de> for IdMap<Id, Idx>
where
    Id: Copy + for<'a> Deserialize<'a>,
    Idx: Copy + for<'a> Deserialize<'a>,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let map = HashMap::<&'de str, Idx>::deserialize(deserializer)?;
        let mut ret = Self::new();
        for (k, v) in map {
            ret.add(serde_json::from_str(k).unwrap(), v);
        }
        Ok(ret)
    }
}
impl<Id: Hash + Eq, Idx: Ord> Default for IdMap<Id, Idx> {
    fn default() -> Self {
        Self {
            id_to_index: HashMap::default(),
            index_to_id: BTreeMap::default(),
        }
    }
}
impl<Id: Copy + Hash + Eq, Idx: Copy + Ord> IdMap<Id, Idx> {
    pub fn new() -> Self {
        Self {
            id_to_index: HashMap::new(),
            index_to_id: BTreeMap::new(),
        }
    }

    pub fn len(&self) -> usize {
        self.id_to_index.len()
    }

    pub fn is_empty(&self) -> bool {
        self.id_to_index.is_empty()
    }

    pub fn add(&mut self, id: Id, index: Idx) {
        self.id_to_index.insert(id, index);
        self.index_to_id.insert(index, id);
    }
    pub fn index_of(&self, id: Id) -> Option<Idx> {
        self.id_to_index.get(&id).copied()
    }
    pub fn id_at(&self, idx: Idx) -> Option<Id> {
        self.index_to_id.get(&idx).copied()
    }

    /// Returns an iterator over indexes and corresponding IDs
    pub fn iter(&self) -> impl '_ + Iterator<Item = (Idx, Id)> {
        self.index_to_id.iter().map(|(&index, &id)| (index, id))
    }
}
impl<Id: Copy + Hash + Eq, Idx: Copy + Ord> FromIterator<(Idx, Id)> for IdMap<Id, Idx> {
    fn from_iter<T: IntoIterator<Item = (Idx, Id)>>(iter: T) -> Self {
        let mut ret = Self::new();
        for (index, id) in iter {
            ret.add(id, index);
        }
        ret
    }
}
