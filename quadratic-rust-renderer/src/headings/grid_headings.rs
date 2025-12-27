//! Grid Headings - Column and Row headers for the spreadsheet
//!
//! Renders column headers (A, B, C...) at the top and row headers (1, 2, 3...) on the left.
//!
//! This module is designed to render headings in screen space (outside the viewport transform)
//! to avoid complex coordinate math. The headings stay fixed at the edges of the canvas.

use quadratic_core_shared::SheetOffsets;

use crate::RenderContext;
use crate::primitives::{NativeLines, Rects};
use crate::text::{BitmapFonts, LabelMesh};

use super::column_headings::ColumnHeadings;
use super::row_headings::RowHeadings;
use super::types::{CELL_HEIGHT, HeadingColors, HeadingSize, ViewportState};

/// Grid headings renderer
#[derive(Debug, Default)]
pub struct GridHeadings {
    /// Heading colors
    pub colors: HeadingColors,

    /// Device pixel ratio (for font scaling)
    dpr: f32,

    /// Debug mode: draw red rectangles around expected label positions
    pub debug_label_bounds: bool,

    /// Character size for label width calculations (approximate, scaled by DPR)
    char_width: f32,
    char_height: f32,

    /// Computed heading sizes
    heading_size: HeadingSize,

    /// Column headings
    columns: ColumnHeadings,

