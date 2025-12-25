//! Grid lines renderer
//!
//! Equivalent to GridLines.ts from the Pixi.js implementation.
//! Grid lines fade out and disappear at low zoom levels to avoid
//! rendering thousands of tiny lines.

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

/// Represents a line segment to be rendered
#[derive(Debug, Clone, Copy)]
pub struct Line {
    pub start_x: f32,
    pub start_y: f32,
    pub end_x: f32,
    pub end_y: f32,
}

/// Grid lines renderer
pub struct GridLines {
    /// Vertical grid lines to render
    pub vertical_lines: Vec<Line>,

    /// Horizontal grid lines to render
    pub horizontal_lines: Vec<Line>,

    /// Whether the grid lines need to be recalculated
    pub dirty: bool,

    /// Grid line color with current alpha
    pub color: [f32; 4],

    /// Whether grid lines are visible (false when zoomed out too far)
    pub visible: bool,

    /// Line width in pixels
    pub line_width: f32,
}

impl GridLines {
    /// Create a new grid lines renderer
    pub fn new() -> Self {
        Self {
            vertical_lines: Vec::new(),
            horizontal_lines: Vec::new(),
            dirty: true,
            color: [GRID_LINE_COLOR[0], GRID_LINE_COLOR[1], GRID_LINE_COLOR[2], 1.0],
            visible: true,
            line_width: 1.0,
        }
    }

    /// Update grid lines based on the visible viewport
    pub fn update(&mut self, viewport: &Viewport) {
        if !viewport.dirty && !self.dirty {
            return;
        }

        let scale = viewport.scale();
        let alpha = calculate_grid_alpha(scale);

        // Update visibility and color alpha
        self.visible = alpha > 0.0;
        self.color[3] = alpha * 0.2; // Base alpha is 0.2, like client

        // Don't generate lines if not visible
        if !self.visible {
            self.vertical_lines.clear();
            self.horizontal_lines.clear();
            self.dirty = false;
            return;
        }

        self.vertical_lines.clear();
        self.horizontal_lines.clear();

        let bounds = viewport.visible_bounds();

        // Calculate visible column range (clamp to >= 0 for valid grid area)
        let first_col = (bounds.left / DEFAULT_COLUMN_WIDTH).floor().max(0.0) as i32;
        let last_col = (bounds.right / DEFAULT_COLUMN_WIDTH).ceil() as i32;

        // Calculate visible row range (clamp to >= 0 for valid grid area)
        let first_row = (bounds.top / DEFAULT_ROW_HEIGHT).floor().max(0.0) as i32;
        let last_row = (bounds.bottom / DEFAULT_ROW_HEIGHT).ceil() as i32;

        // Clamp line endpoints to valid grid area (x >= 0, y >= 0)
        let line_top = bounds.top.max(0.0);
        let line_left = bounds.left.max(0.0);

        // Only generate lines if we're in the valid grid area
        if bounds.right <= 0.0 || bounds.bottom <= 0.0 {
            self.dirty = false;
            return;
        }

        // Generate vertical lines (column separators)
        for col in first_col..=last_col {
            let x = col as f32 * DEFAULT_COLUMN_WIDTH;
            self.vertical_lines.push(Line {
                start_x: x,
                start_y: line_top,
                end_x: x,
                end_y: bounds.bottom,
            });
        }

        // Generate horizontal lines (row separators)
        for row in first_row..=last_row {
            let y = row as f32 * DEFAULT_ROW_HEIGHT;
            self.horizontal_lines.push(Line {
                start_x: line_left,
                start_y: y,
                end_x: bounds.right,
                end_y: y,
            });
        }

        self.dirty = true; // Mark as needing GPU update
    }

    /// Get total number of lines
    pub fn line_count(&self) -> usize {
        self.vertical_lines.len() + self.horizontal_lines.len()
    }

    /// Mark as clean after rendering
    pub fn mark_clean(&mut self) {
        self.dirty = false;
    }
}

impl Default for GridLines {
    fn default() -> Self {
        Self::new()
    }
}
