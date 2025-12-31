//! Grid headings (column/row headers) rendering

use crate::renderers::primitives::{NativeLines, Rects};
use crate::renderers::WebGLContext;
use crate::sheets::text::BitmapFonts;
use crate::ui::grid_lines::calculate_grid_alpha;
use crate::ui::headings::GridHeadings;
use quadratic_core_shared::SheetOffsets;

/// Render headings using WebGL
///
/// # Arguments
/// * `gl` - WebGL context
/// * `headings` - Grid headings
/// * `fonts` - Bitmap fonts
/// * `screen_matrix` - Screen space matrix
/// * `atlas_font_size` - The font size the atlas was generated at (e.g., 42.0 for OpenSans)
/// * `distance_range` - MSDF distance range
/// * `offsets` - Sheet offsets
/// * `scale` - Viewport scale
pub fn render_headings(
    gl: &mut WebGLContext,
    headings: &mut GridHeadings,
    fonts: &BitmapFonts,
    screen_matrix: &[f32; 16],
    atlas_font_size: f32,
    distance_range: f32,
    offsets: &SheetOffsets,
    scale: f32,
) {
    // Layout heading labels
    headings.layout(fonts);

    // Render headings
    headings.render(gl, screen_matrix, fonts, atlas_font_size, distance_range, offsets);

    // Note: grid line alpha is handled inside GridHeadings::render()
    let _ = scale; // Used for grid line alpha calculation
}

/// Render headings using WebGPU
///
/// # Arguments
/// * `gpu` - WebGPU context
/// * `pass` - Render pass
/// * `headings` - Grid headings
/// * `fonts` - Bitmap fonts
/// * `screen_matrix` - Screen space matrix
/// * `atlas_font_size` - The font size the atlas was generated at (e.g., 42.0 for OpenSans)
/// * `distance_range` - MSDF distance range
/// * `offsets` - Sheet offsets
/// * `scale` - Viewport scale
/// * `debug_label_bounds` - Whether to debug label bounds
#[cfg(feature = "wasm")]
pub fn render_headings_webgpu<'a>(
    gpu: &mut crate::renderers::WebGPUContext,
    pass: &mut wgpu::RenderPass<'a>,
    headings: &mut GridHeadings,
    fonts: &BitmapFonts,
    screen_matrix: &[f32; 16],
    atlas_font_size: f32,
    distance_range: f32,
    offsets: &SheetOffsets,
    scale: f32,
    debug_label_bounds: bool,
) {
    // Layout heading labels
    headings.layout(fonts);

    // 1. Render backgrounds
    let mut rects = Rects::with_capacity(8);
    let (col_rect, row_rect, corner_rect) = headings.get_background_rects();
    let colors = &headings.colors;

    rects.add(
        col_rect[0],
        col_rect[1],
        col_rect[2],
        col_rect[3],
        colors.background,
    );
    rects.add(
        row_rect[0],
        row_rect[1],
        row_rect[2],
        row_rect[3],
        colors.background,
    );
    rects.add(
        corner_rect[0],
        corner_rect[1],
        corner_rect[2],
        corner_rect[3],
        colors.corner_background,
    );

    // Selection highlights
    let selection_color = [
        colors.selection[0],
        colors.selection[1],
        colors.selection[2],
        colors.selection_alpha,
    ];
    for rect in headings.get_selection_rects(offsets) {
        rects.add(rect[0], rect[1], rect[2], rect[3], selection_color);
    }

    // Debug rectangles if enabled
    if debug_label_bounds {
        let (anchor_points, text_bounds) = headings.get_debug_label_rects();

        let anchor_color = [1.0, 0.0, 0.0, 1.0];
        for rect in anchor_points {
            rects.add(rect[0], rect[1], rect[2], rect[3], anchor_color);
        }

        let bounds_color = [0.0, 0.0, 1.0, 0.3];
        for rect in text_bounds {
            rects.add(rect[0], rect[1], rect[2], rect[3], bounds_color);
        }
    }

    // Render background rectangles
    if !rects.is_empty() {
        gpu.draw_triangles(pass, rects.vertices(), screen_matrix);
    }

    // 2. Render grid lines (with fade matching main grid lines)
    let grid_line_coords = headings.get_grid_lines(offsets);
    let mut lines = NativeLines::with_capacity(grid_line_coords.len() / 4);

    // Apply same alpha fading as main grid lines based on zoom level
    let alpha = calculate_grid_alpha(scale);
    let grid_line_color = [
        colors.grid_line[0],
        colors.grid_line[1],
        colors.grid_line[2],
        colors.grid_line[3] * alpha,
    ];

    for chunk in grid_line_coords.chunks(4) {
        if let [x1, y1, x2, y2] = chunk {
            lines.add(*x1, *y1, *x2, *y2, grid_line_color);
        }
    }

    if !lines.is_empty() {
        let line_vertices = lines.get_vertices();
        gpu.draw_lines(pass, line_vertices, screen_matrix);
    }

    // 3. Render text
    let meshes = headings.get_meshes(fonts);

    for mesh in meshes {
        if mesh.is_empty() {
            continue;
        }
        let vertices = mesh.get_vertex_data();
        let indices: Vec<u32> = mesh.get_index_data().iter().map(|&i| i as u32).collect();

        // Calculate the correct font_scale for this mesh's font size
        let font_scale = mesh.font_size / atlas_font_size;

        gpu.draw_text(
            pass,
            &vertices,
            &indices,
            mesh.texture_uid,
            screen_matrix,
            1.0,
            font_scale,
            distance_range,
        );
    }
}
