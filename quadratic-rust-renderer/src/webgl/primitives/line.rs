//! Line primitive

use super::Color;
use crate::webgl::WebGLContext;

/// A line segment (data only, use Lines for rendering)
#[derive(Debug, Clone, Copy)]
pub struct Line {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub color: Color,
}

impl Line {
    /// Create a new line
    pub fn new(x1: f32, y1: f32, x2: f32, y2: f32, color: Color) -> Self {
        Self {
            x1,
            y1,
            x2,
            y2,
            color,
        }
    }
}

/// A batch of lines for efficient rendering
///
/// Collects line vertices and renders them all in one draw call.
pub struct Lines {
    /// Vertex data: [x, y, r, g, b, a, ...] (6 floats per vertex, 2 vertices per line)
    vertices: Vec<f32>,
}

impl Lines {
    /// Create a new empty lines batch
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
        }
    }

    /// Create with pre-allocated capacity (number of lines)
    pub fn with_capacity(line_count: usize) -> Self {
        Self {
            vertices: Vec::with_capacity(line_count * 12),
        }
    }

    /// Add a line by coordinates
    #[inline]
    pub fn add(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, color: Color) {
        self.vertices.extend_from_slice(&[
            x1, y1, color[0], color[1], color[2], color[3], x2, y2, color[0], color[1], color[2],
            color[3],
        ]);
    }

    /// Add a Line struct
    #[inline]
    pub fn push(&mut self, line: Line) {
        self.add(line.x1, line.y1, line.x2, line.y2, line.color);
    }

    /// Clear all lines (keeps capacity)
    pub fn clear(&mut self) {
        self.vertices.clear();
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Get number of lines
    pub fn len(&self) -> usize {
        self.vertices.len() / 12
    }

    /// Reserve capacity for additional lines
    pub fn reserve(&mut self, additional: usize) {
        self.vertices.reserve(additional * 12);
    }

    /// Render all lines to WebGL in one draw call
    pub fn render(&self, gl: &WebGLContext, matrix: &[f32; 16]) {
        if !self.vertices.is_empty() {
            gl.draw_lines(&self.vertices, matrix);
        }
    }
}

impl Default for Lines {
    fn default() -> Self {
        Self::new()
    }
}
