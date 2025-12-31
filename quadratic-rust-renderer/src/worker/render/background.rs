//! Background rendering (white grid area)

use crate::renderers::primitives::Rects;
use crate::viewport::Viewport;
use crate::worker::RenderBackend;

/// Render the white background for the grid area
pub fn render_background(backend: &mut RenderBackend, viewport: &Viewport, matrix: &[f32; 16]) {
    let bounds = viewport.visible_bounds();

    if bounds.right <= 0.0 || bounds.bottom <= 0.0 {
        return;
    }

    let x = bounds.left.max(0.0);
    let y = bounds.top.max(0.0);
    let width = bounds.right - x;
    let height = bounds.bottom - y;

    let mut rects = Rects::new();
    rects.add(x, y, width, height, [1.0, 1.0, 1.0, 1.0]);

    match backend {
        RenderBackend::WebGL(gl) => {
            rects.render(gl, matrix);
        }
        RenderBackend::WebGPU(_gpu) => {
            // WebGPU path - vertices are used in render pass
            // This is handled differently in WebGPU frame()
        }
    }
}

/// Get background vertices for WebGPU rendering
pub fn get_background_vertices(viewport: &Viewport) -> Option<Vec<f32>> {
    let bounds = viewport.visible_bounds();

    if bounds.right <= 0.0 || bounds.bottom <= 0.0 {
        return None;
    }

    let x = bounds.left.max(0.0);
    let y = bounds.top.max(0.0);
    let width = bounds.right - x;
    let height = bounds.bottom - y;

    let x2 = x + width;
    let y2 = y + height;
    let color = [1.0f32, 1.0, 1.0, 1.0];

    // Two triangles forming a rectangle
    Some(vec![
        // Triangle 1
        x,
        y,
        color[0],
        color[1],
        color[2],
        color[3],
        x2,
        y,
        color[0],
        color[1],
        color[2],
        color[3],
        x2,
        y2,
        color[0],
        color[1],
        color[2],
        color[3],
        // Triangle 2
        x,
        y,
        color[0],
        color[1],
        color[2],
        color[3],
        x2,
        y2,
        color[0],
        color[1],
        color[2],
        color[3],
        x,
        y2,
        color[0],
        color[1],
        color[2],
        color[3],
    ])
}

