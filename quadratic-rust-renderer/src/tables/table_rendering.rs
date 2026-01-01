//! Table rendering - renders table name backgrounds and column headers.
//!
//! This module handles the visual rendering of table headers, including:
//! - Table name row with colored background
//! - Column header row with white background
//! - Text labels for table name and column names

use quadratic_core_shared::SheetOffsets;

use crate::renderers::{Color, Rects};
use crate::sheets::text::{BitmapFonts, LabelMesh, TextAnchor, TextLabel};
use crate::viewport::Viewport;

use super::table_render_data::TableBounds;
use super::TableCache;

/// Default font size for table headers (before DPR scaling).
const TABLE_HEADER_FONT_SIZE: f32 = 14.0;

/// Padding for table name text.
const TABLE_NAME_PADDING: f32 = 4.0;

/// Primary color for active tables (matches CSS --primary: 221.2 83.2% 53.3%).
/// RGB(36, 99, 235) = #2463eb
const PRIMARY_COLOR: Color = [0.141, 0.388, 0.922, 1.0];

/// Muted foreground color for inactive tables (matches CSS --muted-foreground: 215.4 16.3% 46.9%).
/// RGB(100, 112, 136) = #647088
const MUTED_FOREGROUND: Color = [0.392, 0.439, 0.533, 1.0];

/// White background color for column headers.
const WHITE: Color = [1.0, 1.0, 1.0, 1.0];

/// White text color (for table name on colored background).
const WHITE_TEXT: Color = [1.0, 1.0, 1.0, 1.0];

/// Foreground text color for column headers (matches CSS --foreground: 222.2 84% 4.9%).
/// Nearly black: RGB(2, 8, 23)
const FOREGROUND_TEXT: Color = [0.008, 0.031, 0.090, 1.0];

/// Render all visible tables from the cache.
///
/// Returns rectangles for backgrounds and text meshes for labels.
pub struct TableRenderOutput {
    /// Table name background rectangles (colored, one per table with show_name).
    pub name_backgrounds: Rects,

    /// Column header background rectangles (white, one per table with show_columns).
    pub column_backgrounds: Rects,

    /// Table outline rectangles (around entire table).
    pub outlines: Rects,

    /// Horizontal line at the bottom of column headers.
    pub column_header_lines: Rects,

    /// Text labels for table names.
    pub name_labels: Vec<TextLabel>,

    /// Text labels for column headers.
    pub column_labels: Vec<TextLabel>,
}

impl TableRenderOutput {
    pub fn new() -> Self {
        Self {
            name_backgrounds: Rects::new(),
            column_backgrounds: Rects::new(),
            outlines: Rects::new(),
            column_header_lines: Rects::new(),
            name_labels: Vec::new(),
            column_labels: Vec::new(),
        }
    }
}

impl Default for TableRenderOutput {
    fn default() -> Self {
        Self::new()
    }
}

/// Render all visible tables from the cache.
pub fn render_tables(
    cache: &TableCache,
    viewport: &Viewport,
    _offsets: &SheetOffsets,
    heading_width: f32,
    heading_height: f32,
    dpr: f32,
) -> TableRenderOutput {
    let mut output = TableRenderOutput::new();

    let bounds = viewport.visible_bounds();
    let scale = viewport.scale();

    log::trace!(
        "[render_tables] Viewport bounds: left={:.1}, top={:.1}, right={:.1}, bottom={:.1}",
        bounds.left, bounds.top, bounds.right, bounds.bottom
    );

    // Get visible tables
    let visible_tables: Vec<_> = cache.get_visible_tables(bounds.left, bounds.top, bounds.right, bounds.bottom).collect();

    log::debug!(
        "[render_tables] Found {} visible tables out of {} total",
        visible_tables.len(),
        cache.len()
    );

    for table in visible_tables {
        let is_active = table.is_active();
        let code_cell = &table.code_cell;

        // Render table name background
        if let Some(name_bounds) = &table.name_bounds {
            let color = if is_active {
                PRIMARY_COLOR
            } else {
                MUTED_FOREGROUND
            };

            add_background_rect(
                &mut output.name_backgrounds,
                name_bounds,
                color,
                viewport,
                heading_width,
                heading_height,
                scale,
            );

            // Add table name text label
            let label = create_table_name_label(
                &code_cell.name,
                name_bounds,
                viewport,
                heading_width,
                heading_height,
                scale,
                dpr,
            );
            output.name_labels.push(label);
        }

        // Render column headers background
        if let Some(headers_bounds) = &table.column_headers_bounds {
            add_background_rect(
                &mut output.column_backgrounds,
                headers_bounds,
                WHITE,
                viewport,
                heading_width,
                heading_height,
                scale,
            );

            // Add column header text labels
            for (i, col_bounds) in table.column_bounds.iter().enumerate() {
                if let Some(column) = code_cell.columns.iter().filter(|c| c.display).nth(i) {
                    let label = create_column_header_label(
                        &column.name,
                        col_bounds,
                        viewport,
                        heading_width,
                        heading_height,
                        scale,
                        dpr,
                    );
                    output.column_labels.push(label);
                }
            }

            // Add horizontal line at the bottom of column headers
            // In TypeScript, this line is drawn at columnsHeight with alignment=1 (below the path)
            // So the line covers [columnsHeight, columnsHeight + 1] in world coordinates
            let line_color = if is_active {
                PRIMARY_COLOR
            } else {
                MUTED_FOREGROUND
            };
            // Draw at the exact bottom of headers, extending 1 pixel down (matches TS behavior)
            output.column_header_lines.add(
                headers_bounds.left(),
                headers_bounds.bottom() - 1.0, // Position at bottom - 1 so line is within headers
                headers_bounds.width,
                1.0, // 1 pixel height
                line_color,
            );
        }

        // Render table outline (always drawn, color depends on active state)
        let outline_color = if is_active {
            PRIMARY_COLOR
        } else {
            MUTED_FOREGROUND
        };
        add_outline_rect(
            &mut output.outlines,
            &table.table_bounds,
            outline_color,
            viewport,
            heading_width,
            heading_height,
            scale,
        );
    }

    output
}

