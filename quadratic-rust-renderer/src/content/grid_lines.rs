//! Grid lines renderer
//!
//! Equivalent to GridLines.ts from the Pixi.js implementation.
//! Grid lines fade out and disappear at low zoom levels to avoid
//! rendering thousands of tiny lines.

use crate::RenderContext;
use crate::primitives::NativeLines;
use crate::viewport::Viewport;

/// Default column width in pixels
pub const DEFAULT_COLUMN_WIDTH: f32 = 100.0;

/// Default row height in pixels
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

    /// Update grid lines based on the visible viewport
    /// Only regenerates lines if viewport has changed
    pub fn update(&mut self, viewport: &Viewport) {
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

        // Calculate visible column range (clamp to >= 0 for valid grid area)
        let first_col = (bounds.left / DEFAULT_COLUMN_WIDTH).floor().max(0.0) as i32;
        let last_col = (bounds.right / DEFAULT_COLUMN_WIDTH).ceil() as i32;

        // Calculate visible row range (clamp to >= 0 for valid grid area)
        let first_row = (bounds.top / DEFAULT_ROW_HEIGHT).floor().max(0.0) as i32;
        let last_row = (bounds.bottom / DEFAULT_ROW_HEIGHT).ceil() as i32;

        // Clamp line endpoints to valid grid area (x >= 0, y >= 0)
        let line_top = bounds.top.max(0.0);
        let line_left = bounds.left.max(0.0);

        // Pre-allocate for expected number of lines
        let num_cols = (last_col - first_col + 1) as usize;
        let num_rows = (last_row - first_row + 1) as usize;
        self.lines.reserve(num_cols + num_rows);

        // Generate vertical lines (column separators)
        for col in first_col..=last_col {
            let x = col as f32 * DEFAULT_COLUMN_WIDTH;
            self.lines.add(x, line_top, x, bounds.bottom, self.color);
        }

        // Generate horizontal lines (row separators)
        for row in first_row..=last_row {
            let y = row as f32 * DEFAULT_ROW_HEIGHT;
            self.lines.add(line_left, y, bounds.right, y, self.color);
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
