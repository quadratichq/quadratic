//! Grid lines layout

use quadratic_core_shared::SheetOffsets;
use quadratic_rust_renderer_shared::LineBuffer;

use crate::viewport::Viewport;

/// Grid color
const GRID_COLOR: [f32; 4] = [0.85, 0.85, 0.85, 1.0];

/// Grid lines layout
#[derive(Default)]
pub struct GridLinesLayout {
    pub dirty: bool,
    cached_buffer: Option<LineBuffer>,
}

impl GridLinesLayout {
    pub fn new() -> Self {
        Self {
            dirty: true,
            cached_buffer: None,
        }
    }

    pub fn update(&mut self, viewport: &Viewport, offsets: &SheetOffsets) {
        if !self.dirty {
            return;
        }

        let bounds = viewport.visible_bounds();
        let mut buffer = LineBuffer::new();

        // Get visible column/row range
        let (start_col, _) = offsets.column_from_x(bounds.left.max(0.0) as f64);
        let (end_col, _) = offsets.column_from_x(bounds.right.max(0.0) as f64);
        let (start_row, _) = offsets.row_from_y(bounds.top.max(0.0) as f64);
        let (end_row, _) = offsets.row_from_y(bounds.bottom.max(0.0) as f64);

        // Draw vertical lines (column dividers)
        for col in start_col..=end_col + 1 {
            let (x, _) = offsets.column_position_size(col);
            buffer.add_line(
                x as f32,
                bounds.top.max(0.0),
                x as f32,
                bounds.bottom,
                GRID_COLOR,
            );
        }

        // Draw horizontal lines (row dividers)
        for row in start_row..=end_row + 1 {
            let (y, _) = offsets.row_position_size(row);
            buffer.add_line(
                bounds.left.max(0.0),
                y as f32,
                bounds.right,
                y as f32,
                GRID_COLOR,
            );
        }

        self.cached_buffer = Some(buffer);
        self.dirty = false;
    }

    pub fn get_buffer(&self) -> Option<&LineBuffer> {
        self.cached_buffer.as_ref()
    }

    pub fn take_buffer(&mut self) -> Option<LineBuffer> {
        self.cached_buffer.take()
    }
}
