//! Grid Headings - Column and Row headers for the spreadsheet
//!
//! Renders column headers (A, B, C...) at the top and row headers (1, 2, 3...) on the left.
//!
//! This module is designed to render headings in screen space (outside the viewport transform)
//! to avoid complex coordinate math. The headings stay fixed at the edges of the canvas.

use std::collections::HashMap;

use crate::text::{BitmapFonts, LabelMesh, TextAnchor, TextLabel, column_to_a1, row_to_a1};
use crate::webgl::{Lines, Rects, WebGLContext};

/// Constants matching the TypeScript client
pub const CELL_WIDTH: f32 = 100.0;
pub const CELL_HEIGHT: f32 = 21.0;

/// Maximum percentage of cell width a label can occupy before skipping
const LABEL_MAXIMUM_WIDTH_PERCENT: f32 = 0.9;
const LABEL_MAXIMUM_HEIGHT_PERCENT: f32 = 0.5;

/// Padding for row labels (in CSS pixels)
const LABEL_PADDING_ROWS: f32 = 2.0;

/// Row digit offset (matches TypeScript ROW_DIGIT_OFFSET)
const ROW_DIGIT_OFFSET_X: f32 = 0.0;
const ROW_DIGIT_OFFSET_Y: f32 = -1.0;

/// Number of digits to use when calculating column label skip
const LABEL_DIGITS_TO_CALCULATE_SKIP: usize = 3;

/// Colors for headings
#[derive(Debug, Clone, Copy)]
pub struct HeadingColors {
    /// Background color for headers
    pub background: [f32; 4],
    /// Background color for corner
    pub corner_background: [f32; 4],
    /// Label text color
    pub label: [f32; 4],
    /// Grid line color
    pub grid_line: [f32; 4],
    /// Selected column/row highlight color
    pub selection: [f32; 4],
    /// Selection alpha
    pub selection_alpha: f32,
}

impl Default for HeadingColors {
    fn default() -> Self {
        Self {
            background: [0.96, 0.96, 0.96, 1.0],        // Light gray
            corner_background: [0.94, 0.94, 0.94, 1.0], // Slightly darker
            label: [0.137, 0.192, 0.263, 1.0], // #233143 (matches gridHeadingLabel in colors.ts)
            grid_line: [0.8, 0.8, 0.8, 1.0],   // Grid line gray
            selection: [0.2, 0.4, 0.8, 1.0],   // Blue selection
            selection_alpha: 0.3,
        }
    }
}

/// Computed heading sizes
#[derive(Debug, Clone, Copy, Default)]
pub struct HeadingSize {
    /// Width of row header area (pixels, scaled)
    pub width: f32,
    /// Height of column header area (pixels, scaled)
    pub height: f32,
    /// Unscaled width
    pub unscaled_width: f32,
    /// Unscaled height
    pub unscaled_height: f32,
}

/// Base font size for headings (before DPR scaling)
const BASE_HEADING_FONT_SIZE: f32 = 10.0;

/// Grid headings renderer
pub struct GridHeadings {
    /// Heading colors
    pub colors: HeadingColors,

    /// Device pixel ratio (for font scaling)
    dpr: f32,

    /// Character size for label width calculations (approximate, scaled by DPR)
    char_width: f32,
    char_height: f32,

    /// Computed heading sizes
    heading_size: HeadingSize,

    /// Cached column labels
    column_labels: Vec<TextLabel>,

    /// Cached row labels
    row_labels: Vec<TextLabel>,

    /// Whether labels need rebuild
    dirty: bool,

    /// Whether the last update() call did actual work (for render decision)
    updated_this_frame: bool,

    /// Last viewport state for dirty checking
    last_viewport_x: f32,
    last_viewport_y: f32,
    last_scale: f32,
    last_canvas_width: f32,
    last_canvas_height: f32,

    /// Selected columns (start, end pairs)
    selected_columns: Vec<(i64, i64)>,

