use std::collections::HashMap;

use quadratic_core_shared::{GridBounds, SheetId, SheetOffsets};

use super::Sheet;

/// Manages all sheets in the renderer
#[derive(Default)]
pub struct Sheets {
    /// All sheets indexed by ID
    sheets: HashMap<SheetId, Sheet>,

    /// Currently active sheet ID
    pub current: Option<SheetId>,
}

impl Sheets {
    pub fn new() -> Self {
        Self {
            sheets: HashMap::new(),
            current: None,
        }
    }

    /// Add or update a sheet
    pub fn set_sheet(&mut self, sheet_id: SheetId, offsets: SheetOffsets, bounds: GridBounds) {
        if let Some(existing) = self.sheets.get_mut(&sheet_id) {
            existing.update_from_sheet_info(offsets, bounds);
        } else {
            let sheet = Sheet::from_sheet_info(sheet_id.clone(), offsets, bounds);
            self.sheets.insert(sheet_id.clone(), sheet);
        }

        // If no current sheet, set this as current
        if self.current.is_none() {
            self.current = Some(sheet_id);
        }
    }

    /// Set the current active sheet
    /// Returns true if the sheet was switched (caller should mark things dirty)
    /// Creates a placeholder sheet with default offsets if it doesn't exist yet.
    /// The offsets will be updated when SheetInfo arrives.
    pub fn set_current_sheet(&mut self, sheet_id: SheetId) -> bool {
        if self.current == Some(sheet_id.clone()) {
            return false;
        }

        // Create placeholder sheet if it doesn't exist yet
        // This allows hash data to be stored before SheetInfo arrives
        if !self.sheets.contains_key(&sheet_id) {
            let sheet = Sheet::from_sheet_info(sheet_id.clone(), SheetOffsets::default(), GridBounds::Empty);
            self.sheets.insert(sheet_id.clone(), sheet);
        }

        self.current = Some(sheet_id);
        true
    }

    /// Get the current sheet (if any)
    pub fn current_sheet(&self) -> Option<&Sheet> {
        self.current.as_ref().and_then(|id| self.sheets.get(id))
    }

    /// Get the current sheet mutably (if any)
    pub fn current_sheet_mut(&mut self) -> Option<&mut Sheet> {
        if let Some(id) = &self.current {
            self.sheets.get_mut(id)
        } else {
            None
        }
    }

    /// Get a sheet by ID
    pub fn get(&self, sheet_id: &SheetId) -> Option<&Sheet> {
        self.sheets.get(sheet_id)
    }

    /// Get a mutable sheet by ID
    pub fn get_mut(&mut self, sheet_id: &SheetId) -> Option<&mut Sheet> {
        self.sheets.get_mut(sheet_id)
    }

    /// Get current sheet offsets (returns default if no sheet)
    pub fn current_sheet_offsets(&self) -> &SheetOffsets {
        static DEFAULT_OFFSETS: std::sync::OnceLock<SheetOffsets> = std::sync::OnceLock::new();
        self.current_sheet()
            .map(|s| &s.sheet_offsets)
            .unwrap_or_else(|| DEFAULT_OFFSETS.get_or_init(SheetOffsets::default))
    }

    /// Remove a sheet
    pub fn remove_sheet(&mut self, sheet_id: SheetId) {
        self.sheets.remove(&sheet_id);
        if self.current == Some(sheet_id) {
            // Switch to another sheet if available
            self.current = self.sheets.keys().next().cloned();
        }
    }

    /// Check if we have any sheets
    pub fn is_empty(&self) -> bool {
        self.sheets.is_empty()
    }

    /// Get the number of sheets
    pub fn len(&self) -> usize {
        self.sheets.len()
    }
}
