//! Cursor rendering

use crate::{renderers::WebGLContext, ui::cursor::Cursor};

/// Render cursor using WebGL
pub fn render_cursor(gl: &mut WebGLContext, cursor: &mut Cursor, matrix: &[f32; 16], scale: f32) {
    cursor.render(gl, matrix, scale);
}

/// Get cursor fill vertices for WebGPU rendering
pub fn get_cursor_fill_vertices(cursor: &Cursor) -> Option<&[f32]> {
    cursor.get_fill_vertices()
}

/// Get cursor border vertices for WebGPU rendering
/// Note: Returns a copy since the original requires &mut self
pub fn get_cursor_border_vertices(cursor: &mut Cursor, scale: f32) -> Option<Vec<f32>> {
    cursor
        .get_border_vertices(scale)
        .map(|s: &[f32]| s.to_vec())
}
