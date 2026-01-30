//! Table cache - stores and manages table rendering data

use std::collections::HashMap;

use quadratic_core::sheet_offsets::SheetOffsets;
use quadratic_core::Pos;

use crate::types::RenderCodeCell;

use super::TableData;

/// Cache of table data for a sheet
///
/// Tables are indexed by their anchor position for efficient lookup.
#[derive(Debug, Default)]
pub struct TableCache {
    /// Tables indexed by anchor position (x, y)
    tables: HashMap<(i64, i64), TableData>,

    /// Tables indexed by name
    tables_by_name: HashMap<String, (i64, i64)>,

    /// Position of the currently active table
    active_table_pos: Option<(i64, i64)>,

    /// Whether the cache needs rebuild
    dirty: bool,
}

impl TableCache {
    /// Create a new empty table cache
    pub fn new() -> Self {
        Self::default()
    }

    /// Clear all tables
    pub fn clear(&mut self) {
        self.tables.clear();
        self.tables_by_name.clear();
        self.active_table_pos = None;
        self.dirty = true;
    }

    /// Set all tables for the sheet (replaces existing)
    pub fn set_tables(&mut self, code_cells: Vec<RenderCodeCell>, offsets: &SheetOffsets) {
        self.tables.clear();
        self.tables_by_name.clear();

        for code_cell in code_cells {
            self.add_table(code_cell, offsets);
        }

        self.dirty = true;
    }

    /// Add or update a single table
    pub fn add_table(&mut self, code_cell: RenderCodeCell, offsets: &SheetOffsets) {
        // Only cache tables that have visible headers
        if !code_cell.show_name && !code_cell.show_columns {
            return;
        }

        let pos = (code_cell.x as i64, code_cell.y as i64);
        let name = code_cell.name.clone();

        let mut render_data = TableData::new(code_cell);
        render_data.update_bounds(offsets);

        // Remove old entry by name if it exists at a different position
        if let Some(&old_pos) = self.tables_by_name.get(&name) {
            if old_pos != pos {
                self.tables.remove(&old_pos);
            }
        }

        self.tables_by_name.insert(name, pos);
        self.tables.insert(pos, render_data);
        self.dirty = true;
    }

    /// Remove a table at the given position
    pub fn remove_table(&mut self, pos: Pos) {
        let key = (pos.x, pos.y);
        if let Some(removed) = self.tables.remove(&key) {
            self.tables_by_name.remove(&removed.code_cell.name);
        }
        if self.active_table_pos == Some(key) {
            self.active_table_pos = None;
        }
        self.dirty = true;
    }

    /// Update a table (or remove it if code_cell is None)
    pub fn update_table(
        &mut self,
        pos: Pos,
        code_cell: Option<RenderCodeCell>,
        offsets: &SheetOffsets,
    ) {
        match code_cell {
            Some(cell) => self.add_table(cell, offsets),
            None => self.remove_table(pos),
        }
    }

    /// Set the active (selected) table
    pub fn set_active_table(&mut self, pos: Option<Pos>) {
        let new_pos = pos.map(|p| (p.x, p.y));
        if self.active_table_pos != new_pos {
            // Mark old active table as inactive
            if let Some(old_pos) = self.active_table_pos {
                if let Some(table) = self.tables.get_mut(&old_pos) {
                    table.set_active(false);
                }
            }
            // Mark new active table
            if let Some(new_pos) = new_pos {
                if let Some(table) = self.tables.get_mut(&new_pos) {
                    table.set_active(true);
                }
            }
            self.active_table_pos = new_pos;
            self.dirty = true;
        }
    }

    /// Get a table by position
    pub fn get(&self, x: i64, y: i64) -> Option<&TableData> {
        self.tables.get(&(x, y))
    }

    /// Get a mutable table by position
    pub fn get_mut(&mut self, x: i64, y: i64) -> Option<&mut TableData> {
        self.tables.get_mut(&(x, y))
    }

    /// Get a table by name
    pub fn get_by_name(&self, name: &str) -> Option<&TableData> {
        self.tables_by_name
            .get(name)
            .and_then(|pos| self.tables.get(pos))
    }

    /// Iterate over all tables
    pub fn iter(&self) -> impl Iterator<Item = &TableData> {
        self.tables.values()
    }

    /// Iterate over all tables mutably
    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut TableData> {
        self.tables.values_mut()
    }

    /// Get tables that intersect with the given viewport bounds
    pub fn get_visible_tables(
        &self,
        viewport_left: f32,
        viewport_top: f32,
        viewport_right: f32,
        viewport_bottom: f32,
    ) -> impl Iterator<Item = &TableData> {
        self.tables.values().filter(move |table| {
            table.table_bounds.intersects_viewport(
                viewport_left,
                viewport_top,
                viewport_right,
                viewport_bottom,
            )
        })
    }

    /// Get the number of tables
    pub fn len(&self) -> usize {
        self.tables.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.tables.is_empty()
    }

