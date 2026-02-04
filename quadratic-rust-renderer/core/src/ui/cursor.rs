//! Cursor (selection) rendering

use crate::types::{CursorRenderData, FillBuffer};
use crate::viewport::Viewport;

/// Cursor selection state and rendering
pub struct Cursor {
    /// Selected cell (1-indexed)
    selected_col: i64,
    selected_row: i64,

    /// Selection range (1-indexed, inclusive)
    selection_start: Option<(i64, i64)>,
    selection_end: Option<(i64, i64)>,

    /// Whether cursor is dirty
    dirty: bool,

    /// Cached render data
    render_data: Option<CursorRenderData>,
}

impl Cursor {
    pub fn new() -> Self {
        Self {
            selected_col: 1,
            selected_row: 1,
            selection_start: None,
            selection_end: None,
            dirty: true,
            render_data: None,
        }
    }

    /// Set selected cell
    pub fn set_selected_cell(&mut self, col: i64, row: i64) {
        self.selected_col = col;
        self.selected_row = row;
        self.dirty = true;
    }

    /// Set selection range
    pub fn set_selection(&mut self, start_col: i64, start_row: i64, end_col: i64, end_row: i64) {
        self.selection_start = Some((start_col, start_row));
        self.selection_end = Some((end_col, end_row));
        self.dirty = true;
    }

    /// Clear selection (single cell mode)
    pub fn clear_selection(&mut self) {
        self.selection_start = None;
        self.selection_end = None;
        self.dirty = true;
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

    /// Update cursor geometry
    pub fn update(
        &mut self,
        _viewport: &Viewport,
        _offsets: &quadratic_core::sheet_offsets::SheetOffsets,
    ) {
        if !self.dirty {
            return;
        }

        // TODO: Generate cursor fill and border geometry
        let mut fill = FillBuffer::new();
        let border = FillBuffer::new();

        // For now, just create a simple cursor at origin
        // This would use offsets to calculate actual cell bounds
        let x = 0.0;
        let y = 0.0;
        let width = 100.0;
        let height = 21.0;

        // Selection fill (light blue)
        fill.add_rect(x, y, width, height, [0.0, 0.5, 1.0, 0.2]);

        self.render_data = Some(CursorRenderData {
            fill: Some(fill),
            border: Some(border),
        });

        self.dirty = false;
    }

    /// Get render data
    pub fn get_render_data(&self) -> Option<CursorRenderData> {
        self.render_data.clone()
    }

    /// Get fill vertices (for legacy rendering path)
    pub fn get_fill_vertices(&self) -> Option<&[f32]> {
        self.render_data
            .as_ref()
            .and_then(|d| d.fill.as_ref())
            .map(|f| f.vertices.as_slice())
    }

    /// Get border vertices (for legacy rendering path)
    pub fn get_border_vertices(&self, _scale: f32) -> Option<&[f32]> {
        self.render_data
            .as_ref()
            .and_then(|d| d.border.as_ref())
            .map(|f| f.vertices.as_slice())
    }
}

impl Default for Cursor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cursor_new() {
        let cursor = Cursor::new();
        assert!(cursor.is_dirty());
    }

    #[test]
    fn test_cursor_default() {
        let cursor = Cursor::default();
        assert!(cursor.is_dirty());
    }

    #[test]
    fn test_set_selected_cell() {
        let mut cursor = Cursor::new();
        cursor.mark_clean();
        assert!(!cursor.is_dirty());

        cursor.set_selected_cell(5, 10);
        assert!(cursor.is_dirty());
    }

    #[test]
    fn test_set_selection() {
        let mut cursor = Cursor::new();
        cursor.mark_clean();

        cursor.set_selection(1, 1, 10, 10);
        assert!(cursor.is_dirty());
    }

    #[test]
    fn test_clear_selection() {
        let mut cursor = Cursor::new();
        cursor.set_selection(1, 1, 10, 10);
        cursor.mark_clean();

        cursor.clear_selection();
        assert!(cursor.is_dirty());
    }

    #[test]
    fn test_mark_clean_dirty() {
        let mut cursor = Cursor::new();

        cursor.mark_clean();
        assert!(!cursor.is_dirty());

        cursor.mark_dirty();
        assert!(cursor.is_dirty());
    }

    #[test]
    fn test_update_clears_dirty() {
        let mut cursor = Cursor::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        assert!(cursor.is_dirty());

        cursor.update(&viewport, &offsets);
        assert!(!cursor.is_dirty());
    }

    #[test]
    fn test_update_generates_render_data() {
        let mut cursor = Cursor::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        assert!(cursor.get_render_data().is_none());

        cursor.update(&viewport, &offsets);
        assert!(cursor.get_render_data().is_some());
    }

    #[test]
    fn test_update_skipped_when_clean() {
        let mut cursor = Cursor::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        cursor.update(&viewport, &offsets);
        cursor.mark_clean();

        // This update should be skipped
        cursor.update(&viewport, &offsets);
        assert!(!cursor.is_dirty());
    }

    #[test]
    fn test_get_fill_vertices() {
        let mut cursor = Cursor::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        // Before update, no vertices
        assert!(cursor.get_fill_vertices().is_none());

        cursor.update(&viewport, &offsets);

        // After update, should have vertices
        let vertices = cursor.get_fill_vertices();
        assert!(vertices.is_some());
    }

    #[test]
    fn test_get_border_vertices() {
        let mut cursor = Cursor::new();
        let viewport = Viewport::new();
        let offsets = quadratic_core::sheet_offsets::SheetOffsets::default();

        cursor.update(&viewport, &offsets);

        // Should have border data (may be empty)
        let vertices = cursor.get_border_vertices(1.0);
        assert!(vertices.is_some());
    }
}
