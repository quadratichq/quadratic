//! Native Lines - renders using GPU's LINES primitive (always 1 pixel thick)
//!
//! Use this for grid lines or any lines that should always be 1px regardless of zoom.
//! For thick or scalable lines, use `Lines` instead.

use super::Color;
use crate::RenderContext;

/// A line segment (data only)
#[derive(Debug, Clone, Copy)]
pub struct NativeLine {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub color: Color,
}

impl NativeLine {
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

/// A batch of native lines for efficient rendering
///
/// These lines are always 1 pixel thick regardless of zoom level.
/// Uses GPU's native line primitive (GL_LINES / LineList).
pub struct NativeLines {
    /// Line data
    lines: Vec<NativeLine>,
    /// Pre-built vertex data
    vertices: Vec<f32>,
}

impl NativeLines {
    /// Create a new empty lines batch
    pub fn new() -> Self {
        Self {
            lines: Vec::new(),
            vertices: Vec::new(),
        }
    }

    /// Create with pre-allocated capacity (number of lines)
    pub fn with_capacity(line_count: usize) -> Self {
        Self {
            lines: Vec::with_capacity(line_count),
            vertices: Vec::with_capacity(line_count * 12), // 2 vertices * 6 floats
        }
    }

    /// Add a line by coordinates
    #[inline]
    pub fn add(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, color: Color) {
        self.lines.push(NativeLine {
            x1,
            y1,
            x2,
            y2,
            color,
        });
    }

    /// Add a NativeLine struct
    #[inline]
    pub fn push(&mut self, line: NativeLine) {
        self.lines.push(line);
    }

    /// Clear all lines (keeps capacity)
    pub fn clear(&mut self) {
        self.lines.clear();
        self.vertices.clear();
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.lines.is_empty()
    }

    /// Get number of lines
    pub fn len(&self) -> usize {
        self.lines.len()
    }

    /// Reserve capacity for additional lines
    pub fn reserve(&mut self, additional: usize) {
        self.lines.reserve(additional);
    }

    /// Get the raw line data
    pub fn lines(&self) -> &[NativeLine] {
        &self.lines
    }

    /// Get vertex data (must call build_vertices first or use get_vertices)
    pub fn vertices(&self) -> &[f32] {
        &self.vertices
    }

    /// Build and return vertex data
    pub fn get_vertices(&mut self) -> &[f32] {
        self.build_vertices();
        &self.vertices
    }

    /// Build vertex data for rendering
    /// Format: [x, y, r, g, b, a, ...] (6 floats per vertex, 2 vertices per line)
    fn build_vertices(&mut self) {
        self.vertices.clear();
        self.vertices.reserve(self.lines.len() * 12);

        for line in &self.lines {
            self.vertices.extend_from_slice(&[
                line.x1,
                line.y1,
                line.color[0],
                line.color[1],
                line.color[2],
                line.color[3],
                line.x2,
                line.y2,
                line.color[0],
                line.color[1],
                line.color[2],
                line.color[3],
            ]);
        }
    }

    /// Render all lines using native line primitives (always 1px thick)
    pub fn render(&mut self, ctx: &mut impl RenderContext, matrix: &[f32; 16]) {
        if self.is_empty() {
            return;
        }
        self.build_vertices();
        ctx.draw_lines(&self.vertices, matrix);
    }
}

impl Default for NativeLines {
    fn default() -> Self {
        Self::new()
    }
}
