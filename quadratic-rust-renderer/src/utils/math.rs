//! Math utilities for rendering

/// Create an orthographic projection matrix (column-major, OpenGL/WebGPU convention)
///
/// Maps world coordinates to clip space [-1, 1]:
/// - left/right: X range
/// - bottom/top: Y range
/// - Z is fixed at [0, 1]
pub fn ortho_matrix(left: f32, right: f32, bottom: f32, top: f32) -> [f32; 16] {
    let sx = 2.0 / (right - left);
    let sy = 2.0 / (top - bottom);
    let tx = -(right + left) / (right - left);
    let ty = -(top + bottom) / (top - bottom);

    [
        sx, 0.0, 0.0, 0.0, 0.0, sy, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, tx, ty, 0.0, 1.0,
    ]
}
