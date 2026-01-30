//! Grid lines rendering

use crate::types::LineBuffer;
use crate::viewport::Viewport;
use quadratic_core::sheet_offsets::SheetOffsets;

/// Default grid line color (light gray)
pub const GRID_LINE_COLOR: [f32; 4] = [0.9, 0.9, 0.9, 1.0];

/// Grid lines state and rendering
pub struct GridLines {
    /// Cached line buffer
    buffer: Option<LineBuffer>,

    /// Whether grid lines are dirty
    dirty: bool,
}

impl GridLines {
    pub fn new() -> Self {
        Self {
            buffer: None,
            dirty: true,
        }
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

    /// Update grid line geometry
    pub fn update(&mut self, viewport: &Viewport, offsets: &SheetOffsets) {
        if !self.dirty {
            return;
        }

        let bounds = viewport.visible_bounds();
        self.buffer = Some(Self::generate_for_bounds(
            bounds.left,
            bounds.top,
            bounds.right,
            bounds.bottom,
            offsets,
        ));
        self.dirty = false;
    }

    /// Generate grid lines for the given bounds
    ///
    /// This is a static helper that can be used without creating a GridLines instance.
    /// Useful for headless/native rendering where caching isn't needed.
    pub fn generate_for_bounds(
        left: f32,
        top: f32,
        right: f32,
        bottom: f32,
        offsets: &SheetOffsets,
    ) -> LineBuffer {
        let mut buffer = LineBuffer::new();

        // Get visible column range
        let (min_col, _) = offsets.column_from_x(left.max(0.0) as f64);
        let (max_col, _) = offsets.column_from_x(right.max(0.0) as f64);

        // Get visible row range
        let (min_row, _) = offsets.row_from_y(top.max(0.0) as f64);
        let (max_row, _) = offsets.row_from_y(bottom.max(0.0) as f64);

        // Draw vertical lines (column boundaries)
        for col in min_col..=max_col + 1 {
            let (x, _) = offsets.column_position_size(col);
            let x = x as f32;
            if x >= left && x <= right {
                buffer.add_line(x, top.max(0.0), x, bottom, GRID_LINE_COLOR);
            }
        }

        // Draw horizontal lines (row boundaries)
        for row in min_row..=max_row + 1 {
            let (y, _) = offsets.row_position_size(row);
            let y = y as f32;
            if y >= top && y <= bottom {
                buffer.add_line(left.max(0.0), y, right, y, GRID_LINE_COLOR);
            }
        }

        buffer
    }

    /// Get the line buffer
    pub fn get_buffer(&self) -> Option<LineBuffer> {
        self.buffer.clone()
    }

    /// Get vertices (for legacy rendering path)
    pub fn get_vertices(&self) -> Option<&[f32]> {
        self.buffer.as_ref().map(|b| b.vertices.as_slice())
    }
}

impl Default for GridLines {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::viewport::Viewport;

    #[test]
    fn test_grid_lines_new() {
        let grid_lines = GridLines::new();
        assert!(grid_lines.is_dirty());
        assert!(grid_lines.get_buffer().is_none());
    }

    #[test]
    fn test_grid_lines_default() {
        let grid_lines = GridLines::default();
        assert!(grid_lines.is_dirty());
    }

    #[test]
    fn test_mark_clean_dirty() {
        let mut grid_lines = GridLines::new();

        grid_lines.mark_clean();
        assert!(!grid_lines.is_dirty());

        grid_lines.mark_dirty();
        assert!(grid_lines.is_dirty());
    }

    #[test]
    fn test_update_clears_dirty() {
        let mut grid_lines = GridLines::new();
        let viewport = Viewport::new();
        let offsets = SheetOffsets::default();

        assert!(grid_lines.is_dirty());

        grid_lines.update(&viewport, &offsets);
        assert!(!grid_lines.is_dirty());
    }

    #[test]
    fn test_update_generates_buffer() {
        let mut grid_lines = GridLines::new();
        let viewport = Viewport::new();
        let offsets = SheetOffsets::default();

        assert!(grid_lines.get_buffer().is_none());

        grid_lines.update(&viewport, &offsets);

        assert!(grid_lines.get_buffer().is_some());
    }

    #[test]
    fn test_update_skipped_when_clean() {
        let mut grid_lines = GridLines::new();
        let viewport = Viewport::new();
        let offsets = SheetOffsets::default();

        grid_lines.update(&viewport, &offsets);
        grid_lines.mark_clean();

        // This update should be skipped
        grid_lines.update(&viewport, &offsets);
        assert!(!grid_lines.is_dirty());
    }

    #[test]
    fn test_generate_for_bounds() {
        let offsets = SheetOffsets::default();
        let buffer = GridLines::generate_for_bounds(0.0, 0.0, 200.0, 100.0, &offsets);

        // Should have vertices for grid lines
        assert!(!buffer.vertices.is_empty());
    }

    #[test]
    fn test_generate_for_bounds_larger() {
        let offsets = SheetOffsets::default();
        let buffer = GridLines::generate_for_bounds(0.0, 0.0, 1000.0, 500.0, &offsets);

        // Larger area should have more vertices
        assert!(!buffer.vertices.is_empty());
    }

    #[test]
    fn test_generate_for_bounds_offset() {
        let offsets = SheetOffsets::default();
        let buffer = GridLines::generate_for_bounds(100.0, 50.0, 300.0, 200.0, &offsets);

        // Should still generate lines for offset viewport
        assert!(!buffer.vertices.is_empty());
    }

    #[test]
    fn test_generate_for_bounds_negative_clipped() {
        let offsets = SheetOffsets::default();
        // Negative coordinates should be clipped to 0
        let buffer = GridLines::generate_for_bounds(-100.0, -50.0, 200.0, 100.0, &offsets);

        // Should still work
        assert!(!buffer.vertices.is_empty());
    }

    #[test]
    fn test_get_vertices() {
        let mut grid_lines = GridLines::new();
        let viewport = Viewport::new();
        let offsets = SheetOffsets::default();

        // Before update, no vertices
        assert!(grid_lines.get_vertices().is_none());

        grid_lines.update(&viewport, &offsets);

        // After update, should have vertices
        let vertices = grid_lines.get_vertices();
        assert!(vertices.is_some());
        assert!(!vertices.unwrap().is_empty());
    }

    #[test]
    fn test_grid_line_color() {
        // Verify the color constant is valid
        assert_eq!(GRID_LINE_COLOR.len(), 4);
        assert_eq!(GRID_LINE_COLOR[3], 1.0); // Fully opaque
    }
}
