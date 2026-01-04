//! Row headings - renders row headers (1, 2, 3...) on the left of the grid

use std::collections::HashMap;

use quadratic_core_shared::SheetOffsets;

use crate::sheets::text::{BitmapFonts, LabelMesh, TextAnchor, TextLabel, row_to_a1};

use super::types::{
    HeadingColors, HeadingSize, LABEL_MAXIMUM_HEIGHT_PERCENT, LABEL_PADDING_ROWS,
    ViewportState,
};

/// Row headings renderer
#[derive(Debug, Default)]
pub struct RowHeadings {
    /// Cached row labels
    labels: Vec<TextLabel>,

    /// Selected rows (start, end pairs, 1-indexed)
    selected: Vec<(i64, i64)>,

    /// Row skip interval (0 = show all, 2 = every other, etc.)
    row_mod: i64,
}

impl RowHeadings {
    /// Create new row headings
    pub fn new() -> Self {
        Self {
            labels: Vec::new(),
            selected: Vec::new(),
            row_mod: 0,
        }
    }

    /// Set selected rows (pairs of start/end indices, 1-indexed)
    pub fn set_selected(&mut self, selections: Vec<(i64, i64)>) -> bool {
        if self.selected != selections {
            self.selected = selections;
            true
        } else {
            false
        }
    }

    /// Get the current row skip interval
    pub fn row_mod(&self) -> i64 {
        self.row_mod
    }

    /// Check if a row is selected
    fn is_selected(&self, row: i64) -> bool {
        self.selected
            .iter()
            .any(|(start, end)| row >= *start && row <= *end)
    }

    /// Find interval for row label skipping when zoomed out
    /// Thresholds are set to leave comfortable vertical space between labels
    fn find_interval(skip_count: i64) -> i64 {
        if skip_count > 125 {
            return 250;
        }
        if skip_count > 50 {
            return 100;
        }
        if skip_count > 25 {
            return 50;
        }
        if skip_count > 12 {
            return 25;
        }
        if skip_count > 5 {
            return 10;
        }
        if skip_count > 2 {
            return 5;
        }
        if skip_count > 1 {
            return 2;
        }
        1
    }

    /// Calculate row header width based on visible row numbers
    /// Returns width in screen pixels
    pub fn calculate_width(max_row: i64, scale: f32, viewport: &ViewportState) -> f32 {
        let digit_count = row_to_a1(max_row).len();
        let padding = LABEL_PADDING_ROWS;
        let width = (digit_count as f32 * viewport.char_width) / scale + (padding / scale) * 2.0;
        // Minimum width is the header height
        width.max(viewport.header_height() / scale)
    }

    /// Calculate the last visible row for width calculation
    pub fn calculate_last_row(
        viewport: &ViewportState,
        heading_size: &HeadingSize,
        offsets: &SheetOffsets,
    ) -> i64 {
        let content_height = viewport.canvas_height - heading_size.height;
        let world_height = content_height / viewport.scale;
        let bottom_y = viewport.viewport_y + world_height;
        let (last_row, _) = offsets.row_from_y(bottom_y.max(0.0) as f64);
        last_row.max(1)
    }

    /// Update row labels based on viewport state and sheet offsets
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

        // Get the starting row from the viewport position using offsets
        let (first_row, first_row_pos) = offsets.row_from_y(viewport.viewport_y.max(0.0) as f64);
        let first_row = first_row.max(1); // 1-indexed for A1 notation

        // Calculate visible world bounds
        let content_height = viewport.canvas_height - header_height;
        let world_height = content_height / scale;
        let bottom_edge = viewport.viewport_y + world_height;

        // Calculate label skip interval for zoomed out views
        let default_cell_height = offsets.row_height(1) as f32;
        let cell_height_screen = default_cell_height * scale;

        self.row_mod = if viewport.char_height > cell_height_screen * LABEL_MAXIMUM_HEIGHT_PERCENT {
            let cell_height_world = default_cell_height / scale;
            let skip_numbers = (cell_height_world * (1.0 - LABEL_MAXIMUM_HEIGHT_PERCENT)
                / viewport.char_height)
                .ceil() as i64;
            Self::find_interval(skip_numbers)
        } else {
            0
        };

        // Track last label to prevent overlapping
        let mut last_label: Option<(f32, f32, bool)> = None; // (top, bottom, selected)

