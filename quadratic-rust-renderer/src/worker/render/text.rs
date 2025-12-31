//! Cell text rendering

use crate::renderers::WebGLContext;
use crate::sheets::text::BitmapFonts;
use crate::sheets::text::SPRITE_SCALE_THRESHOLD;
use crate::sheets::Sheet;
use crate::viewport::Viewport;

/// Render cell text using WebGL
///
/// Returns visible_count for debug logging
///
/// # Arguments
/// * `gl` - WebGL context
/// * `sheet` - Sheet to render
/// * `viewport` - Viewport for culling and scale
/// * `fonts` - Bitmap fonts
/// * `matrix` - View-projection matrix
/// * `atlas_font_size` - The font size the atlas was generated at (e.g., 42.0 for OpenSans)
/// * `distance_range` - MSDF distance range
pub fn render_text(
    gl: &WebGLContext,
    sheet: &mut Sheet,
    viewport: &Viewport,
    fonts: &BitmapFonts,
    matrix: &[f32; 16],
    atlas_font_size: f32,
    distance_range: f32,
) -> usize {
    if sheet.hashes.is_empty() {
        return 0;
    }

    let scale = viewport.scale();
    let effective_scale = viewport.effective_scale();
    let use_sprites = scale < SPRITE_SCALE_THRESHOLD;

    let bounds = viewport.visible_bounds();
    let padding = 100.0;
    let min_x = bounds.left - padding;
    let max_x = bounds.left + bounds.width + padding;
    let min_y = bounds.top - padding;
    let max_y = bounds.top + bounds.height + padding;

    let mut visible_count = 0;

    for hash in sheet.hashes.values_mut() {
        if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
            continue;
        }

        // Rebuild mesh cache if dirty (needed before rendering)
        hash.rebuild_if_dirty(fonts);

        // Rebuild sprite cache if zoomed out and sprite is dirty
        if use_sprites {
            hash.rebuild_sprite_if_dirty(gl, fonts, atlas_font_size, distance_range);
        }

        visible_count += 1;

        hash.render(
            gl,
            matrix,
            scale,
            effective_scale,
            atlas_font_size,
            distance_range,
        );
    }

    visible_count
}

/// Render cell text using WebGPU
///
/// Returns visible_count for debug logging
///
/// # Arguments
/// * `gpu` - WebGPU context
/// * `pass` - Render pass
/// * `sheet` - Sheet to render
/// * `viewport` - Viewport for culling and scale
/// * `fonts` - Bitmap fonts
/// * `matrix` - View-projection matrix
/// * `atlas_font_size` - The font size the atlas was generated at (e.g., 42.0 for OpenSans)
/// * `distance_range` - MSDF distance range
#[cfg(feature = "wasm")]
pub fn render_text_webgpu<'a>(
    gpu: &mut crate::renderers::WebGPUContext,
    pass: &mut wgpu::RenderPass<'a>,
    sheet: &mut Sheet,
    viewport: &Viewport,
    fonts: &BitmapFonts,
    matrix: &[f32; 16],
    atlas_font_size: f32,
    distance_range: f32,
) -> usize {
    if sheet.hashes.is_empty() {
        return 0;
    }

    let scale = viewport.scale();
    let effective_scale = viewport.effective_scale();

    let bounds = viewport.visible_bounds();
    let padding = 100.0;
    let min_x = bounds.left - padding;
    let max_x = bounds.left + bounds.width + padding;
    let min_y = bounds.top - padding;
    let max_y = bounds.top + bounds.height + padding;

    let mut visible_count = 0;

    for hash in sheet.hashes.values_mut() {
        if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
            continue;
        }

        // Rebuild mesh cache if dirty (needed before rendering)
        hash.rebuild_if_dirty(fonts);

        visible_count += 1;

        hash.render_webgpu(
            gpu,
            pass,
            matrix,
            scale,
            effective_scale,
            atlas_font_size,
            distance_range,
        );
    }

    visible_count
}