/// Add a background rectangle in world space.
/// The matrix transformation handles conversion to screen coordinates.
fn add_background_rect(
    rects: &mut Rects,
    bounds: &TableBounds,
    color: Color,
    _viewport: &Viewport,
    _heading_width: f32,
    _heading_height: f32,
    _scale: f32,
) {
    // Use world coordinates - the matrix handles transformation
    rects.add(bounds.left(), bounds.top(), bounds.width, bounds.height, color);
}

/// Add an outline rectangle in world space.
/// The matrix transformation handles conversion to screen coordinates.
/// Draws a 1-pixel border around the rectangle (matching TypeScript TableOutline).
fn add_outline_rect(
    rects: &mut Rects,
    bounds: &TableBounds,
    color: Color,
    _viewport: &Viewport,
    _heading_width: f32,
    _heading_height: f32,
    _scale: f32,
) {
    let line_width = 1.0; // 1 pixel border (matches TypeScript)

    let x = bounds.left();
    let y = bounds.top();
    let w = bounds.width;
    let h = bounds.height;

    // Top border
    rects.add(x, y, w, line_width, color);
    // Bottom border
    rects.add(x, y + h - line_width, w, line_width, color);
    // Left border
    rects.add(x, y, line_width, h, color);
    // Right border
    rects.add(x + w - line_width, y, line_width, h, color);
}

/// Create a text label for the table name.
/// Uses world coordinates - matrix handles transformation.
fn create_table_name_label(
    name: &str,
    bounds: &TableBounds,
    _viewport: &Viewport,
    _heading_width: f32,
    _heading_height: f32,
    _scale: f32,
    _dpr: f32,
) -> TextLabel {
    // Use world coordinates with small padding
    let world_x = bounds.left() + TABLE_NAME_PADDING;
    let world_y = bounds.top() + bounds.height / 2.0;

    TextLabel::new(name.to_string(), world_x, world_y)
        .with_font_size(TABLE_HEADER_FONT_SIZE)
        .with_anchor(TextAnchor::CenterLeft)
        .with_color(WHITE_TEXT)
        .with_bold(true)
}

/// Create a text label for a column header.
/// Uses world coordinates - matrix handles transformation.
fn create_column_header_label(
    name: &str,
    bounds: &TableBounds,
    _viewport: &Viewport,
    _heading_width: f32,
    _heading_height: f32,
    _scale: f32,
    _dpr: f32,
) -> TextLabel {
    // Use world coordinates with small padding
    let world_x = bounds.left() + TABLE_NAME_PADDING;
    let world_y = bounds.top() + bounds.height / 2.0;

    TextLabel::new(name.to_string(), world_x, world_y)
        .with_font_size(TABLE_HEADER_FONT_SIZE)
        .with_anchor(TextAnchor::CenterLeft)
        .with_color(FOREGROUND_TEXT)
        .with_bold(true)
}

/// Build text meshes from labels.
pub fn build_table_meshes(
    name_labels: &mut [TextLabel],
    column_labels: &mut [TextLabel],
    fonts: &BitmapFonts,
) -> Vec<LabelMesh> {
    let mut all_meshes: Vec<LabelMesh> = Vec::new();

    // Layout and get meshes from name labels
    for label in name_labels.iter_mut() {
        label.layout(fonts);
        for mesh in label.get_meshes(fonts) {
            all_meshes.push(mesh.clone());
        }
    }

    // Layout and get meshes from column labels
    for label in column_labels.iter_mut() {
        label.layout(fonts);
        for mesh in label.get_meshes(fonts) {
            all_meshes.push(mesh.clone());
        }
    }

    all_meshes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_render_output_new() {
        let output = TableRenderOutput::new();
        assert!(output.name_labels.is_empty());
        assert!(output.column_labels.is_empty());
    }
}
