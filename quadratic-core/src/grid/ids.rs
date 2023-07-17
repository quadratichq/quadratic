use std::collections::{BTreeMap, HashMap};
use std::hash::Hash;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

macro_rules! uuid_wrapper_struct {
    ($name:ident) => {
        #[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
        #[serde(transparent)]
        pub struct $name(Uuid);
        impl $name {
            pub(super) fn new() -> Self {
                $name(Uuid::new_v4())
            }
        }
    };
}

uuid_wrapper_struct!(SheetId);
uuid_wrapper_struct!(RowId);
uuid_wrapper_struct!(ColumnId);

#[derive(Serialize, Deserialize, Debug, Copy, Clone, PartialEq, Eq, Hash)]
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

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct IdMap<Id: Hash + Eq, Idx: Ord> {
    id_to_index: HashMap<Id, Idx>,
    index_to_id: BTreeMap<Idx, Id>,
}
impl<Id: Copy + Hash + Eq, Idx: Copy + Ord> IdMap<Id, Idx> {
    pub fn new() -> Self {
        Self {
            id_to_index: HashMap::new(),
            index_to_id: BTreeMap::new(),
        }
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