    /// Selected rows (start, end pairs)
    selected_rows: Vec<(i64, i64)>,

    /// Column skip interval (0 = show all, 2 = every other, etc.)
    col_mod: i64,

    /// Row skip interval (0 = show all, 2 = every other, etc.)
    row_mod: i64,
}

impl GridHeadings {
    /// Create new grid headings
    pub fn new() -> Self {
        Self::with_dpr(1.0)
    }

    /// Create new grid headings with specific DPR
    pub fn with_dpr(dpr: f32) -> Self {
        Self {
            colors: HeadingColors::default(),
            dpr,
            // Character sizes scaled by DPR (base size at 10px: width ~6.67, height ~8.1)
            char_width: 6.67 * dpr,
            char_height: 8.1 * dpr,
            heading_size: HeadingSize::default(),
            column_labels: Vec::new(),
            row_labels: Vec::new(),
            dirty: true,
            updated_this_frame: false,
            last_viewport_x: f32::NAN,
            last_viewport_y: f32::NAN,
            last_scale: f32::NAN,
            last_canvas_width: 0.0,
            last_canvas_height: 0.0,
            selected_columns: Vec::new(),
            selected_rows: Vec::new(),
            col_mod: 0,
            row_mod: 0,
        }
    }

    /// Set the device pixel ratio (triggers re-layout)
    pub fn set_dpr(&mut self, dpr: f32) {
        if (self.dpr - dpr).abs() > 0.001 {
            self.dpr = dpr;
            self.char_width = 6.67 * dpr;
            self.char_height = 8.1 * dpr;
            self.dirty = true;
        }
    }

    /// Get the current DPR
    pub fn dpr(&self) -> f32 {
        self.dpr
    }

    /// Get the scaled font size for headings
    fn font_size(&self) -> f32 {
        BASE_HEADING_FONT_SIZE * self.dpr
    }

    /// Set selected columns (pairs of start/end indices, 1-indexed)
    pub fn set_selected_columns(&mut self, selections: Vec<(i64, i64)>) {
        if self.selected_columns != selections {
            self.selected_columns = selections;
            self.dirty = true;
        }
    }

    /// Set selected rows (pairs of start/end indices, 1-indexed)
    pub fn set_selected_rows(&mut self, selections: Vec<(i64, i64)>) {
        if self.selected_rows != selections {
            self.selected_rows = selections;
            self.dirty = true;
        }
    }

    /// Check if headings were updated this frame and need re-rendering
    pub fn is_dirty(&self) -> bool {
        self.updated_this_frame
    }

    /// Mark headings as clean after rendering
    pub fn mark_clean(&mut self) {
        self.updated_this_frame = false;
    }

    /// Mark headings as needing rebuild
    pub fn set_dirty(&mut self) {
        self.dirty = true;
    }

    /// Get the current heading size
    pub fn heading_size(&self) -> HeadingSize {
        self.heading_size
    }

    /// Calculate row header width based on visible row numbers
    /// Returns width in screen pixels (already scaled by DPR)
    fn calculate_row_width(&self, max_row: i64, scale: f32) -> f32 {
        let digit_count = row_to_a1(max_row).len();
        // char_width is already scaled by DPR, LABEL_PADDING_ROWS needs DPR scaling
        let padding = LABEL_PADDING_ROWS * self.dpr;
        let width = (digit_count as f32 * self.char_width) / scale + (padding / scale) * 2.0;
        // Minimum width is the header height (which is CELL_HEIGHT * dpr)
        width.max(self.header_height() / scale)
    }

    /// Get the header height in screen pixels (scaled by DPR)
    fn header_height(&self) -> f32 {
        CELL_HEIGHT * self.dpr
    }

    /// Find interval for column label skipping when zoomed out
    fn find_column_interval(&self, skip_count: i64) -> i64 {
        if skip_count > 100 {
            return 52;
        }
        if skip_count > 20 {
            return 26;
        }
        if skip_count > 10 {
            return 13;
        }
        if skip_count > 5 {
            return 6;
        }
        2
    }

