//! Table cache - stores and manages table rendering data.
//!
//! This is analogous to the TypeScript Tables class and TablesCache,
//! providing efficient lookup of tables by position and name.

use std::collections::HashMap;

use quadratic_core_shared::{Pos, RenderCodeCell, SheetOffsets};

use super::TableRenderData;

/// Cache of table rendering data for a sheet.
///
/// Tables are indexed by their anchor position (top-left cell) for efficient
/// lookup during rendering. Only tables with visible headers (show_name or
/// show_columns) are stored here.
#[derive(Debug, Default)]
pub struct TableCache {
    /// Tables indexed by anchor position (x, y).
    tables: HashMap<(i64, i64), TableRenderData>,

    /// Tables indexed by name (for quick lookup by table name).
    tables_by_name: HashMap<String, (i64, i64)>,

    /// Position of the currently active (selected) table, if any.
    active_table_pos: Option<(i64, i64)>,

    /// Whether the cache needs to rebuild render data.
    dirty: bool,
}

impl TableCache {
    /// Create a new empty table cache.
    pub fn new() -> Self {
        Self::default()
    }

    /// Clear all tables from the cache.
    pub fn clear(&mut self) {
        self.tables.clear();
        self.tables_by_name.clear();
        self.active_table_pos = None;
        self.dirty = true;
    }

    /// Set all tables for the sheet (replaces existing).
    pub fn set_tables(&mut self, code_cells: Vec<RenderCodeCell>, offsets: &SheetOffsets) {
        self.tables.clear();
        self.tables_by_name.clear();

        for code_cell in code_cells {
            self.add_table(code_cell, offsets);
        }

        self.dirty = true;
    }

    /// Add or update a single table.
    pub fn add_table(&mut self, code_cell: RenderCodeCell, offsets: &SheetOffsets) {
        // Only cache tables that have visible headers
        if !code_cell.has_headers() {
            log::debug!(
                "[TableCache::add_table] Skipping table '{}' at ({}, {}) - has_headers=false (show_name={}, show_columns={}, state={:?})",
                code_cell.name,
                code_cell.x,
                code_cell.y,
                code_cell.show_name,
                code_cell.show_columns,
                code_cell.state
            );
            return;
        }

        log::debug!(
            "[TableCache::add_table] Adding table '{}' at ({}, {}) with {} columns",
            code_cell.name,
            code_cell.x,
            code_cell.y,
            code_cell.columns.len()
        );

        let pos = (code_cell.x as i64, code_cell.y as i64);
        let name = code_cell.name.clone();

        let mut render_data = TableRenderData::new(code_cell);
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

    /// Remove a table at the given position.
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

    /// Update a table (or remove it if code_cell is None).
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

    /// Set the active (selected) table.
    pub fn set_active_table(&mut self, pos: Option<Pos>) {
        let new_pos = pos.map(|p| (p.x, p.y));
        if self.active_table_pos != new_pos {
            // Mark old active table as needing redraw
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

    /// Get a table by position.
    pub fn get(&self, x: i64, y: i64) -> Option<&TableRenderData> {
        self.tables.get(&(x, y))
    }

    /// Get a mutable table by position.
    pub fn get_mut(&mut self, x: i64, y: i64) -> Option<&mut TableRenderData> {
        self.tables.get_mut(&(x, y))
    }

    /// Get a table by name.
    pub fn get_by_name(&self, name: &str) -> Option<&TableRenderData> {
        self.tables_by_name
            .get(name)
            .and_then(|pos| self.tables.get(pos))
    }

    /// Iterate over all tables.
    pub fn iter(&self) -> impl Iterator<Item = &TableRenderData> {
        self.tables.values()
    }

    /// Iterate over all tables mutably.
    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut TableRenderData> {
        self.tables.values_mut()
    }

    /// Get tables that intersect with the given viewport bounds.
    pub fn get_visible_tables(
        &self,
        viewport_left: f32,
        viewport_top: f32,
        viewport_right: f32,
        viewport_bottom: f32,
    ) -> impl Iterator<Item = &TableRenderData> {
        self.tables.values().filter(move |table| {
            let bounds = &table.table_bounds;
            bounds.right() > viewport_left
                && bounds.left() < viewport_right
                && bounds.bottom() > viewport_top
                && bounds.top() < viewport_bottom
        })
    }

    /// Get the number of tables in the cache.
    pub fn len(&self) -> usize {
        self.tables.len()
    }

    /// Check if the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.tables.is_empty()
    }

    /// Check if the cache is dirty (needs rebuild).
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Mark the cache as clean.
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Mark the cache as dirty.
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Update all table bounds when offsets change.
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
    use quadratic_core_shared::{CodeCellLanguage, RenderCodeCellState};

    fn make_test_code_cell(x: i32, y: i32, name: &str) -> RenderCodeCell {
        RenderCodeCell {
            x,
            y,
            w: 3,
            h: 5,
            language: CodeCellLanguage::Python,
            state: RenderCodeCellState::Success,
            name: name.to_string(),
            columns: vec![],
            first_row_header: false,
            show_name: true,
            show_columns: true,
            is_code: true,
            is_html: false,
            is_html_image: false,
            alternating_colors: true,
        }
    }

    #[test]
    fn test_add_and_get() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();

        let cell = make_test_code_cell(5, 10, "TestTable");
        cache.add_table(cell, &offsets);

        assert_eq!(cache.len(), 1);
        assert!(cache.get(5, 10).is_some());
        assert!(cache.get_by_name("TestTable").is_some());
    }

    #[test]
    fn test_remove() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();

        let cell = make_test_code_cell(5, 10, "TestTable");
        cache.add_table(cell, &offsets);

        cache.remove_table(Pos::new(5, 10));

        assert!(cache.is_empty());
        assert!(cache.get_by_name("TestTable").is_none());
    }

    #[test]
    fn test_active_table() {
        let mut cache = TableCache::new();
        let offsets = SheetOffsets::default();

        cache.add_table(make_test_code_cell(5, 10, "Table1"), &offsets);
        cache.add_table(make_test_code_cell(10, 20, "Table2"), &offsets);

        cache.set_active_table(Some(Pos::new(5, 10)));

        assert!(cache.get(5, 10).unwrap().is_active());
        assert!(!cache.get(10, 20).unwrap().is_active());

        cache.set_active_table(Some(Pos::new(10, 20)));

        assert!(!cache.get(5, 10).unwrap().is_active());
        assert!(cache.get(10, 20).unwrap().is_active());
    }
}