        // Iterate through visible rows using offsets
        let mut row = first_row;
        let mut world_y = first_row_pos as f32;

        while world_y <= bottom_edge {
            let row_height = offsets.row_height(row) as f32;

            // Check if we should skip this label based on modulus
            let selected = self.is_selected(row);
            let show_label = selected
                || self.row_mod == 0
                || (self.row_mod == 2 && row % 2 == 1)
                || (self.row_mod != 2 && self.row_mod != 0 && row % self.row_mod == 0);

            if show_label && row > 0 {
                // Calculate screen position (center of row)
                let row_center_y = world_y + row_height / 2.0;
                let screen_x = heading_size.width / 2.0;
                let screen_y = (row_center_y - viewport.viewport_y) * scale + header_height;

                // Only add if inside visible area
                if screen_y >= header_height && screen_y <= viewport.canvas_height {
                    let text = row_to_a1(row);

                    // For overlap detection
                    let label_height = viewport.char_height;
                    let padding = LABEL_PADDING_ROWS;
                    let half_height = label_height / 2.0 + padding;
                    let top = screen_y - half_height;
                    let bottom = screen_y + half_height;

                    // Check for intersection with last label
                    let mut intersects_last = false;
                    if let Some((last_top, last_bottom, last_selected)) = last_label {
                        intersects_last = top < last_bottom && bottom > last_top;

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
                        last_label = Some((top, bottom, selected));
                    }
                }
            }

            world_y += row_height;
            row += 1;
        }
    }

    /// Layout all labels
    pub fn layout(&mut self, fonts: &BitmapFonts) {
        for label in &mut self.labels {
            label.layout(fonts);
        }
    }

    /// Get selection highlight rectangles for rows
    pub fn get_selection_rects(
        &self,
        viewport: &ViewportState,
        heading_size: &HeadingSize,
        offsets: &SheetOffsets,
    ) -> Vec<[f32; 4]> {
        let mut rects = Vec::new();
        let scale = viewport.scale;

        for (start, end) in &self.selected {
            let (start_pos, _) = offsets.row_position_size(*start);
            let (end_pos, end_size) = offsets.row_position_size(*end);
            let y1 = start_pos as f32;
            let y2 = (end_pos + end_size) as f32;
            let screen_y1 = (y1 - viewport.viewport_y) * scale + heading_size.height;
            let screen_y2 = (y2 - viewport.viewport_y) * scale + heading_size.height;

            // Clamp to visible area
            let screen_y1 = screen_y1.max(heading_size.height);
            let screen_y2 = screen_y2.min(viewport.canvas_height);

            if screen_y2 > screen_y1 {
                rects.push([0.0, screen_y1, heading_size.width, screen_y2 - screen_y1]);
            }
        }

        rects
    }

    /// Get grid line vertices for row separators
    pub fn get_grid_lines(
        &self,
        viewport: &ViewportState,
        heading_size: &HeadingSize,
        offsets: &SheetOffsets,
    ) -> Vec<f32> {
        let mut lines = Vec::new();
        let scale = viewport.scale;

        // Get the starting row from the viewport position
        let (first_row, first_row_pos) = offsets.row_from_y(viewport.viewport_y.max(0.0) as f64);
        let first_row = first_row.max(1);

        // Calculate visible world bounds
        let world_height = viewport.canvas_height / scale;
        let bottom_edge = viewport.viewport_y + world_height;

        let mut row = first_row;
        let mut world_y = first_row_pos as f32;

        while world_y <= bottom_edge {
            let row_height = offsets.row_height(row) as f32;

            if row > 0 {
                let screen_y = (world_y - viewport.viewport_y) * scale + heading_size.height;
                if screen_y > heading_size.height && screen_y < viewport.canvas_height {
                    lines.extend_from_slice(&[0.0, screen_y, heading_size.width, screen_y]);
                }
            }

            world_y += row_height;
            row += 1;
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

    /// Build meshes for row labels
    pub fn get_meshes(&mut self, fonts: &BitmapFonts) -> HashMap<u32, LabelMesh> {
        let mut meshes: HashMap<u32, LabelMesh> = HashMap::new();

        for label in &mut self.labels {
            for mesh in label.get_meshes(fonts) {
                if let Some(existing) = meshes.get_mut(&mesh.texture_uid) {
                    let offset = (existing.vertices.len() / 4) as u16;
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
