//! Table header rendering
//!
//! Renders table name backgrounds, column header backgrounds, and their text labels.

use crate::renderers::render_context::RenderContext;
use crate::sheets::text::BitmapFonts;
use crate::sheets::Sheet;
use crate::tables::{build_table_meshes, render_tables, TableRenderOutput};
use crate::viewport::Viewport;
use quadratic_core_shared::SheetOffsets;

/// Render table headers using any RenderContext (WebGL or WebGPU)
///
/// Renders:
/// - Table name backgrounds (colored rectangles)
/// - Column header backgrounds (white rectangles)
/// - Table outlines (for active tables)
/// - Table name text labels
/// - Column header text labels
#[allow(clippy::too_many_arguments)]
pub fn render_table_headers<R: RenderContext>(
    ctx: &mut R,
    sheet: &mut Sheet,
    viewport: &Viewport,
    offsets: &SheetOffsets,
    fonts: &BitmapFonts,
    matrix: &[f32; 16],
    viewport_scale: f32,
    atlas_font_size: f32,
    distance_range: f32,
    heading_width: f32,
    heading_height: f32,
    dpr: f32,
) {
    // Skip if no tables
    if sheet.tables.is_empty() {
        log::trace!("[render_table_headers] No tables in cache, skipping");
        return;
    }

    log::debug!("[render_table_headers] Rendering {} tables", sheet.tables.len());

    // Render table backgrounds and collect labels
    let mut output = render_tables(
        &sheet.tables,
        viewport,
        offsets,
        heading_width,
        heading_height,
        dpr,
    );

    log::debug!(
        "[render_table_headers] Output: {} name bgs, {} col bgs, {} outlines, {} header lines, {} name labels, {} col labels",
        output.name_backgrounds.len(),
        output.column_backgrounds.len(),
        output.outlines.len(),
        output.column_header_lines.len(),
        output.name_labels.len(),
        output.column_labels.len()
    );

    // 1. Render table name backgrounds (colored)
    if !output.name_backgrounds.is_empty() {
        output.name_backgrounds.render(ctx, matrix);
    }

    // 2. Render column header backgrounds (white)
    if !output.column_backgrounds.is_empty() {
        output.column_backgrounds.render(ctx, matrix);
    }

    // 3. Render table outlines (around entire table) - uses native lines for 1px borders
    if !output.outlines.is_empty() {
        output.outlines.render(ctx, matrix);
    }

    // 4. Render column header bottom lines - uses native lines for 1px lines
    if !output.column_header_lines.is_empty() {
        output.column_header_lines.render(ctx, matrix);
    }

    // 5. Render table text labels (name and column headers)
    let meshes = build_table_meshes(
        &mut output.name_labels,
        &mut output.column_labels,
        fonts,
    );

    for mesh in meshes {
        if mesh.is_empty() {
            continue;
        }

        // Calculate font scale for MSDF rendering
        let font_scale = mesh.font_size / atlas_font_size;

        // Convert u16 indices to u32
        let indices_u32: Vec<u32> = mesh.get_index_data().iter().map(|&i| i as u32).collect();

        // Draw the text using the RenderContext trait method
        ctx.draw_text(
            &mesh.get_vertex_data(),
            &indices_u32,
            mesh.texture_uid,
            matrix,
            viewport_scale,
            font_scale,
            distance_range,
        );
    }
}

/// Get table rendering data for WebGPU
///
/// Returns the table render output for later rendering.
#[allow(dead_code)]
pub fn get_table_render_output(
    sheet: &Sheet,
    viewport: &Viewport,
    offsets: &SheetOffsets,
    heading_width: f32,
    heading_height: f32,
    dpr: f32,
) -> TableRenderOutput {
    render_tables(
        &sheet.tables,
        viewport,
        offsets,
        heading_width,
        heading_height,
        dpr,
    )
}

/// Get pre-built vertices for table rendering in WebGPU.
///
/// Returns:
/// - Name background triangle vertices
/// - Column background triangle vertices
/// - Outline rectangle triangle vertices
/// - Column header bottom line vertices
/// - Text meshes for table names and column headers
#[allow(dead_code)]
pub fn get_table_vertices_for_webgpu(
    sheet: &mut Sheet,
    viewport: &Viewport,
    offsets: &SheetOffsets,
    fonts: &BitmapFonts,
    _heading_width: f32,
    _heading_height: f32,
    dpr: f32,
) -> (Vec<f32>, Vec<f32>, Vec<f32>, Vec<f32>, Vec<crate::sheets::text::LabelMesh>) {
    // Skip if no tables
    if sheet.tables.is_empty() {
        return (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());
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
    let outline_vertices = output.outlines.get_vertices().to_vec();
    let header_line_vertices = output.column_header_lines.get_vertices().to_vec();

    // Build text meshes
    let meshes = build_table_meshes(
        &mut output.name_labels,
        &mut output.column_labels,
        fonts,
    );

    (name_bg_vertices, column_bg_vertices, outline_vertices, header_line_vertices, meshes)
}
