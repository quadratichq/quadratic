//! Cell text rendering

use crate::renderers::WebGLContext;
use crate::sheets::Sheet;
use crate::viewport::Viewport;

/// Render cell text using WebGL
///
/// Returns (visible_count, skipped_dirty) for debug logging
pub fn render_text(
    gl: &WebGLContext,
    sheet: &mut Sheet,
    viewport: &Viewport,
    matrix: &[f32; 16],
    font_scale: f32,
    distance_range: f32,
) -> (usize, usize) {
    if sheet.hashes.is_empty() {
        return (0, 0);
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
    let mut skipped_dirty = 0;

    for hash in sheet.hashes.values_mut() {
        if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
            continue;
        }

        // Skip dirty hashes - they'll be processed next frame
        if hash.is_dirty() {
            skipped_dirty += 1;
            continue;
        }

        visible_count += 1;

        hash.render(
            gl,
            matrix,
            scale,
            effective_scale,
            font_scale,
            distance_range,
        );
    }

    (visible_count, skipped_dirty)
}

/// Render cell text using WebGPU
///
/// Returns (visible_count, skipped_dirty) for debug logging
#[cfg(feature = "wasm")]
pub fn render_text_webgpu<'a>(
    gpu: &mut crate::renderers::WebGPUContext,
    pass: &mut wgpu::RenderPass<'a>,
    sheet: &mut Sheet,
    viewport: &Viewport,
    matrix: &[f32; 16],
    font_scale: f32,
    distance_range: f32,
) -> (usize, usize) {
    if sheet.hashes.is_empty() {
        return (0, 0);
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
    let mut skipped_dirty = 0;

    for hash in sheet.hashes.values_mut() {
        if !hash.intersects_viewport(min_x, max_x, min_y, max_y) {
            continue;
        }

        // Skip dirty hashes - they'll be processed next frame
        if hash.is_dirty() {
            skipped_dirty += 1;
            continue;
        }

        visible_count += 1;

        hash.render_webgpu(
            gpu,
            pass,
            matrix,
            scale,
            effective_scale,
            font_scale,
            distance_range,
        );
    }

    (visible_count, skipped_dirty)
}