    /// Find interval for row label skipping when zoomed out
    fn find_row_interval(&self, skip_count: i64) -> i64 {
        if skip_count > 250 {
            return 250;
        }
        if skip_count > 100 {
            return 100;
        }
        if skip_count > 50 {
            return 50;
        }
        if skip_count > 25 {
            return 25;
        }
        if skip_count > 10 {
            return 10;
        }
        if skip_count > 3 {
            return 5;
        }
        if skip_count > 2 {
            return 2;
        }
        1
    }

    /// Check if a column is selected
    fn is_column_selected(&self, col: i64) -> bool {
        self.selected_columns
            .iter()
            .any(|(start, end)| col >= *start && col <= *end)
    }

    /// Check if a row is selected
    fn is_row_selected(&self, row: i64) -> bool {
        self.selected_rows
            .iter()
            .any(|(start, end)| row >= *start && row <= *end)
    }

    /// Update headings based on viewport state
    ///
    /// # Arguments
    /// * `viewport_x` - World X position of viewport (left edge)
    /// * `viewport_y` - World Y position of viewport (top edge)
    /// * `scale` - Viewport scale (zoom level)
    /// * `canvas_width` - Canvas width in pixels
    /// * `canvas_height` - Canvas height in pixels
    pub fn update(
        &mut self,
        viewport_x: f32,
        viewport_y: f32,
        scale: f32,
        canvas_width: f32,
        canvas_height: f32,
    ) {
        // Check if we need to rebuild
        let viewport_changed = (self.last_viewport_x - viewport_x).abs() > 0.1
            || (self.last_viewport_y - viewport_y).abs() > 0.1
            || (self.last_scale - scale).abs() > 0.001
            || (self.last_canvas_width - canvas_width).abs() > 0.1
            || (self.last_canvas_height - canvas_height).abs() > 0.1;

        if !self.dirty && !viewport_changed {
            self.updated_this_frame = false;
            return;
        }

        // Mark that we're doing work this frame (for render decision)
        self.updated_this_frame = true;

        self.last_viewport_x = viewport_x;
        self.last_viewport_y = viewport_y;
        self.last_scale = scale;
        self.last_canvas_width = canvas_width;
        self.last_canvas_height = canvas_height;
        self.dirty = false;

        // Clear existing labels
        self.column_labels.clear();
        self.row_labels.clear();

        // Column header height is fixed
        let header_height = self.header_height();
        let col_height = header_height / scale;

        // Calculate visible world bounds, accounting for heading space
        // Content area is canvas minus headings - we need to iterate since
        // row_width depends on visible rows which depends on row_width

        // First pass: estimate row width using previous value or a reasonable default
        let estimated_row_width = if self.heading_size.width > 0.0 {
            self.heading_size.width
        } else {
            // Default: assume 2-digit row numbers
            self.calculate_row_width(99, scale) * scale
        };

        // Calculate content area (in physical pixels)
        let content_width = canvas_width - estimated_row_width;
        let content_height = canvas_height - header_height;

        // Convert to world space (divide by scale only - world units match content rendering)
        let world_width = content_width / scale;
        let world_height = content_height / scale;

        // Calculate visible column/row range (1-indexed for A1 notation)
        let first_col = ((viewport_x / CELL_WIDTH).floor() as i64).max(0) + 1;
        let last_col = (((viewport_x + world_width) / CELL_WIDTH).ceil() as i64).max(0) + 1;
        let first_row = ((viewport_y / CELL_HEIGHT).floor() as i64).max(0) + 1;
        let last_row = (((viewport_y + world_height) / CELL_HEIGHT).ceil() as i64).max(0) + 1;

        // Calculate actual row header width based on max visible row
        let row_width = self.calculate_row_width(last_row, scale);

        // Update heading size (all values in screen pixels, scaled by DPR)
        self.heading_size = HeadingSize {
            width: row_width * scale,
            height: header_height,
            unscaled_width: row_width,
            unscaled_height: col_height,
        };

        // Calculate label skip intervals for zoomed out views
        // Label sizes are DPR-scaled (char_width, char_height), but label POSITIONS
        // are spaced CELL_WIDTH/HEIGHT * scale apart (matching content grid)
        // So we compare DPR-scaled label size to non-DPR cell spacing
        let label_width = LABEL_DIGITS_TO_CALCULATE_SKIP as f32 * self.char_width;
        let cell_width_screen = CELL_WIDTH * scale;
        self.col_mod = if label_width > cell_width_screen * LABEL_MAXIMUM_WIDTH_PERCENT {
            // Calculate how many cells one label spans
            let skip_numbers = (label_width / cell_width_screen).ceil() as i64;
            self.find_column_interval(skip_numbers)
        } else {
            0
        };

        let cell_height_screen = CELL_HEIGHT * scale;
        self.row_mod = if self.char_height > cell_height_screen * LABEL_MAXIMUM_HEIGHT_PERCENT {
            // Calculate how many cells one label spans
            let skip_numbers = (self.char_height / cell_height_screen).ceil() as i64;
            self.find_row_interval(skip_numbers)
        } else {
            0
        };

        // Generate column labels
        // Labels are positioned in SCREEN SPACE (pixels from top-left of canvas)
        // The caller is responsible for rendering with an identity matrix

        // Track last label to prevent overlapping
        let mut last_col_label: Option<(f32, f32, bool)> = None; // (left, right, selected)

        for col in first_col..=last_col {
            // Check if we should skip this label based on modulus
            let selected = self.is_column_selected(col);
            let show_label = selected
                || self.col_mod == 0
                || (self.col_mod == 2 && col % 2 == 1)
                || (self.col_mod != 2 && col % self.col_mod == 0)
                || col == first_col;

            if !show_label {
                continue;
            }

            // Calculate screen position
            // Column position in world space, then convert to screen space
            let world_x = (col - 1) as f32 * CELL_WIDTH + CELL_WIDTH / 2.0;
            // Transform to screen space (consistent with content grid rendering)
            let screen_x = (world_x - viewport_x) * scale + self.heading_size.width;
            // Use 2.25 divisor to match TypeScript (slightly above center for visual balance)
            let screen_y = header_height / 2.25;

            // Skip if outside visible area (accounting for row header width)
            if screen_x < self.heading_size.width || screen_x > canvas_width {
                continue;
            }

            let text = column_to_a1(col);
            let char_count = text.len() as f32;

            // The col_mod calculation already handles spacing when labels don't fit
            // We just need overlap detection for fine-tuning

            // For overlap detection, use physical pixel values
            let label_width = char_count * self.char_width;

            // Calculate label bounds for overlap detection
            let half_width = label_width / 2.0;
            let left = screen_x - half_width;
            let right = screen_x + half_width;

            // Check for intersection with last label
            let mut intersects_last = false;
            if let Some((last_left, last_right, last_selected)) = last_col_label {
                intersects_last = left < last_right && right > last_left;

                // If intersecting and current is selected but adjacent cells indicate
                // this is an edge of a selection, remove the last label instead
                if intersects_last && selected && !last_selected {
                    // Remove the last label (it overlaps with a selected one)
                    self.column_labels.pop();
                    intersects_last = false;
                }
            }

            // Only add label if not intersecting with last
            if !intersects_last && col > 0 {
                let label = TextLabel::new(text, screen_x, screen_y)
                    .with_font_size(self.font_size())
                    .with_anchor(TextAnchor::Center)
                    .with_color(self.colors.label);

                self.column_labels.push(label);
                last_col_label = Some((left, right, selected));
            }
        }

        // Generate row labels
        // Track last label to prevent overlapping
        let mut last_row_label: Option<(f32, f32, bool)> = None; // (top, bottom, selected)

        // The row_mod calculation already determines spacing when labels don't fit
        // We just need to check overlap with the previous label for fine-tuning

        for row in first_row..=last_row {
            // Check if we should skip this label based on modulus
            // The mod calculation handles spacing when labels are too dense
            let selected = self.is_row_selected(row);
            let show_label = selected
                || self.row_mod == 0
                || (self.row_mod == 2 && row % 2 == 1)
                || (self.row_mod != 2 && row % self.row_mod == 0)
                || row == first_row;

            if !show_label {
                continue;
            }

            // Calculate screen position
            let world_y = (row - 1) as f32 * CELL_HEIGHT + CELL_HEIGHT / 2.0;
            // Center horizontally in row header, add offset
            let screen_x = self.heading_size.width / 2.0 + ROW_DIGIT_OFFSET_X * self.dpr;
            // Y position in screen space (consistent with content grid rendering), add offset
            let screen_y =
                (world_y - viewport_y) * scale + header_height + ROW_DIGIT_OFFSET_Y * self.dpr;

            // Skip if outside visible area (accounting for column header height)
            if screen_y < header_height || screen_y > canvas_height {
                continue;
            }

            let text = row_to_a1(row);

            // For overlap detection, use physical pixel values
            let label_height = self.char_height;
            let half_height = label_height / 2.0;
            let top = screen_y - half_height;
            let bottom = screen_y + half_height;

            // Check for intersection with last label
            let mut intersects_last = false;
            if let Some((last_top, last_bottom, last_selected)) = last_row_label {
                intersects_last = top < last_bottom && bottom > last_top;

                // If intersecting and current is selected but last was not,
                // remove the last label instead
                if intersects_last && selected && !last_selected {
                    // Remove the last label (it overlaps with a selected one)
                    self.row_labels.pop();
                    intersects_last = false;
                }
            }

            // Only add label if not intersecting with last
            if !intersects_last && row > 0 {
                let label = TextLabel::new(text, screen_x, screen_y)
                    .with_font_size(self.font_size())
                    .with_anchor(TextAnchor::Center)
                    .with_color(self.colors.label);

                self.row_labels.push(label);
                last_row_label = Some((top, bottom, selected));
            }
        }
    }

