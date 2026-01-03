//! Grid lines rendering

use crate::types::LineBuffer;
use crate::viewport::Viewport;

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
    pub fn update(&mut self, viewport: &Viewport, offsets: &quadratic_core_shared::SheetOffsets) {
        if !self.dirty {
            return;
        }

        let bounds = viewport.visible_bounds();
        let mut buffer = LineBuffer::new();

        // Grid line color (light gray)
        let color = [0.9, 0.9, 0.9, 1.0];

        // Get visible column range
        let (min_col, _) = offsets.column_from_x(bounds.left.max(0.0) as f64);
        let (max_col, _) = offsets.column_from_x(bounds.right.max(0.0) as f64);

        // Get visible row range
        let (min_row, _) = offsets.row_from_y(bounds.top.max(0.0) as f64);
        let (max_row, _) = offsets.row_from_y(bounds.bottom.max(0.0) as f64);

        // Draw vertical lines (column boundaries)
        for col in min_col..=max_col + 1 {
            let (x, _) = offsets.column_position_size(col);
            let x = x as f32;
            if x >= bounds.left && x <= bounds.right {
                buffer.add_line(x, bounds.top.max(0.0), x, bounds.bottom, color);
            }
        }

        // Draw horizontal lines (row boundaries)
        for row in min_row..=max_row + 1 {
            let (y, _) = offsets.row_position_size(row);
            let y = y as f32;
            if y >= bounds.top && y <= bounds.bottom {
                buffer.add_line(bounds.left.max(0.0), y, bounds.right, y, color);
            }
        }

        self.buffer = Some(buffer);
        self.dirty = false;
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
