//! Background rendering (white grid area)

use crate::viewport::Viewport;

/// Get background vertices for rendering
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
