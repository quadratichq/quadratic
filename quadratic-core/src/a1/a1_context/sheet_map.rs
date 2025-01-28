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
        self.sheet_map.insert(sheet.name.to_string(), sheet.id);
    }

    pub fn insert_parts(&mut self, sheet_name: &str, sheet_id: SheetId) {
        self.sheet_map.insert(sheet_name.to_string(), sheet_id);
    }

    pub fn try_sheet_name(&self, sheet_name: &str) -> Option<SheetId> {
        let folded_name = case_fold(sheet_name);
        self.sheet_map
            .iter()
            .find(|(name, _)| case_fold(name) == folded_name)
            .map(|(_, id)| *id)
    }

    pub fn try_sheet_id(&self, sheet_id: SheetId) -> Option<&String> {
        self.sheet_map
            .iter()
            .find(|(_, id)| **id == sheet_id)
            .map(|(name, _)| name)
    }

    pub fn remove(&mut self, name: &str) -> Option<SheetId> {
        self.sheet_map.remove(name)
    }

    pub fn replace_sheet_name(&mut self, old_name: &str, new_name: &str) {
        if let Some(sheet_id) = self.sheet_map.remove(old_name) {
            self.sheet_map.insert(new_name.to_string(), sheet_id);
        }
    }
}

#[cfg(test)]
impl SheetMap {
    pub fn insert_test(&mut self, name: &str, id: SheetId) {
        self.sheet_map.insert(name.to_string(), id);
    }
}