    /// Check if dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Mark as clean
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Mark as dirty
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Update all table bounds when offsets change
    pub fn update_bounds(&mut self, offsets: &SheetOffsets) {
        for table in self.tables.values_mut() {
            table.update_bounds(offsets);
        }
        self.dirty = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{CodeCellLanguage, RenderCodeCellState};

    fn create_test_code_cell(x: i32, y: i32, name: &str) -> RenderCodeCell {
        RenderCodeCell {
            x,
            y,
            w: 3,
            h: 5,
            language: CodeCellLanguage::Python,
            state: RenderCodeCellState::Success,
            spill_error: None,
            name: name.to_string(),
            columns: vec![],
            first_row_header: false,
            sort: None,
            sort_dirty: false,
            alternating_colors: false,
            is_code: true,
            is_html: false,
            is_html_image: false,
            show_name: true,
            show_columns: true,
            last_modified: 0,
        }
    }

    #[test]
    fn test_table_cache_new() {
        let cache = TableCache::new();
        assert!(cache.is_empty());
        assert_eq!(cache.len(), 0);
    }

    #[test]
    fn test_table_cache_default() {
        let cache = TableCache::default();
        assert!(cache.is_empty());
    }

    #[test]
    fn test_add_table() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        let code_cell = create_test_code_cell(1, 1, "Table1");

        cache.add_table(code_cell, &offsets);

        assert_eq!(cache.len(), 1);
        assert!(!cache.is_empty());
        assert!(cache.get(1, 1).is_some());
    }

    #[test]
    fn test_add_table_no_headers() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        let mut code_cell = create_test_code_cell(1, 1, "Table1");
        code_cell.show_name = false;
        code_cell.show_columns = false;

        // Table without visible headers should not be cached
        cache.add_table(code_cell, &offsets);

        assert!(cache.is_empty());
    }

    #[test]
    fn test_get_by_name() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "MyTable"), &offsets);

        assert!(cache.get_by_name("MyTable").is_some());
        assert!(cache.get_by_name("NonExistent").is_none());
    }

    #[test]
    fn test_remove_table() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);

        assert_eq!(cache.len(), 1);

        cache.remove_table(Pos { x: 1, y: 1 });

        assert!(cache.is_empty());
    }

    #[test]
    fn test_clear() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);
        cache.add_table(create_test_code_cell(5, 5, "Table2"), &offsets);

        assert_eq!(cache.len(), 2);

        cache.clear();

        assert!(cache.is_empty());
    }

    #[test]
    fn test_set_tables() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();

        let tables = vec![
            create_test_code_cell(1, 1, "Table1"),
            create_test_code_cell(5, 5, "Table2"),
            create_test_code_cell(10, 10, "Table3"),
        ];

        cache.set_tables(tables, &offsets);

        assert_eq!(cache.len(), 3);
    }

    #[test]
    fn test_set_active_table() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);
        cache.add_table(create_test_code_cell(5, 5, "Table2"), &offsets);

        cache.mark_clean();

        cache.set_active_table(Some(Pos { x: 1, y: 1 }));
        assert!(cache.is_dirty());
        assert!(cache.get(1, 1).unwrap().is_active());
        assert!(!cache.get(5, 5).unwrap().is_active());

        cache.mark_clean();

        cache.set_active_table(Some(Pos { x: 5, y: 5 }));
        assert!(cache.is_dirty());
        assert!(!cache.get(1, 1).unwrap().is_active());
        assert!(cache.get(5, 5).unwrap().is_active());
    }

    #[test]
    fn test_set_active_table_none() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);

        cache.set_active_table(Some(Pos { x: 1, y: 1 }));
        assert!(cache.get(1, 1).unwrap().is_active());

        cache.set_active_table(None);
        assert!(!cache.get(1, 1).unwrap().is_active());
    }

    #[test]
    fn test_update_table() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);

        // Update with new code cell
        cache.update_table(Pos { x: 1, y: 1 }, Some(create_test_code_cell(1, 1, "UpdatedTable")), &offsets);
        assert!(cache.get_by_name("UpdatedTable").is_some());

        // Remove by passing None
        cache.update_table(Pos { x: 1, y: 1 }, None, &offsets);
        assert!(cache.is_empty());
    }

    #[test]
    fn test_iter() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);
        cache.add_table(create_test_code_cell(5, 5, "Table2"), &offsets);

        let count = cache.iter().count();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_dirty_tracking() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();

        assert!(!cache.is_dirty()); // Default is not dirty

        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);
        assert!(cache.is_dirty());

        cache.mark_clean();
        assert!(!cache.is_dirty());

        cache.mark_dirty();
        assert!(cache.is_dirty());
    }

    #[test]
    fn test_update_bounds() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);

        cache.mark_clean();
        cache.update_bounds(&offsets);

        assert!(cache.is_dirty());
    }

    #[test]
    fn test_get_visible_tables() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();
        cache.add_table(create_test_code_cell(1, 1, "Table1"), &offsets);
        cache.add_table(create_test_code_cell(100, 100, "Table2"), &offsets);

        // Large viewport should include both
        let visible: Vec<_> = cache.get_visible_tables(0.0, 0.0, 10000.0, 10000.0).collect();
        assert_eq!(visible.len(), 2);

        // Small viewport at origin might include only first table
        let visible: Vec<_> = cache.get_visible_tables(0.0, 0.0, 200.0, 200.0).collect();
        assert!(!visible.is_empty());
    }
}
