//! Line primitives for rendering grid lines, borders, etc.

use super::Color;
use crate::render_context::RenderContext;

/// How to handle line thickness at different zoom levels
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LineScaling {
    /// Line stays 1 screen pixel regardless of zoom (grid lines)
    ScreenPixel,
    /// Line scales with zoom (borders, selection outlines)
    WorldUnits(f32),
}

/// Lines rendered as triangulated quads (works on all backends)
///
/// Each line is converted to a quad with the specified thickness.
/// This works everywhere but requires more vertices than native lines.
pub struct Lines {
    /// Vertex data: [x, y, r, g, b, a, ...] (6 floats per vertex)
    vertices: Vec<f32>,
    /// Line thickness in pixels
    thickness: f32,
    /// How thickness scales with zoom
    scaling: LineScaling,
}

impl Lines {
    /// Create new lines with default 1px thickness
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
            thickness: 1.0,
            scaling: LineScaling::ScreenPixel,
        }
    }

    /// Create with specified thickness and scaling
    pub fn with_thickness(thickness: f32, scaling: LineScaling) -> Self {
        Self {
            vertices: Vec::new(),
            thickness,
            scaling,
        }
    }

    /// Add a horizontal line (optimized - no sqrt needed)
    #[inline]
    pub fn add_horizontal(&mut self, x1: f32, x2: f32, y: f32, color: Color, scale: f32) {
        let half_thickness = self.effective_thickness(scale) / 2.0;
        let y0 = y - half_thickness;
        let y1 = y + half_thickness;

        // Two triangles forming a quad
        self.vertices.extend_from_slice(&[
            x1, y0, color[0], color[1], color[2], color[3],
            x2, y0, color[0], color[1], color[2], color[3],
            x1, y1, color[0], color[1], color[2], color[3],
            x2, y0, color[0], color[1], color[2], color[3],
            x2, y1, color[0], color[1], color[2], color[3],
            x1, y1, color[0], color[1], color[2], color[3],
        ]);
    }

    /// Add a vertical line (optimized - no sqrt needed)
    #[inline]
    pub fn add_vertical(&mut self, x: f32, y1: f32, y2: f32, color: Color, scale: f32) {
        let half_thickness = self.effective_thickness(scale) / 2.0;
        let x0 = x - half_thickness;
        let x1 = x + half_thickness;

        // Two triangles forming a quad
        self.vertices.extend_from_slice(&[
            x0, y1, color[0], color[1], color[2], color[3],
            x1, y1, color[0], color[1], color[2], color[3],
            x0, y2, color[0], color[1], color[2], color[3],
            x1, y1, color[0], color[1], color[2], color[3],
            x1, y2, color[0], color[1], color[2], color[3],
            x0, y2, color[0], color[1], color[2], color[3],
        ]);
    }

    /// Add an arbitrary line segment
    pub fn add(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, color: Color, scale: f32) {
        let dx = x2 - x1;
        let dy = y2 - y1;
        let length = (dx * dx + dy * dy).sqrt();

        if length < 0.001 {
            return; // Degenerate line
        }

        let half_thickness = self.effective_thickness(scale) / 2.0;

        // Perpendicular unit vector
        let px = -dy / length * half_thickness;
        let py = dx / length * half_thickness;

        // Four corners of the quad
        let ax = x1 + px;
        let ay = y1 + py;
        let bx = x1 - px;
        let by = y1 - py;
        let cx = x2 + px;
        let cy = y2 + py;
        let ddx = x2 - px;
        let ddy = y2 - py;

        // Two triangles
        self.vertices.extend_from_slice(&[
            ax, ay, color[0], color[1], color[2], color[3],
            bx, by, color[0], color[1], color[2], color[3],
            cx, cy, color[0], color[1], color[2], color[3],
            bx, by, color[0], color[1], color[2], color[3],
            ddx, ddy, color[0], color[1], color[2], color[3],
            cx, cy, color[0], color[1], color[2], color[3],
        ]);
    }

    /// Calculate effective thickness based on scaling mode and current zoom
    fn effective_thickness(&self, scale: f32) -> f32 {
        match self.scaling {
            LineScaling::ScreenPixel => self.thickness / scale,
            LineScaling::WorldUnits(world_thickness) => world_thickness,
        }
    }

    /// Clear all lines
    pub fn clear(&mut self) {
        self.vertices.clear();
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Get raw vertex data
    pub fn vertices(&self) -> &[f32] {
        &self.vertices
    }

    /// Render all lines using the provided context
    pub fn render(&self, ctx: &mut impl RenderContext, matrix: &[f32; 16]) {
        if !self.is_empty() {
            ctx.draw_triangles(&self.vertices, matrix);
        }
    }
}

impl Default for Lines {
    fn default() -> Self {
        Self::new()
    }
}

/// Lines using native GPU line primitives
///
/// More efficient than triangulated lines but may have limitations
/// on some platforms (line width clamping, no anti-aliasing).
pub struct NativeLines {
    /// Vertex data: [x, y, r, g, b, a, ...] (6 floats per vertex, 2 per line)
    vertices: Vec<f32>,
}

impl NativeLines {
    /// Create new empty line batch
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
        }
    }

    /// Create with capacity for the specified number of lines
    pub fn with_capacity(line_count: usize) -> Self {
        Self {
            vertices: Vec::with_capacity(line_count * 12), // 2 vertices * 6 floats
        }
    }

    /// Add a line segment
    #[inline]
    pub fn add(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, color: Color) {
        self.vertices.extend_from_slice(&[
            x1, y1, color[0], color[1], color[2], color[3],
            x2, y2, color[0], color[1], color[2], color[3],
        ]);
    }

    /// Add a horizontal line
    #[inline]
    pub fn add_horizontal(&mut self, x1: f32, x2: f32, y: f32, color: Color) {
        self.add(x1, y, x2, y, color);
    }

    /// Add a vertical line
    #[inline]
    pub fn add_vertical(&mut self, x: f32, y1: f32, y2: f32, color: Color) {
        self.add(x, y1, x, y2, color);
    }

    /// Clear all lines
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

    /// Get raw vertex data
    pub fn vertices(&self) -> &[f32] {
        &self.vertices
    }

    /// Render all lines using the provided context
    pub fn render(&self, ctx: &mut impl RenderContext, matrix: &[f32; 16]) {
        if !self.is_empty() {
            ctx.draw_lines(&self.vertices, matrix);
        }
    }
}

impl Default for NativeLines {
    fn default() -> Self {
        Self::new()
    }
}