    /// Layout all labels (call after update, before get_meshes)
    pub fn layout(&mut self, fonts: &BitmapFonts) {
        for label in &mut self.column_labels {
            label.layout(fonts);
        }
        for label in &mut self.row_labels {
            label.layout(fonts);
        }
    }

    /// Get background rectangles for rendering
    /// Returns: (column_header_rect, row_header_rect, corner_rect)
    /// Each rect is [x, y, width, height] in screen pixels
    pub fn get_background_rects(&self) -> ([f32; 4], [f32; 4], [f32; 4]) {
        let row_width = self.heading_size.width;
        let col_height = self.heading_size.height;

        // Column header background (top bar, excluding corner)
        let col_rect = [
            row_width,                          // x: starts after row header
            0.0,                                // y: top of canvas
            self.last_canvas_width - row_width, // width: rest of canvas
            col_height,                         // height: header height
        ];

        // Row header background (left bar, excluding corner)
        let row_rect = [
            0.0,                                  // x: left of canvas
            col_height,                           // y: starts below column header
            row_width,                            // width: row header width
            self.last_canvas_height - col_height, // height: rest of canvas
        ];

        // Corner (top-left intersection)
        let corner_rect = [
            0.0,        // x
            0.0,        // y
            row_width,  // width
            col_height, // height
        ];

        (col_rect, row_rect, corner_rect)
    }

