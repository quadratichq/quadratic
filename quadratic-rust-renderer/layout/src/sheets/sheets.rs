//! Sheets collection - manages multiple sheets

use std::collections::HashMap;

use quadratic_core_shared::{GridBounds, SheetId, SheetOffsets};

use super::Sheet;

/// Collection of sheets
#[derive(Default)]
pub struct Sheets {
    sheets: HashMap<SheetId, Sheet>,
    current_sheet_id: Option<SheetId>,
}

impl Sheets {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set or update a sheet
    pub fn set_sheet(&mut self, sheet_id: SheetId, offsets: SheetOffsets, bounds: GridBounds) {
        if let Some(sheet) = self.sheets.get_mut(&sheet_id) {
            sheet.sheet_offsets = offsets;
            sheet.bounds = bounds;
        } else {
            let sheet = Sheet::new(sheet_id, offsets, bounds);
            self.sheets.insert(sheet_id, sheet);

            // Auto-select first sheet if none selected
            if self.current_sheet_id.is_none() {
                self.current_sheet_id = Some(sheet_id);
            }
        }
    }

    /// Set the current active sheet
    /// Creates a placeholder sheet with default offsets if it doesn't exist yet.
    /// The offsets will be updated when SheetInfo arrives.
    pub fn set_current_sheet(&mut self, sheet_id: SheetId) -> bool {
        let changed = self.current_sheet_id != Some(sheet_id);
        self.current_sheet_id = Some(sheet_id);

        // Create placeholder sheet if it doesn't exist yet
        // This allows hash data to be stored before SheetInfo arrives
        if !self.sheets.contains_key(&sheet_id) {
            let sheet = Sheet::new(sheet_id, SheetOffsets::default(), GridBounds::Empty);
            self.sheets.insert(sheet_id, sheet);
        }

        changed
    }

    /// Get the current sheet ID (may be set before sheet exists)
    pub fn current_sheet_id(&self) -> Option<SheetId> {
        self.current_sheet_id
    }

    /// Get the current sheet
    pub fn current_sheet(&self) -> Option<&Sheet> {
        self.current_sheet_id
            .and_then(|id| self.sheets.get(&id))
    }

    /// Get the current sheet mutably
    pub fn current_sheet_mut(&mut self) -> Option<&mut Sheet> {
        self.current_sheet_id
            .and_then(|id| self.sheets.get_mut(&id))
    }

    /// Get a sheet by ID
    pub fn get(&self, sheet_id: &SheetId) -> Option<&Sheet> {
        self.sheets.get(sheet_id)
    }

    /// Get a sheet by ID mutably
    pub fn get_mut(&mut self, sheet_id: &SheetId) -> Option<&mut Sheet> {
        self.sheets.get_mut(sheet_id)
    }

    /// Remove a sheet
    pub fn remove_sheet(&mut self, sheet_id: SheetId) {
        self.sheets.remove(&sheet_id);
        if self.current_sheet_id == Some(sheet_id) {
            self.current_sheet_id = self.sheets.keys().next().copied();
        }
    }

    /// Get current sheet offsets (cloned, or default)
    pub fn current_sheet_offsets(&self) -> SheetOffsets {
        self.current_sheet()
            .map(|s| s.sheet_offsets.clone())
            .unwrap_or_default()
    }
}
