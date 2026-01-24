//! Matrix and geometry helper methods

use glam::Mat4;

use quadratic_renderer_core::types::FillBuffer;
use quadratic_renderer_core::{GridLines, GRID_LINE_COLOR};

use super::NativeRenderer;
use crate::request::RenderRequest;

impl NativeRenderer {
    /// Create the view-projection matrix
    pub(super) fn create_matrix(&self, viewport_x: f32, viewport_y: f32, scale: f32) -> [f32; 16] {
        let view = Mat4::from_scale_rotation_translation(
            glam::Vec3::new(scale, scale, 1.0),
            glam::Quat::IDENTITY,
            glam::Vec3::new(-viewport_x * scale, -viewport_y * scale, 0.0),
        );

        let projection =
            Mat4::orthographic_rh(0.0, self.width as f32, self.height as f32, 0.0, -1.0, 1.0);

        (projection * view).to_cols_array()
    }

    /// Create background fill for the selection area
    pub(super) fn create_background(&self, request: &RenderRequest) -> FillBuffer {
        let mut buffer = FillBuffer::new();
        let (x, y, w, h) = request.selection.world_bounds(&request.offsets);
        buffer.add_rect(x, y, w, h, request.background());
        buffer
    }

    /// Create fill rectangles from request
    pub(super) fn create_fills(&self, request: &RenderRequest) -> FillBuffer {
        let mut buffer = FillBuffer::new();
        buffer.reserve(request.fills.len());

        for fill in &request.fills {
            // Get screen rectangle from cell coordinates
            let (x, _) = request.offsets.column_position_size(fill.x);
            let (y, _) = request.offsets.row_position_size(fill.y);

            // Calculate width and height by getting the end position
            let (x_end, w_end) = request
                .offsets
                .column_position_size(fill.x + fill.w as i64 - 1);
            let (y_end, h_end) = request
                .offsets
                .row_position_size(fill.y + fill.h as i64 - 1);

            let width = (x_end + w_end - x) as f32;
            let height = (y_end + h_end - y) as f32;

            buffer.add_rect(x as f32, y as f32, width, height, fill.color.to_f32_array());
        }

        buffer
    }

    /// Create grid lines for visible area
    ///
    /// Uses core's GridLines::generate_for_bounds() and adds selection-edge handling
    /// to ensure boundary lines are visible at viewport edges.
    pub(super) fn create_grid_lines(
        &self,
        request: &RenderRequest,
        viewport_x: f32,
        viewport_y: f32,
        scale: f32,
    ) -> quadratic_renderer_core::types::LineBuffer {
        // Calculate visible bounds from viewport
        let visible_width = self.width as f32 / scale;
        let visible_height = self.height as f32 / scale;
        let left = viewport_x;
        let top = viewport_y;
        let right = left + visible_width;
        let bottom = top + visible_height;

        // Generate base grid lines from core
        let mut buffer = GridLines::generate_for_bounds(left, top, right, bottom, &request.offsets);

        // Selection boundary handling for screenshots:
        // When the selection edge is at the viewport edge, we need to offset by 0.5px
        // so the line is fully visible (not half-clipped)
        let (sel_left, _) = request
            .offsets
            .column_position_size(request.selection.start_col);
        let sel_left = sel_left as f32;

        let (sel_top, _) = request
            .offsets
            .row_position_size(request.selection.start_row);
        let sel_top = sel_top as f32;

        // Add offset lines at selection boundaries if they're at viewport edges
        if (sel_left - left).abs() < 0.01 && sel_left >= left && sel_left <= right {
            buffer.add_line(
                sel_left + 0.5,
                top.max(0.0),
                sel_left + 0.5,
                bottom,
                GRID_LINE_COLOR,
            );
        }
        if (sel_top - top).abs() < 0.01 && sel_top >= top && sel_top <= bottom {
            buffer.add_line(
                left.max(0.0),
                sel_top + 0.5,
                right,
                sel_top + 0.5,
                GRID_LINE_COLOR,
            );
        }

        buffer
    }
}