    /// Get selection highlight rectangles
    /// Returns list of [x, y, width, height] rects in screen pixels
    pub fn get_selection_rects(&self) -> Vec<[f32; 4]> {
        let mut rects = Vec::new();
        let scale = self.last_scale;
        let row_width = self.heading_size.width;
        let col_height = self.heading_size.height;

        // Column selection highlights
        for (start, end) in &self.selected_columns {
            let x1 = (*start - 1) as f32 * CELL_WIDTH;
            let x2 = *end as f32 * CELL_WIDTH;
            let screen_x1 = (x1 - self.last_viewport_x) * scale + row_width;
            let screen_x2 = (x2 - self.last_viewport_x) * scale + row_width;

            // Clamp to visible area
            let screen_x1 = screen_x1.max(row_width);
            let screen_x2 = screen_x2.min(self.last_canvas_width);

            if screen_x2 > screen_x1 {
                rects.push([screen_x1, 0.0, screen_x2 - screen_x1, col_height]);
            }
        }

        // Row selection highlights
        for (start, end) in &self.selected_rows {
            let y1 = (*start - 1) as f32 * CELL_HEIGHT;
            let y2 = *end as f32 * CELL_HEIGHT;
            let screen_y1 = (y1 - self.last_viewport_y) * scale + col_height;
            let screen_y2 = (y2 - self.last_viewport_y) * scale + col_height;

            // Clamp to visible area
            let screen_y1 = screen_y1.max(col_height);
            let screen_y2 = screen_y2.min(self.last_canvas_height);

            if screen_y2 > screen_y1 {
                rects.push([0.0, screen_y1, row_width, screen_y2 - screen_y1]);
            }
        }

        rects
    }

