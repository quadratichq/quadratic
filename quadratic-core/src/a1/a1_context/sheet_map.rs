//! Maps from sheet name to ID.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::{
    grid::{Sheet, SheetId},
    util::case_fold,
};

/// Map between sheet names and IDs.
#[derive(Default, Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct SheetMap {
    /// Map from case-folded name to sheet ID.
    folded_name_to_id: HashMap<String, SheetId>,

    /// Map from sheet ID to name (not case-folded).
    id_to_name: HashMap<SheetId, String>,
}

impl SheetMap {
    /// Adds a sheet to the map.
    pub(crate) fn insert(&mut self, sheet: &Sheet) {
        self.insert_parts(&sheet.name, sheet.id);
    }

    /// Adds a sheet to the map given just its name and ID.
    pub(crate) fn insert_parts(&mut self, sheet_name: &str, sheet_id: SheetId) {
        self.folded_name_to_id
            .insert(case_fold(sheet_name), sheet_id);
        self.id_to_name.insert(sheet_id, sheet_name.to_string());
    }

    /// Returns a sheet ID from its name. The name will be automatically
    /// case-folded.
    pub(crate) fn try_sheet_name(&self, sheet_name: &str) -> Option<SheetId> {
        self.folded_name_to_id.get(&case_fold(sheet_name)).copied()
    }

    /// Returns a sheet name from its ID.
    pub(crate) fn try_sheet_id(&self, sheet_id: SheetId) -> Option<&String> {
        self.id_to_name.get(&sheet_id)
    }

    /// Removes the sheet with the given name and returns its ID.
    #[cfg(test)]
    pub(crate) fn remove_name(&mut self, name: &str) -> Option<SheetId> {
        self.folded_name_to_id
            .remove(&case_fold(name))
            .inspect(|sheet_id| {
                self.id_to_name.remove(sheet_id);
            })
    }

    /// Removes the sheet with the given ID and returns its name.
    pub(crate) fn remove_sheet_id(&mut self, sheet_id: SheetId) -> Option<String> {
        self.id_to_name.remove(&sheet_id).inspect(|name| {
            self.folded_name_to_id.remove(&case_fold(name));
        })
    }
}
