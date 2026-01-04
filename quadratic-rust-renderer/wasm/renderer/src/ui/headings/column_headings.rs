//! Column headings - renders column headers (A, B, C...) at the top of the grid

use std::collections::HashMap;

use quadratic_core_shared::SheetOffsets;

use crate::sheets::text::{BitmapFonts, LabelMesh, TextAnchor, TextLabel, column_name};

use super::types::{
    HeadingColors, HeadingSize, LABEL_DIGITS_TO_CALCULATE_SKIP, LABEL_MAXIMUM_WIDTH_PERCENT,
    LABEL_PADDING_ROWS, ViewportState,
};

/// Column headings renderer
#[derive(Debug, Default)]
pub struct ColumnHeadings {
    /// Cached column labels
    labels: Vec<TextLabel>,

    /// Selected columns (start, end pairs, 1-indexed)
    selected: Vec<(i64, i64)>,

    /// Column skip interval (0 = show all, 2 = every other, etc.)
    col_mod: i64,
}

impl ColumnHeadings {
    /// Create new column headings
    pub fn new() -> Self {
        Self {
            labels: Vec::new(),
            selected: Vec::new(),
            col_mod: 0,
        }
    }

    /// Set selected columns (pairs of start/end indices, 1-indexed)
    pub fn set_selected(&mut self, selections: Vec<(i64, i64)>) -> bool {
        if self.selected != selections {
            self.selected = selections;
            true
        } else {
            false
        }
    }

    /// Check if a column is selected
    fn is_selected(&self, col: i64) -> bool {
        self.selected
            .iter()
            .any(|(start, end)| col >= *start && col <= *end)
    }