    /// Get grid line vertices for heading separators
    /// Returns vertices in format [x1, y1, x2, y2, ...] in screen pixels
    pub fn get_grid_lines(&self) -> Vec<f32> {
        let mut lines = Vec::new();
        let scale = self.last_scale;
        let row_width = self.heading_size.width;
        let col_height = self.heading_size.height;

        // Vertical line at right edge of row header
        lines.extend_from_slice(&[row_width, 0.0, row_width, self.last_canvas_height]);

        // Horizontal line at bottom edge of column header
        lines.extend_from_slice(&[0.0, col_height, self.last_canvas_width, col_height]);

        // Column separators in column header
        // Use same skip logic as labels to avoid lines through text
        let world_width = self.last_canvas_width / scale;
        let first_col = ((self.last_viewport_x / CELL_WIDTH).floor() as i64).max(0) + 1;
        let last_col =
            (((self.last_viewport_x + world_width) / CELL_WIDTH).ceil() as i64).max(0) + 1;

        for col in first_col..=last_col {
            // Skip grid lines at same intervals as labels when zoomed out
            let show_line = self.col_mod == 0
                || (self.col_mod == 2 && col % 2 == 1)
                || (self.col_mod != 2 && col % self.col_mod == 0)
                || col == first_col;

            if !show_line {
                continue;
            }

            let world_x = (col - 1) as f32 * CELL_WIDTH;
            let screen_x = (world_x - self.last_viewport_x) * scale + row_width;
            if screen_x > row_width && screen_x < self.last_canvas_width {
                lines.extend_from_slice(&[screen_x, 0.0, screen_x, col_height]);
            }
        }

        // Row separators in row header
        // Use same skip logic as labels to avoid lines through text
        let world_height = self.last_canvas_height / scale;
        let first_row = ((self.last_viewport_y / CELL_HEIGHT).floor() as i64).max(0) + 1;
        let last_row =
            (((self.last_viewport_y + world_height) / CELL_HEIGHT).ceil() as i64).max(0) + 1;

        for row in first_row..=last_row {
            // Skip grid lines at same intervals as labels when zoomed out
            let show_line = self.row_mod == 0
                || (self.row_mod == 2 && row % 2 == 1)
                || (self.row_mod != 2 && row % self.row_mod == 0)
                || row == first_row;

            if !show_line {
                continue;
            }

            let world_y = (row - 1) as f32 * CELL_HEIGHT;
            let screen_y = (world_y - self.last_viewport_y) * scale + col_height;
            if screen_y > col_height && screen_y < self.last_canvas_height {
                lines.extend_from_slice(&[0.0, screen_y, row_width, screen_y]);
            }
        }

        lines
    }

