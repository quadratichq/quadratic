//! Multi-sheet manager
//!
//! Manages all sheets in the renderer.

use std::collections::HashMap;

use quadratic_core::grid::GridBounds;
use quadratic_core::grid::SheetId;
use quadratic_core::sheet_offsets::SheetOffsets;

use super::Sheet;

/// Manages multiple sheets
#[derive(Default)]
pub struct Sheets {
    /// All sheets by ID
    sheets: HashMap<SheetId, Sheet>,

    /// Currently active sheet ID
    pub current: Option<SheetId>,
}

impl Sheets {
    /// Create a new empty sheet manager
    pub fn new() -> Self {
        Self {
            sheets: HashMap::new(),
            current: None,
        }
    }

    /// Get the current sheet ID
    pub fn current_sheet_id(&self) -> Option<SheetId> {
        self.current
    }

    /// Add or update a sheet
    pub fn set_sheet(&mut self, sheet_id: SheetId, offsets: SheetOffsets, bounds: GridBounds) {
        if let Some(existing) = self.sheets.get_mut(&sheet_id) {
            existing.update_offsets(offsets, bounds);
        } else {
            let sheet = Sheet::with_offsets(sheet_id, offsets, bounds);
            self.sheets.insert(sheet_id, sheet);
        }

        // If no current sheet, set this as current
        if self.current.is_none() {
            self.current = Some(sheet_id);
        }
    }

    /// Set the current active sheet
    /// Returns true if the sheet was switched
    pub fn set_current_sheet(&mut self, sheet_id: SheetId) -> bool {
        if self.current == Some(sheet_id) {
            return false;
        }

        // Create placeholder if it doesn't exist
        self.sheets.entry(sheet_id).or_insert_with(|| {
            Sheet::with_offsets(sheet_id, SheetOffsets::default(), GridBounds::Empty)
        });

        self.current = Some(sheet_id);
        true
    }

    /// Get the current sheet
    pub fn current_sheet(&self) -> Option<&Sheet> {
        self.current.as_ref().and_then(|id| self.sheets.get(id))
    }

    /// Get the current sheet mutably
    pub fn current_sheet_mut(&mut self) -> Option<&mut Sheet> {
        if let Some(id) = &self.current {
            self.sheets.get_mut(id)
        } else {
            None
        }
    }

    /// Get a sheet by ID
    pub fn get(&self, id: &SheetId) -> Option<&Sheet> {
        self.sheets.get(id)
    }

    /// Get a sheet by ID mutably
    pub fn get_mut(&mut self, id: &SheetId) -> Option<&mut Sheet> {
        self.sheets.get_mut(id)
    }

    /// Get or create a sheet
    pub fn get_or_create(&mut self, id: SheetId) -> &mut Sheet {
        self.sheets.entry(id).or_insert_with(|| Sheet::new(id))
    }

    /// Get current sheet offsets
    pub fn current_offsets(&self) -> &SheetOffsets {
        static DEFAULT_OFFSETS: std::sync::OnceLock<SheetOffsets> = std::sync::OnceLock::new();
        self.current_sheet()
            .map(|s| &s.offsets)
            .unwrap_or_else(|| DEFAULT_OFFSETS.get_or_init(SheetOffsets::default))
    }

    /// Remove a sheet
    pub fn remove_sheet(&mut self, sheet_id: SheetId) {
        self.sheets.remove(&sheet_id);
        if self.current == Some(sheet_id) {
            self.current = self.sheets.keys().next().copied();
        }
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.sheets.is_empty()
    }

    /// Get number of sheets
    pub fn len(&self) -> usize {
        self.sheets.len()
    }
}