    /// Find interval for column label skipping when zoomed out
    fn find_interval(skip_count: i64) -> i64 {
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

    /// Update column labels based on viewport state and sheet offsets
    pub fn update(
        &mut self,
        viewport: &ViewportState,
        heading_size: &HeadingSize,
        colors: &HeadingColors,
        offsets: &SheetOffsets,
    ) {
        self.labels.clear();

        let scale = viewport.scale;
        let header_height = viewport.header_height();

        // Get the starting column from the viewport position using offsets
        let (first_col, first_col_pos) = offsets.column_from_x(viewport.viewport_x.max(0.0) as f64);
        let first_col = first_col.max(1); // 1-indexed for A1 notation

        // Calculate visible world bounds
        let content_width = viewport.canvas_width - heading_size.width;
        let world_width = content_width / scale;
        let right_edge = viewport.viewport_x + world_width;

        // Calculate label skip interval for zoomed out views
        let label_width = LABEL_DIGITS_TO_CALCULATE_SKIP as f32 * viewport.char_width;
        let default_cell_width = offsets.column_width(1) as f32;
        let cell_width_screen = default_cell_width * scale;

        self.col_mod = if label_width > cell_width_screen * LABEL_MAXIMUM_WIDTH_PERCENT {
            let cell_width_world = default_cell_width / scale;
            let skip_numbers = (cell_width_world * (1.0 - LABEL_MAXIMUM_WIDTH_PERCENT)
                / label_width)
                .ceil() as i64;
            Self::find_interval(skip_numbers)
        } else {
            0
        };

        // Track last label to prevent overlapping
        let mut last_label: Option<(f32, f32, bool)> = None; // (left, right, selected)

        // Iterate through visible columns using offsets
        let mut col = first_col;
        let mut world_x = first_col_pos as f32;

        while world_x <= right_edge {
            let col_width = offsets.column_width(col) as f32;

            // Check if we should skip this label based on modulus
            let selected = self.is_selected(col);
            let show_label = selected
                || self.col_mod == 0
                || (self.col_mod == 2 && col % 2 == 1)
                || (self.col_mod != 2 && col % self.col_mod == 0)
                || col == first_col;

            if show_label && col > 0 {
                // Calculate screen position (center of column)
                let col_center_x = world_x + col_width / 2.0;
                let screen_x = (col_center_x - viewport.viewport_x) * scale + heading_size.width;
                let screen_y = header_height / 2.25;

                // Only add if inside visible area
                if screen_x >= heading_size.width && screen_x <= viewport.canvas_width {
                    let text = column_name(col);
                    let char_count = text.len() as f32;

                    // For overlap detection
                    let label_width = char_count * viewport.char_width;
                    let padding = LABEL_PADDING_ROWS;
                    let half_width = label_width / 2.0 + padding;
                    let left = screen_x - half_width;
                    let right = screen_x + half_width;

                    // Check for intersection with last label
                    let mut intersects_last = false;
                    if let Some((last_left, last_right, last_selected)) = last_label {
                        intersects_last = left < last_right && right > last_left;

                        if intersects_last && selected && !last_selected {
                            self.labels.pop();
                            intersects_last = false;
                        }
                    }

                    // Only add label if not intersecting with last
                    if !intersects_last {
                        let label = TextLabel::new(text, screen_x, screen_y)
                            .with_font_size(viewport.font_size())
                            .with_anchor(TextAnchor::Center)
                            .with_color(colors.label);

                        self.labels.push(label);
                        last_label = Some((left, right, selected));
                    }
                }
            }

            world_x += col_width;
            col += 1;
        }
    }

    /// Layout all labels
    pub fn layout(&mut self, fonts: &BitmapFonts) {
        for label in &mut self.labels {
            label.layout(fonts);
        }
    }

    /// Get selection highlight rectangles for columns
    pub fn get_selection_rects(
        &self,
        viewport: &ViewportState,
        heading_size: &HeadingSize,
        offsets: &SheetOffsets,
    ) -> Vec<[f32; 4]> {
        let mut rects = Vec::new();
        let scale = viewport.scale;

        for (start, end) in &self.selected {
            let (start_pos, _) = offsets.column_position_size(*start);
            let (end_pos, end_size) = offsets.column_position_size(*end);
            let x1 = start_pos as f32;
            let x2 = (end_pos + end_size) as f32;
            let screen_x1 = (x1 - viewport.viewport_x) * scale + heading_size.width;
            let screen_x2 = (x2 - viewport.viewport_x) * scale + heading_size.width;

            // Clamp to visible area
            let screen_x1 = screen_x1.max(heading_size.width);
            let screen_x2 = screen_x2.min(viewport.canvas_width);

            if screen_x2 > screen_x1 {
                rects.push([screen_x1, 0.0, screen_x2 - screen_x1, heading_size.height]);
            }
        }

        rects
    }

    /// Get grid line vertices for column separators
    pub fn get_grid_lines(
        &self,
        viewport: &ViewportState,
        heading_size: &HeadingSize,
        offsets: &SheetOffsets,
    ) -> Vec<f32> {
        let mut lines = Vec::new();
        let scale = viewport.scale;

        // Get the starting column from the viewport position
        let (first_col, first_col_pos) = offsets.column_from_x(viewport.viewport_x.max(0.0) as f64);
        let first_col = first_col.max(1);

        // Calculate visible world bounds
        let world_width = viewport.canvas_width / scale;
        let right_edge = viewport.viewport_x + world_width;

        let mut col = first_col;
        let mut world_x = first_col_pos as f32;

        while world_x <= right_edge {
            let col_width = offsets.column_width(col) as f32;

            if col > 0 {
                let screen_x = (world_x - viewport.viewport_x) * scale + heading_size.width;
                if screen_x > heading_size.width && screen_x < viewport.canvas_width {
                    lines.extend_from_slice(&[screen_x, 0.0, screen_x, heading_size.height]);
                }
            }

            world_x += col_width;
            col += 1;
        }

        lines
    }

    /// Get debug rectangles for label positions
    pub fn get_debug_label_rects(&self) -> (Vec<[f32; 4]>, Vec<[f32; 4]>) {
        let mut anchor_points = Vec::new();
        let mut text_bounds = Vec::new();

        for label in &self.labels {
            let dot_size = 4.0;
            anchor_points.push([
                label.x - dot_size / 2.0,
                label.y - dot_size / 2.0,
                dot_size,
                dot_size,
            ]);

            let text_width = label.width();
            let text_height = label.height();
            text_bounds.push([
                label.x - text_width / 2.0,
                label.y - text_height / 2.0,
                text_width,
                text_height,
            ]);
        }

        (anchor_points, text_bounds)
    }

    /// Build meshes for column labels
    pub fn get_meshes(&mut self, fonts: &BitmapFonts) -> HashMap<u32, LabelMesh> {
        let mut meshes: HashMap<u32, LabelMesh> = HashMap::new();

        for label in &mut self.labels {
            for mesh in label.get_meshes(fonts) {
                if let Some(existing) = meshes.get_mut(&mesh.texture_uid) {
                    let offset = (existing.vertices.len() / 4) as u32;
                    existing.vertices.extend(mesh.vertices.iter().cloned());
                    for idx in &mesh.indices {
                        existing.indices.push(idx + offset * 4);
                    }
                } else {
                    meshes.insert(mesh.texture_uid, mesh.clone());
                }
            }
        }

        meshes
    }
}
