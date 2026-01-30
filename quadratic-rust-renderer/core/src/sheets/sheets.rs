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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sheets_new() {
        let sheets = Sheets::new();
        assert!(sheets.is_empty());
        assert_eq!(sheets.len(), 0);
        assert!(sheets.current_sheet_id().is_none());
    }

    #[test]
    fn test_sheets_default() {
        let sheets = Sheets::default();
        assert!(sheets.is_empty());
    }

    #[test]
    fn test_set_sheet() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);

        assert_eq!(sheets.len(), 1);
        assert!(!sheets.is_empty());
        assert!(sheets.get(&id).is_some());
    }

    #[test]
    fn test_set_sheet_auto_selects_current() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        assert!(sheets.current_sheet_id().is_none());

        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);

        // First sheet should become current automatically
        assert_eq!(sheets.current_sheet_id(), Some(id));
    }

    #[test]
    fn test_set_sheet_update_existing() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);
        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);

        // Should still have just one sheet
        assert_eq!(sheets.len(), 1);
    }

    #[test]
    fn test_set_current_sheet() {
        let mut sheets = Sheets::new();
        let id1 = SheetId::new();
        let id2 = SheetId::new();

        sheets.set_sheet(id1, SheetOffsets::default(), GridBounds::Empty);
        sheets.set_sheet(id2, SheetOffsets::default(), GridBounds::Empty);

        assert!(sheets.set_current_sheet(id2));
        assert_eq!(sheets.current_sheet_id(), Some(id2));

        assert!(sheets.set_current_sheet(id1));
        assert_eq!(sheets.current_sheet_id(), Some(id1));
    }

    #[test]
    fn test_set_current_sheet_no_change() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);
        assert!(sheets.current_sheet_id().is_some());

        // Setting same sheet should return false
        assert!(!sheets.set_current_sheet(id));
    }

    #[test]
    fn test_set_current_sheet_creates_placeholder() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        // Setting current to non-existent sheet should create placeholder
        assert!(sheets.set_current_sheet(id));
        assert_eq!(sheets.len(), 1);
        assert!(sheets.get(&id).is_some());
    }

    #[test]
    fn test_current_sheet() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        assert!(sheets.current_sheet().is_none());

        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);

        assert!(sheets.current_sheet().is_some());
        assert_eq!(sheets.current_sheet().unwrap().id(), id);
    }

    #[test]
    fn test_current_sheet_mut() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);

        let sheet = sheets.current_sheet_mut().unwrap();
        sheet.add_content(1, 1);

        assert!(sheets.current_sheet().unwrap().has_content(1, 1));
    }

    #[test]
    fn test_get_and_get_mut() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);

        assert!(sheets.get(&id).is_some());
        assert!(sheets.get_mut(&id).is_some());

        let other_id = SheetId::new();
        assert!(sheets.get(&other_id).is_none());
    }

    #[test]
    fn test_get_or_create() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        assert!(sheets.is_empty());

        let sheet = sheets.get_or_create(id);
        assert_eq!(sheet.id(), id);
        assert_eq!(sheets.len(), 1);

        // Getting again should return same sheet
        let _sheet2 = sheets.get_or_create(id);
        assert_eq!(sheets.len(), 1);
    }

    #[test]
    fn test_current_offsets() {
        let mut sheets = Sheets::new();

        // With no current sheet, should return default offsets
        let offsets = sheets.current_offsets();
        assert!(offsets.column_width(1) > 0.0);

        // With a sheet
        let id = SheetId::TEST;
        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);

        let offsets = sheets.current_offsets();
        assert!(offsets.column_width(1) > 0.0);
    }

    #[test]
    fn test_remove_sheet() {
        let mut sheets = Sheets::new();
        let id1 = SheetId::new();
        let id2 = SheetId::new();

        sheets.set_sheet(id1, SheetOffsets::default(), GridBounds::Empty);
        sheets.set_sheet(id2, SheetOffsets::default(), GridBounds::Empty);
        sheets.set_current_sheet(id1);

        sheets.remove_sheet(id1);

        assert_eq!(sheets.len(), 1);
        assert!(sheets.get(&id1).is_none());
        // Current should switch to remaining sheet
        assert_eq!(sheets.current_sheet_id(), Some(id2));
    }

    #[test]
    fn test_remove_sheet_only_one() {
        let mut sheets = Sheets::new();
        let id = SheetId::TEST;

        sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);
        sheets.remove_sheet(id);

        assert!(sheets.is_empty());
        assert!(sheets.current_sheet_id().is_none());
    }

    #[test]
    fn test_multiple_sheets() {
        let mut sheets = Sheets::new();

        for _ in 0..5 {
            let id = SheetId::new();
            sheets.set_sheet(id, SheetOffsets::default(), GridBounds::Empty);
        }

        assert_eq!(sheets.len(), 5);
    }
}