    /// Build meshes for all heading labels
    pub fn get_meshes(&self, fonts: &BitmapFonts) -> Vec<LabelMesh> {
        let mut all_meshes: HashMap<u32, LabelMesh> = HashMap::new();

        // Collect meshes from column labels
        for label in &self.column_labels {
            for mesh in label.build_mesh(fonts) {
                if let Some(existing) = all_meshes.get_mut(&mesh.texture_uid) {
                    // Merge vertices and indices
                    let offset = (existing.vertices.len() / 4) as u16; // 4 vertices per glyph
                    existing.vertices.extend(mesh.vertices.iter().cloned());
                    for idx in &mesh.indices {
                        existing.indices.push(idx + offset * 4);
                    }
                } else {
                    all_meshes.insert(mesh.texture_uid, mesh);
                }
            }
        }

        // Collect meshes from row labels
        for label in &self.row_labels {
            for mesh in label.build_mesh(fonts) {
                if let Some(existing) = all_meshes.get_mut(&mesh.texture_uid) {
                    let offset = (existing.vertices.len() / 4) as u16;
                    existing.vertices.extend(mesh.vertices.iter().cloned());
                    for idx in &mesh.indices {
                        existing.indices.push(idx + offset * 4);
                    }
                } else {
                    all_meshes.insert(mesh.texture_uid, mesh);
                }
            }
        }

        all_meshes.into_values().collect()
    }

    /// Render headings directly to WebGL
    ///
    /// Renders in order: backgrounds, lines, text (for proper z-ordering)
    pub fn render(
        &self,
        gl: &WebGLContext,
        matrix: &[f32; 16],
        fonts: &BitmapFonts,
        font_scale: f32,
        distance_range: f32,
    ) {
        // 1. Render backgrounds
        let mut rects = Rects::with_capacity(8);
        let (col_rect, row_rect, corner_rect) = self.get_background_rects();

        rects.add(
            col_rect[0],
            col_rect[1],
            col_rect[2],
            col_rect[3],
            self.colors.background,
        );
        rects.add(
            row_rect[0],
            row_rect[1],
            row_rect[2],
            row_rect[3],
            self.colors.background,
        );
        rects.add(
            corner_rect[0],
            corner_rect[1],
            corner_rect[2],
            corner_rect[3],
            self.colors.corner_background,
        );

        // Selection highlights
        let selection_color = [
            self.colors.selection[0],
            self.colors.selection[1],
            self.colors.selection[2],
            self.colors.selection_alpha,
        ];
        for rect in self.get_selection_rects() {
            rects.add(rect[0], rect[1], rect[2], rect[3], selection_color);
        }

        rects.render(gl, matrix);

        // 2. Render grid lines
        let grid_line_coords = self.get_grid_lines();
        let mut lines = Lines::with_capacity(grid_line_coords.len() / 4);

        for chunk in grid_line_coords.chunks(4) {
            if chunk.len() == 4 {
                lines.add(
                    chunk[0],
                    chunk[1],
                    chunk[2],
                    chunk[3],
                    self.colors.grid_line,
                );
            }
        }

        lines.render(gl, matrix);

        // 3. Render text
        let meshes = self.get_meshes(fonts);
        for mesh in meshes {
            if mesh.is_empty() {
                continue;
            }
            let vertices = mesh.get_vertex_data();
            let indices: Vec<u32> = mesh.get_index_data().iter().map(|&i| i as u32).collect();
            gl.draw_text(
                &vertices,
                &indices,
                mesh.texture_uid,
                matrix,
                1.0, // viewport_scale is 1.0 for screen-space headings
                font_scale,
                distance_range,
            );
        }
    }
}

impl Default for GridHeadings {
    fn default() -> Self {
        Self::new()
    }
}
