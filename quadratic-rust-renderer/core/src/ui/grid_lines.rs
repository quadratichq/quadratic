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
