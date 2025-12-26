//! Rectangle primitive

use super::Color;
use crate::webgl::WebGLContext;

/// A filled rectangle (data only, use Rects for rendering)
#[derive(Debug, Clone, Copy)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub color: Color,
}

impl Rect {
    /// Create a new filled rectangle
    pub fn new(x: f32, y: f32, width: f32, height: f32, color: Color) -> Self {
        Self {
            x,
            y,
            width,
            height,
            color,
        }
    }
}

/// A batch of rectangles for efficient rendering
///
/// Collects rectangle vertices and renders them all in one draw call.
pub struct Rects {
    /// Vertex data: [x, y, r, g, b, a, ...] (6 floats per vertex, 6 vertices per rect)
    vertices: Vec<f32>,
}

impl Rects {
    /// Create a new empty rectangles batch
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
        }
    }

    /// Create with pre-allocated capacity (number of rectangles)
    pub fn with_capacity(rect_count: usize) -> Self {
        Self {
            vertices: Vec::with_capacity(rect_count * 36),
        }
    }

    /// Add a rectangle by coordinates
    #[inline]
    pub fn add(&mut self, x: f32, y: f32, width: f32, height: f32, color: Color) {
        let x2 = x + width;
        let y2 = y + height;

        // Triangle 1: top-left, top-right, bottom-left
        self.vertices.extend_from_slice(&[
            x, y, color[0], color[1], color[2], color[3], x2, y, color[0], color[1], color[2],
            color[3], x, y2, color[0], color[1], color[2], color[3],
        ]);
        // Triangle 2: top-right, bottom-right, bottom-left
        self.vertices.extend_from_slice(&[
            x2, y, color[0], color[1], color[2], color[3], x2, y2, color[0], color[1], color[2],
            color[3], x, y2, color[0], color[1], color[2], color[3],
        ]);
    }

    /// Add a Rect struct
    #[inline]
    pub fn push(&mut self, rect: Rect) {
        self.add(rect.x, rect.y, rect.width, rect.height, rect.color);
    }

    /// Clear all rectangles (keeps capacity)
    pub fn clear(&mut self) {
        self.vertices.clear();
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Get number of rectangles
    pub fn len(&self) -> usize {
        self.vertices.len() / 36
    }

    /// Reserve capacity for additional rectangles
    pub fn reserve(&mut self, additional: usize) {
        self.vertices.reserve(additional * 36);
    }

    /// Render all rectangles to WebGL in one draw call
    pub fn render(&self, gl: &WebGLContext, matrix: &[f32; 16]) {
        if !self.vertices.is_empty() {
            gl.draw_triangles(&self.vertices, matrix);
        }
    }
}

impl Default for Rects {
    fn default() -> Self {
        Self::new()
    }
}
