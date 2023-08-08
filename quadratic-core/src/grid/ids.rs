use std::collections::{BTreeMap, HashMap};
use std::hash::Hash;

use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[cfg(feature = "js")]
use wasm_bindgen::prelude::*;

macro_rules! uuid_wrapper_struct {
    ($name:ident) => {
        #[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
        #[cfg_attr(feature = "js", wasm_bindgen, derive(ts_rs::TS), ts(export))]
        pub struct $name {
            id: Uuid,
        }

        impl $name {
            pub(super) fn new() -> Self {
                $name { id: Uuid::new_v4() }
            }
        }
    };
}

uuid_wrapper_struct!(SheetId);
uuid_wrapper_struct!(RowId);
uuid_wrapper_struct!(ColumnId);

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "js", derive(ts_rs::TS), ts(export))]
pub struct CellRef {
    pub sheet: SheetId,
    pub column: ColumnId,
    pub row: RowId,
}

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct RegionRef {
    pub top_left: CellRef,
    pub w: u32,
    pub h: u32,
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
}
