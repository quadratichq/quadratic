//! Matrix and geometry helper methods

use glam::Mat4;
use std::cmp::Ordering;

use quadratic_renderer_core::types::FillBuffer;
use quadratic_renderer_core::GRID_LINE_COLOR;

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
    /// Also excludes grid lines that fall within exclusion zones (e.g., chart areas).
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

        // Generate base grid lines, filtering out those inside exclusion zones
        let mut buffer = self.generate_grid_lines_with_exclusions(
            left,
            top,
            right,
            bottom,
            &request.offsets,
            &request.grid_exclusion_zones,
        );

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

    /// Generate grid lines while excluding lines that fall inside exclusion zones
    fn generate_grid_lines_with_exclusions(
        &self,
        left: f32,
        top: f32,
        right: f32,
        bottom: f32,
        offsets: &quadratic_core::sheet_offsets::SheetOffsets,
        exclusion_zones: &[crate::request::GridExclusionZone],
    ) -> quadratic_renderer_core::types::LineBuffer {
        use quadratic_renderer_core::types::LineBuffer;

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
                // Add line segments, skipping portions inside exclusion zones
                self.add_vertical_line_with_exclusions(
                    &mut buffer,
                    x,
                    top.max(0.0),
                    bottom,
                    exclusion_zones,
                );
            }
        }

        // Draw horizontal lines (row boundaries)
        for row in min_row..=max_row + 1 {
            let (y, _) = offsets.row_position_size(row);
            let y = y as f32;
            if y >= top && y <= bottom {
                // Add line segments, skipping portions inside exclusion zones
                self.add_horizontal_line_with_exclusions(
                    &mut buffer,
                    left.max(0.0),
                    right,
                    y,
                    exclusion_zones,
                );
            }
        }

        buffer
    }

    /// Add a vertical line, breaking it into segments to skip exclusion zones
    fn add_vertical_line_with_exclusions(
        &self,
        buffer: &mut quadratic_renderer_core::types::LineBuffer,
        x: f32,
        y_start: f32,
        y_end: f32,
        exclusion_zones: &[crate::request::GridExclusionZone],
    ) {
        // Collect all exclusion zone intersections for this vertical line
        let mut gaps: Vec<(f32, f32)> = Vec::new();

        for zone in exclusion_zones {
            // Check if x is strictly inside the zone (not on the boundary)
            if x > zone.left && x < zone.right {
                // This vertical line passes through the zone
                let gap_top = zone.top.max(y_start);
                let gap_bottom = zone.bottom.min(y_end);
                if gap_top < gap_bottom {
                    gaps.push((gap_top, gap_bottom));
                }
            }
        }

        if gaps.is_empty() {
            // No exclusions, draw the full line
            buffer.add_line(x, y_start, x, y_end, GRID_LINE_COLOR);
        } else {
            // Sort gaps by start position and merge overlapping gaps
            gaps.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(Ordering::Equal));
            let merged_gaps = Self::merge_overlapping_ranges(&gaps);

            // Draw line segments between gaps
            let mut current_y = y_start;
            for (gap_start, gap_end) in merged_gaps {
                if current_y < gap_start {
                    buffer.add_line(x, current_y, x, gap_start, GRID_LINE_COLOR);
                }
                current_y = gap_end;
            }
            // Draw final segment after last gap
            if current_y < y_end {
                buffer.add_line(x, current_y, x, y_end, GRID_LINE_COLOR);
            }
        }
    }

    /// Add a horizontal line, breaking it into segments to skip exclusion zones
    fn add_horizontal_line_with_exclusions(
        &self,
        buffer: &mut quadratic_renderer_core::types::LineBuffer,
        x_start: f32,
        x_end: f32,
        y: f32,
        exclusion_zones: &[crate::request::GridExclusionZone],
    ) {
        // Collect all exclusion zone intersections for this horizontal line
        let mut gaps: Vec<(f32, f32)> = Vec::new();

        for zone in exclusion_zones {
            // Check if y is strictly inside the zone (not on the boundary)
            if y > zone.top && y < zone.bottom {
                // This horizontal line passes through the zone
                let gap_left = zone.left.max(x_start);
                let gap_right = zone.right.min(x_end);
                if gap_left < gap_right {
                    gaps.push((gap_left, gap_right));
                }
            }
        }

        if gaps.is_empty() {
            // No exclusions, draw the full line
            buffer.add_line(x_start, y, x_end, y, GRID_LINE_COLOR);
        } else {
            // Sort gaps by start position and merge overlapping gaps
            gaps.sort_by(|a, b| a.0.total_cmp(&b.0));
            let merged_gaps = Self::merge_overlapping_ranges(&gaps);

            // Draw line segments between gaps
            let mut current_x = x_start;
            for (gap_start, gap_end) in merged_gaps {
                if current_x < gap_start {
                    buffer.add_line(current_x, y, gap_start, y, GRID_LINE_COLOR);
                }
                current_x = gap_end;
            }
            // Draw final segment after last gap
            if current_x < x_end {
                buffer.add_line(current_x, y, x_end, y, GRID_LINE_COLOR);
            }
        }
    }

    /// Merge overlapping ranges into non-overlapping ranges
    fn merge_overlapping_ranges(ranges: &[(f32, f32)]) -> Vec<(f32, f32)> {
        if ranges.is_empty() {
            return Vec::new();
        }

        let mut merged = Vec::new();
        let mut current = ranges[0];

        for &(start, end) in &ranges[1..] {
            if start <= current.1 {
                // Overlapping, extend current range
                current.1 = current.1.max(end);
            } else {
                // Non-overlapping, push current and start new
                merged.push(current);
                current = (start, end);
            }
        }
        merged.push(current);

        merged
    }
}
