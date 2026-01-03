//! Multi-sheet manager

use std::collections::HashMap;

use quadratic_core_shared::SheetId;

use super::Sheet;

/// Manages multiple sheets
pub struct Sheets {
    /// All sheets by ID
    sheets: HashMap<SheetId, Sheet>,

    /// Currently active sheet
    current_sheet_id: Option<SheetId>,
}

impl Sheets {
    pub fn new() -> Self {
        Self {
            sheets: HashMap::new(),
            current_sheet_id: None,
        }
    }

    /// Get the current sheet ID
    pub fn current_sheet_id(&self) -> Option<SheetId> {
        self.current_sheet_id
    }

    /// Set the current sheet
    pub fn set_current_sheet(&mut self, id: SheetId) {
        if !self.sheets.contains_key(&id) {
            self.sheets.insert(id, Sheet::new(id));
        }
        self.current_sheet_id = Some(id);
    }

    /// Get the current sheet
    pub fn current_sheet(&self) -> Option<&Sheet> {
        self.current_sheet_id.and_then(|id| self.sheets.get(&id))
    }

    /// Get the current sheet mutably
    pub fn current_sheet_mut(&mut self) -> Option<&mut Sheet> {
        self.current_sheet_id
            .and_then(|id| self.sheets.get_mut(&id))
    }

    /// Get a sheet by ID
    pub fn get(&self, id: SheetId) -> Option<&Sheet> {
        self.sheets.get(&id)
    }

    /// Get a sheet by ID mutably
    pub fn get_mut(&mut self, id: SheetId) -> Option<&mut Sheet> {
        self.sheets.get_mut(&id)
    }

    /// Get or create a sheet
    pub fn get_or_create(&mut self, id: SheetId) -> &mut Sheet {
        self.sheets.entry(id).or_insert_with(|| Sheet::new(id))
    }
}

impl Default for Sheets {
    fn default() -> Self {
        Self::new()
    }
}
