//! Grid lines renderer
//!
//! Grid lines fade out and disappear at low zoom levels to avoid
//! rendering thousands of tiny lines.

use quadratic_core_shared::SheetOffsets;

use crate::RenderContext;
use crate::primitives::NativeLines;
use crate::viewport::{Viewport, VisibleBounds};

/// Default column width in pixels (used as fallback)
pub const DEFAULT_COLUMN_WIDTH: f32 = 100.0;

/// Default row height in pixels (used as fallback)
pub const DEFAULT_ROW_HEIGHT: f32 = 21.0;

/// Grid line base color (dark blue-gray, matches client's 0x233143)
/// RGB: (35, 49, 67) normalized
pub const GRID_LINE_COLOR: [f32; 3] = [0.137, 0.192, 0.263];

/// Scale threshold below which grid lines are completely hidden
const SCALE_HIDE_THRESHOLD: f32 = 0.1;

/// Scale threshold above which grid lines are fully visible
const SCALE_FULL_THRESHOLD: f32 = 0.6;

/// Calculate the alpha for grid lines based on zoom scale.
/// Matches the client's calculateAlphaForGridLines function.
///
/// - scale < 0.1: alpha = 0 (hidden)
/// - scale 0.1 to 0.6: fade in
/// - scale >= 0.6: alpha = 1 (fully visible)
pub fn calculate_grid_alpha(scale: f32) -> f32 {
    if scale < SCALE_HIDE_THRESHOLD {
        0.0
    } else if scale < SCALE_FULL_THRESHOLD {
        scale * 2.0 - 0.2
    } else {
        1.0
    }
}

/// Grid lines renderer
///
/// Uses NativeLines primitive for efficient 1px line rendering.
pub struct GridLines {
    /// Batched native lines for rendering (always 1px)
    lines: NativeLines,

    /// Whether the grid lines need to be recalculated
    pub dirty: bool,

    /// Grid line color with current alpha
    color: [f32; 4],

    /// Whether grid lines are visible (false when zoomed out too far)
    pub visible: bool,
}

impl GridLines {
    /// Create a new grid lines renderer
    pub fn new() -> Self {
        Self {
            lines: NativeLines::new(),
            dirty: true,
            color: [
                GRID_LINE_COLOR[0],
                GRID_LINE_COLOR[1],
                GRID_LINE_COLOR[2],
                1.0,
            ],
            visible: true,
        }
    }

    /// Update grid lines based on the visible viewport and sheet offsets
    /// Only regenerates lines if viewport has changed
    pub fn update(&mut self, viewport: &Viewport, offsets: &SheetOffsets) {
        // Only update if viewport changed
        if !viewport.dirty {
            self.dirty = false;
            return;
        }

        self.dirty = true;

        let scale = viewport.scale();
        let alpha = calculate_grid_alpha(scale);

        // Update visibility and color alpha
        self.visible = alpha > 0.0;
        self.color[3] = alpha * 0.2; // Base alpha is 0.2, like client

        // Clear existing geometry but keep capacity for reuse
        self.lines.clear();

        if !self.visible {
            return;
        }

        let bounds = viewport.visible_bounds();

        // Only generate lines if we're in the valid grid area
        if bounds.right <= 0.0 || bounds.bottom <= 0.0 {
            return;
        }

        // Clamp line endpoints to valid grid area (x >= 0, y >= 0)
        let line_top = bounds.top.max(0.0);
        let line_left = bounds.left.max(0.0);

        // Draw horizontal lines and get the row range
        let row_range = self.draw_horizontal_lines(&bounds, offsets, line_left);

        // Draw vertical lines
        self.draw_vertical_lines(&bounds, offsets, line_top, row_range);
    }

    /// Draw horizontal grid lines (row separators)
    /// Returns the range of visible rows [first_row, last_row]
    fn draw_horizontal_lines(
        &mut self,
        bounds: &VisibleBounds,
        offsets: &SheetOffsets,
        left: f32,
    ) -> (i64, i64) {
        // Get the starting row from the top of the viewport
        let (first_row, first_row_pos) = offsets.row_from_y(bounds.top.max(0.0) as f64);

        // Draw the 0-line if it's visible
        if bounds.top <= 0.0 {
            self.lines.add(left, 0.0, bounds.right, 0.0, self.color);
        }

        let mut row = first_row;
        let mut y = first_row_pos as f32;

        // Iterate through visible rows
        while y <= bounds.bottom {
            let row_height = offsets.row_height(row) as f32;

            // Draw line at the bottom of the current row (top of next row)
            let line_y = y + row_height;
            if line_y >= bounds.top && line_y <= bounds.bottom {
                self.lines
                    .add(left, line_y, bounds.right, line_y, self.color);
            }

            y += row_height;
            row += 1;
        }

        (first_row, row - 1)
    }

    /// Draw vertical grid lines (column separators)
    fn draw_vertical_lines(
        &mut self,
        bounds: &VisibleBounds,
        offsets: &SheetOffsets,
        top: f32,
        _row_range: (i64, i64),
    ) {
        // Get the starting column from the left of the viewport
        let (first_col, first_col_pos) = offsets.column_from_x(bounds.left.max(0.0) as f64);

        // Draw the 0-line if it's visible
        if bounds.left <= 0.0 {
            self.lines.add(0.0, top, 0.0, bounds.bottom, self.color);
        }

        let mut col = first_col;
        let mut x = first_col_pos as f32;

        // Iterate through visible columns
        while x <= bounds.right {
            let col_width = offsets.column_width(col) as f32;

            // Draw line at the right of the current column (left of next column)
            let line_x = x + col_width;
            if line_x >= bounds.left && line_x <= bounds.right {
                self.lines
                    .add(line_x, top, line_x, bounds.bottom, self.color);
            }

            x += col_width;
            col += 1;
        }
    }

    /// Mark as clean after rendering
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }

    /// Get raw vertex data for backend-agnostic rendering
    /// Returns None if grid lines are not visible
    pub fn get_vertices(&mut self) -> Option<&[f32]> {
        if self.visible && !self.lines.is_empty() {
            Some(self.lines.get_vertices())
        } else {
            None
        }
    }

    /// Render grid lines using RenderContext
    pub fn render(&mut self, ctx: &mut impl RenderContext, matrix: &[f32; 16]) {
        if self.visible {
            self.lines.render(ctx, matrix);
        }
    }
}

impl Default for GridLines {
    fn default() -> Self {
        Self::new()
    }
}
