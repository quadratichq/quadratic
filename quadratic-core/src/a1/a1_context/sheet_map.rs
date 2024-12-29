//! Maps from sheet name to ID.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::{
    grid::{Sheet, SheetId},
    util::case_fold,
};

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct SheetMap {
    sheet_map: HashMap<String, SheetId>,
}

impl SheetMap {
    pub fn insert(&mut self, sheet: &Sheet) {
        self.sheet_map
            .insert(case_fold(&sheet.name), sheet.id.clone());
    }

    pub fn try_sheet_name(&self, sheet_name: &str) -> Option<SheetId> {
        self.sheet_map.get(&case_fold(sheet_name)).cloned()
    }

    pub fn try_sheet_id(&self, sheet_id: SheetId) -> Option<&String> {
        self.sheet_map
            .iter()
            .find(|(_, id)| **id == sheet_id)
            .map(|(name, _)| name)
    }
}

#[cfg(test)]
impl SheetMap {
    pub fn insert_test(&mut self, name: &str, id: SheetId) {
        self.sheet_map.insert(case_fold(name), id);
    }
}