    /// Row headings
    rows: RowHeadings,

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
            debug_label_bounds: false,
            char_width: 6.67,
            char_height: 8.1,
            heading_size: HeadingSize::default(),
            columns: ColumnHeadings::new(),
            rows: RowHeadings::new(),
            dirty: true,
            updated_this_frame: false,
            last_viewport_x: f32::NAN,
            last_viewport_y: f32::NAN,
            last_scale: f32::NAN,
            last_canvas_width: 0.0,
            last_canvas_height: 0.0,
        }
    }

    /// Set the device pixel ratio (triggers re-layout)
    pub fn set_dpr(&mut self, dpr: f32) {
        if (self.dpr - dpr).abs() > 0.001 {
            self.dpr = dpr;
            self.char_width = 6.67;
            self.char_height = 8.1;
            self.dirty = true;
        }
    }

    /// Get the current DPR
    pub fn dpr(&self) -> f32 {
        self.dpr
    }

    /// Set selected columns (pairs of start/end indices, 1-indexed)
    pub fn set_selected_columns(&mut self, selections: Vec<(i64, i64)>) {
        if self.columns.set_selected(selections) {
            self.dirty = true;
        }
    }

    /// Set selected rows (pairs of start/end indices, 1-indexed)
    pub fn set_selected_rows(&mut self, selections: Vec<(i64, i64)>) {
        if self.rows.set_selected(selections) {
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

    /// Get the header height in device pixels (scaled by DPR)
    fn header_height(&self) -> f32 {
        CELL_HEIGHT * self.dpr
    }

    /// Create a ViewportState from the current state
    fn create_viewport_state(
        &self,
        viewport_x: f32,
        viewport_y: f32,
        scale: f32,
        canvas_width: f32,
        canvas_height: f32,
    ) -> ViewportState {
        ViewportState {
            viewport_x,
            viewport_y,
            scale,
            canvas_width,
            canvas_height,
            dpr: self.dpr,
            char_width: self.char_width,
            char_height: self.char_height,
        }
    }

    /// Update headings based on viewport state and sheet offsets
    ///
    /// # Arguments
    /// * `viewport_x` - World X position of viewport (left edge)
    /// * `viewport_y` - World Y position of viewport (top edge)
    /// * `scale` - Viewport scale (zoom level)
    /// * `canvas_width` - Canvas width in pixels
    /// * `canvas_height` - Canvas height in pixels
    /// * `offsets` - Sheet offsets for column widths and row heights
    pub fn update(
        &mut self,
        viewport_x: f32,
        viewport_y: f32,
        scale: f32,
        canvas_width: f32,
        canvas_height: f32,
        offsets: &SheetOffsets,
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

        // Mark that we're doing work this frame
        self.updated_this_frame = true;

        self.last_viewport_x = viewport_x;
        self.last_viewport_y = viewport_y;
        self.last_scale = scale;
        self.last_canvas_width = canvas_width;
        self.last_canvas_height = canvas_height;
        self.dirty = false;

        let header_height = self.header_height();
        let col_height = header_height / scale;

        // First pass: estimate row width using previous value or a reasonable default
        let estimated_row_width = if self.heading_size.width > 0.0 {
            self.heading_size.width
        } else {
            // Create temporary viewport state for width calculation
            let temp_viewport = self.create_viewport_state(
                viewport_x,
                viewport_y,
                scale,
                canvas_width,
                canvas_height,
            );
            RowHeadings::calculate_width(99, scale, &temp_viewport) * scale
        };

        // Create a temporary heading size for calculating the last row
        let temp_heading_size = HeadingSize {
            width: estimated_row_width,
            height: header_height,
            unscaled_width: estimated_row_width / scale,
            unscaled_height: col_height,
        };

        // Create viewport state
        let viewport_state =
            self.create_viewport_state(viewport_x, viewport_y, scale, canvas_width, canvas_height);

        // Calculate actual row header width based on max visible row
        let last_row = RowHeadings::calculate_last_row(&viewport_state, &temp_heading_size, offsets);
        let row_width = RowHeadings::calculate_width(last_row, scale, &viewport_state);

        // Update heading size
        self.heading_size = HeadingSize {
            width: row_width * scale,
            height: header_height,
            unscaled_width: row_width,
            unscaled_height: col_height,
        };

        // Update column and row headings with offsets
        self.columns
            .update(&viewport_state, &self.heading_size, &self.colors, offsets);
        self.rows
            .update(&viewport_state, &self.heading_size, &self.colors, offsets);
    }

    /// Layout all labels (call after update, before get_meshes)
    pub fn layout(&mut self, fonts: &BitmapFonts) {
        self.columns.layout(fonts);
        self.rows.layout(fonts);
    }

    /// Get background rectangles for rendering
    /// Returns: (column_header_rect, row_header_rect, corner_rect)
    /// Each rect is [x, y, width, height] in screen pixels
    pub fn get_background_rects(&self) -> ([f32; 4], [f32; 4], [f32; 4]) {
        let row_width = self.heading_size.width;
        let col_height = self.heading_size.height;

        // Column header background (top bar, excluding corner)
        let col_rect = [
            row_width,
            0.0,
            self.last_canvas_width - row_width,
            col_height,
        ];

        // Row header background (left bar, excluding corner)
        let row_rect = [
            0.0,
            col_height,
            row_width,
            self.last_canvas_height - col_height,
        ];

        // Corner (top-left intersection)
        let corner_rect = [0.0, 0.0, row_width, col_height];

        (col_rect, row_rect, corner_rect)
    }

    /// Get selection highlight rectangles
    /// Returns list of [x, y, width, height] rects in screen pixels
    pub fn get_selection_rects(&self, offsets: &SheetOffsets) -> Vec<[f32; 4]> {
        let viewport = self.create_viewport_state(
            self.last_viewport_x,
            self.last_viewport_y,
            self.last_scale,
            self.last_canvas_width,
            self.last_canvas_height,
        );

        let mut rects = self
            .columns
            .get_selection_rects(&viewport, &self.heading_size, offsets);
        rects.extend(self.rows.get_selection_rects(&viewport, &self.heading_size, offsets));
        rects
    }

    /// Get grid line vertices for heading separators
    /// Returns vertices in format [x1, y1, x2, y2, ...] in screen pixels
    pub fn get_grid_lines(&self, offsets: &SheetOffsets) -> Vec<f32> {
        let viewport = self.create_viewport_state(
            self.last_viewport_x,
            self.last_viewport_y,
            self.last_scale,
            self.last_canvas_width,
            self.last_canvas_height,
        );

        let row_width = self.heading_size.width;
        let col_height = self.heading_size.height;

        let mut lines = Vec::new();

        // Vertical line at right edge of row header
        lines.extend_from_slice(&[row_width, 0.0, row_width, self.last_canvas_height]);

        // Horizontal line at bottom edge of column header
        lines.extend_from_slice(&[0.0, col_height, self.last_canvas_width, col_height]);

        // Column and row separators
        lines.extend(self.columns.get_grid_lines(&viewport, &self.heading_size, offsets));
        lines.extend(self.rows.get_grid_lines(&viewport, &self.heading_size, offsets));

        lines
    }

    /// Get debug rectangles for label positions (for debugging alignment)
    pub fn get_debug_label_rects(&self) -> (Vec<[f32; 4]>, Vec<[f32; 4]>) {
        let (mut anchor_points, mut text_bounds) = self.rows.get_debug_label_rects();
        let (col_anchors, col_bounds) = self.columns.get_debug_label_rects();
        anchor_points.extend(col_anchors);
        text_bounds.extend(col_bounds);
        (anchor_points, text_bounds)
    }

    /// Build meshes for all heading labels
    pub fn get_meshes(&self, fonts: &BitmapFonts) -> Vec<LabelMesh> {
        let mut all_meshes = self.columns.get_meshes(fonts);

        // Merge row meshes into column meshes
        for (texture_uid, mesh) in self.rows.get_meshes(fonts) {
            if let Some(existing) = all_meshes.get_mut(&texture_uid) {
                let offset = (existing.vertices.len() / 4) as u16;
                existing.vertices.extend(mesh.vertices.iter().cloned());
                for idx in &mesh.indices {
                    existing.indices.push(idx + offset * 4);
                }
            } else {
                all_meshes.insert(texture_uid, mesh);
            }
        }

        all_meshes.into_values().collect()
    }

    /// Render headings directly to WebGL
    ///
    /// Renders in order: backgrounds, lines, text (for proper z-ordering)
    pub fn render(
        &self,
        ctx: &mut impl RenderContext,
        matrix: &[f32; 16],
        fonts: &BitmapFonts,
        font_scale: f32,
        distance_range: f32,
        offsets: &SheetOffsets,
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
        for rect in self.get_selection_rects(offsets) {
            rects.add(rect[0], rect[1], rect[2], rect[3], selection_color);
        }

        // Debug: draw rectangles to visualize label positioning
        if self.debug_label_bounds {
            let (anchor_points, text_bounds) = self.get_debug_label_rects();

            let anchor_color = [1.0, 0.0, 0.0, 1.0];
            for rect in anchor_points {
                rects.add(rect[0], rect[1], rect[2], rect[3], anchor_color);
            }

            let bounds_color = [0.0, 0.0, 1.0, 0.3];
            for rect in text_bounds {
                rects.add(rect[0], rect[1], rect[2], rect[3], bounds_color);
            }
        }

        rects.render(ctx, matrix);

        // 2. Render grid lines
        let grid_line_coords = self.get_grid_lines(offsets);
        let mut lines = NativeLines::with_capacity(grid_line_coords.len() / 4);

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

        lines.render(ctx, matrix);

        // 3. Render text
        let meshes = self.get_meshes(fonts);
        for mesh in meshes {
            if mesh.is_empty() {
                continue;
            }
            let vertices = mesh.get_vertex_data();
            let indices: Vec<u32> = mesh.get_index_data().iter().map(|&i| i as u32).collect();
            ctx.draw_text(
                &vertices,
                &indices,
                mesh.texture_uid,
                matrix,
                1.0,
                font_scale,
                distance_range,
            );
        }
    }
}
