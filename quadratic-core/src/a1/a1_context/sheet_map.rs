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
    pub fn insert(&mut self, sheet: &Sheet) {
        self.insert_parts(&sheet.name, sheet.id);
    }
    /// Adds a sheet to the map given just its name and ID.
    pub fn insert_parts(&mut self, sheet_name: &str, sheet_id: SheetId) {
        self.folded_name_to_id
            .insert(case_fold(sheet_name.trim()), sheet_id);
        self.id_to_name.insert(sheet_id, sheet_name.to_string());
    }

    /// Returns a sheet ID from its name. The name will be automatically
    /// case-folded and trimmed.
    pub fn try_sheet_name(&self, sheet_name: &str) -> Option<SheetId> {
        self.folded_name_to_id
            .get(&case_fold(sheet_name.trim()))
            .copied()
    }
    /// Returns a sheet name from its ID.
    pub fn try_sheet_id(&self, sheet_id: SheetId) -> Option<&String> {
        self.id_to_name.get(&sheet_id)
    }

    /// Removes the sheet with the given name and returns its ID.
    /// The name will be automatically case-folded and trimmed.
    pub fn remove_name(&mut self, name: &str) -> Option<SheetId> {
        self.folded_name_to_id
            .remove(&case_fold(name.trim()))
            .inspect(|sheet_id| {
                self.id_to_name.remove(sheet_id);
            })
    }
    /// Removes the sheet with the given ID and returns its name.
    pub fn remove_sheet_id(&mut self, sheet_id: SheetId) -> Option<String> {
        self.id_to_name.remove(&sheet_id).inspect(|name| {
            self.folded_name_to_id.remove(&case_fold(name.trim()));
        })
    }

    /// Changes the name of a sheet. Names will be automatically
    /// case-folded and trimmed.
    pub fn replace_sheet_name(&mut self, old_name: &str, new_name: &str) {
        if let Some(sheet_id) = self.remove_name(old_name) {
            self.insert_parts(new_name, sheet_id);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_insert_and_lookup() {
        let mut map = SheetMap::default();
        let id = SheetId::new();
        map.insert_parts("Sheet1", id);

        assert_eq!(map.try_sheet_name("Sheet1"), Some(id));
        assert_eq!(map.try_sheet_name("sheet1"), Some(id)); // case insensitive
        assert_eq!(map.try_sheet_id(id), Some(&"Sheet1".to_string()));
    }

    #[test]
    fn test_lookup_trims_whitespace() {
        let mut map = SheetMap::default();
        let id = SheetId::new();

        // Insert with whitespace (simulates Excel import)
        map.insert_parts("  Sales  ", id);

        // All of these should find the sheet
        assert_eq!(map.try_sheet_name("Sales"), Some(id));
        assert_eq!(map.try_sheet_name("  Sales  "), Some(id));
        assert_eq!(map.try_sheet_name("sales"), Some(id));
        assert_eq!(map.try_sheet_name("  SALES  "), Some(id));

        // Original name preserved for display
        assert_eq!(map.try_sheet_id(id), Some(&"  Sales  ".to_string()));
    }

    #[test]
    fn test_remove_with_trimmed_name() {
        let mut map = SheetMap::default();
        let id = SheetId::new();
        map.insert_parts("  Data  ", id);

        // Can remove using trimmed name
        assert_eq!(map.remove_name("Data"), Some(id));
        assert_eq!(map.try_sheet_name("Data"), None);
    }

    #[test]
    fn test_replace_sheet_name_with_whitespace() {
        let mut map = SheetMap::default();
        let id = SheetId::new();
        map.insert_parts("  OldName  ", id);

        // Replace using trimmed old name
        map.replace_sheet_name("OldName", "NewName");

        assert_eq!(map.try_sheet_name("NewName"), Some(id));
        assert_eq!(map.try_sheet_name("OldName"), None);
    }

    #[test]
    fn test_distinct_sheets_after_trimming() {
        let mut map = SheetMap::default();
        let id1 = SheetId::new();
        let id2 = SheetId::new();

        map.insert_parts("Sheet1", id1);
        map.insert_parts("  Sheet1  ", id2); // Same after trimming - overwrites!

        // Second insert overwrites first since they're the same after trimming
        assert_eq!(map.try_sheet_name("Sheet1"), Some(id2));
    }
}
