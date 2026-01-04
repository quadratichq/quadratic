//! Table header rendering
//!
//! Renders table name backgrounds, column header backgrounds, and their text labels.

use crate::sheets::text::{BitmapFonts, LabelMesh};
use crate::sheets::Sheet;
use crate::tables::{build_table_meshes, render_tables};
use crate::viewport::Viewport;
use quadratic_core_shared::SheetOffsets;

/// Get pre-built vertices for table rendering.
///
/// Uses caching to avoid regenerating vertices every frame.
/// Only regenerates when:
/// - Tables have changed (tables.is_dirty())
/// - Cache has been invalidated (cached_table_output.valid == false)
///
/// Returns:
/// - Name background triangle vertices
/// - Column background triangle vertices
/// - Outline rectangle triangle vertices
/// - Column header bottom line vertices
/// - Text meshes for table names and column headers
pub fn get_table_vertices_for_webgpu(
    sheet: &mut Sheet,
    viewport: &Viewport,
    offsets: &SheetOffsets,
    fonts: &BitmapFonts,
    _heading_width: f32,
    _heading_height: f32,
    dpr: f32,
) -> (Vec<f32>, Vec<f32>, Vec<f32>, Vec<f32>, Vec<LabelMesh>) {
    // Skip if no tables
    if sheet.tables.is_empty() {
        return (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
    }

    // Get current viewport bounds for visibility filtering
    let bounds = viewport.visible_bounds();
    let current_bounds = (bounds.left, bounds.top, bounds.right, bounds.bottom);

    // Check if we can use the cache
    // Cache is valid when:
    // 1. Cache is marked as valid
    // 2. Tables haven't changed (not dirty)
    // 3. Viewport hasn't expanded beyond cached bounds (which could reveal new tables)
    let cached_bounds = sheet.cached_table_output.viewport_bounds;
    let viewport_expanded = current_bounds.0 < cached_bounds.0  // left expanded
        || current_bounds.1 < cached_bounds.1  // top expanded
        || current_bounds.2 > cached_bounds.2  // right expanded
        || current_bounds.3 > cached_bounds.3; // bottom expanded

    if sheet.cached_table_output.valid && !sheet.tables.is_dirty() && !viewport_expanded {
        // Return cloned cached data
        return (
            sheet.cached_table_output.name_bg_vertices.clone(),
            sheet.cached_table_output.col_bg_vertices.clone(),
            sheet.cached_table_output.outline_vertices.clone(),
            sheet.cached_table_output.header_line_vertices.clone(),
            sheet.cached_table_output.text_meshes.clone(),
        );
    }

    // Render table backgrounds and collect labels (uses world coordinates)
    let mut output = render_tables(
        &sheet.tables,
        viewport,
        offsets,
        0.0, // Not used - world coordinates
        0.0, // Not used - world coordinates
        dpr,
    );

    // Get background vertices (in world coordinates)
    let name_bg_vertices = output.name_backgrounds.vertices().to_vec();
    let column_bg_vertices = output.column_backgrounds.vertices().to_vec();
    // Get native line vertices for outlines and header lines (1px lines)
    let outline_vertices = output.outlines.vertices().to_vec();
    let header_line_vertices = output.column_header_lines.vertices().to_vec();

    // Build text meshes
    let meshes = build_table_meshes(
        &mut output.name_labels,
        &mut output.column_labels,
        fonts,
    );

    // Cache the output
    sheet.cached_table_output.name_bg_vertices = name_bg_vertices.clone();
    sheet.cached_table_output.col_bg_vertices = column_bg_vertices.clone();
    sheet.cached_table_output.outline_vertices = outline_vertices.clone();
    sheet.cached_table_output.header_line_vertices = header_line_vertices.clone();
    sheet.cached_table_output.text_meshes = meshes.clone();
    sheet.cached_table_output.viewport_bounds = current_bounds;
    sheet.cached_table_output.valid = true;

    // Mark table cache as clean since we just processed it
    sheet.tables.mark_clean();

    (name_bg_vertices, column_bg_vertices, outline_vertices, header_line_vertices, meshes)
}
