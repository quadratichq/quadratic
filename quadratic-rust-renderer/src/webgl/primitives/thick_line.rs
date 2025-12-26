//! Thick line primitive with viewport-independent screen thickness
//!
//! Renders lines as quads (two triangles) with a thickness that remains
//! constant in screen space regardless of viewport zoom level.

use super::Color;
use crate::webgl::WebGLContext;

/// A thick line segment (data only, use ThickLines for rendering)
#[derive(Debug, Clone, Copy)]
pub struct ThickLine {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
    pub color: Color,
    /// Thickness in screen pixels (will remain constant regardless of zoom)
    pub screen_thickness: f32,
}

impl ThickLine {
    /// Create a new thick line
    pub fn new(x1: f32, y1: f32, x2: f32, y2: f32, color: Color, screen_thickness: f32) -> Self {
        Self {
            x1,
            y1,
            x2,
            y2,
            color,
            screen_thickness,
        }
    }
}

/// A batch of thick lines for efficient rendering
///
/// Collects line data and renders them all in one draw call as quads.
/// Each line is rendered with a thickness that stays constant in screen
/// pixels regardless of viewport scale/zoom.
pub struct ThickLines {
    /// Line data stored for later vertex generation
    lines: Vec<ThickLine>,
    /// Pre-allocated vertex buffer for rendering
    vertices: Vec<f32>,
}

impl ThickLines {
    /// Create a new empty thick lines batch
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
            // 6 vertices per quad (2 triangles), 6 floats per vertex
            vertices: Vec::with_capacity(line_count * 36),
        }
    }

    /// Add a line by coordinates with screen-space thickness
    #[inline]
    pub fn add(
        &mut self,
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        color: Color,
        screen_thickness: f32,
    ) {
        self.lines.push(ThickLine {
            x1,
            y1,
            x2,
            y2,
            color,
            screen_thickness,
        });
    }

    /// Add a horizontal line (optimized - no direction calculation needed)
    #[inline]
    pub fn add_horizontal(&mut self, x1: f32, x2: f32, y: f32, color: Color, screen_thickness: f32) {
        self.lines.push(ThickLine {
            x1,
            y1: y,
            x2,
            y2: y,
            color,
            screen_thickness,
        });
    }

    /// Add a vertical line (optimized - no direction calculation needed)
    #[inline]
    pub fn add_vertical(&mut self, x: f32, y1: f32, y2: f32, color: Color, screen_thickness: f32) {
        self.lines.push(ThickLine {
            x1: x,
            y1,
            x2: x,
            y2,
            color,
            screen_thickness,
        });
    }

    /// Add a ThickLine struct
    #[inline]
    pub fn push(&mut self, line: ThickLine) {
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
        self.vertices.reserve(additional * 36);
    }

    /// Build vertex data for all lines given the current viewport scale
    ///
    /// This converts screen-space thickness to world-space thickness by dividing
    /// by the viewport scale. Must be called before render().
    fn build_vertices(&mut self, viewport_scale: f32) {
        self.vertices.clear();
        self.vertices.reserve(self.lines.len() * 36);

        for line in &self.lines {
            // Convert screen thickness to world thickness
            let world_thickness = line.screen_thickness / viewport_scale;
            let half_thickness = world_thickness / 2.0;

            let dx = line.x2 - line.x1;
            let dy = line.y2 - line.y1;

            // Calculate perpendicular vector
            let (perp_x, perp_y) = if dx == 0.0 && dy == 0.0 {
                // Degenerate line (point) - use arbitrary perpendicular
                (half_thickness, 0.0)
            } else if dx == 0.0 {
                // Vertical line - perpendicular is horizontal
                (half_thickness, 0.0)
            } else if dy == 0.0 {
                // Horizontal line - perpendicular is vertical
                (0.0, half_thickness)
            } else {
                // General case - normalize direction and get perpendicular
                let len = (dx * dx + dy * dy).sqrt();
                let nx = -dy / len * half_thickness;
                let ny = dx / len * half_thickness;
                (nx, ny)
            };

            // Four corners of the quad
            let v0_x = line.x1 - perp_x;
            let v0_y = line.y1 - perp_y;
            let v1_x = line.x1 + perp_x;
            let v1_y = line.y1 + perp_y;
            let v2_x = line.x2 + perp_x;
            let v2_y = line.y2 + perp_y;
            let v3_x = line.x2 - perp_x;
            let v3_y = line.y2 - perp_y;

            let c = line.color;

            // Triangle 1: v0, v1, v2
            self.vertices.extend_from_slice(&[
                v0_x, v0_y, c[0], c[1], c[2], c[3],
                v1_x, v1_y, c[0], c[1], c[2], c[3],
                v2_x, v2_y, c[0], c[1], c[2], c[3],
            ]);

            // Triangle 2: v0, v2, v3
            self.vertices.extend_from_slice(&[
                v0_x, v0_y, c[0], c[1], c[2], c[3],
                v2_x, v2_y, c[0], c[1], c[2], c[3],
                v3_x, v3_y, c[0], c[1], c[2], c[3],
            ]);
        }
    }

    /// Render all thick lines to WebGL in one draw call
    ///
    /// # Arguments
    /// * `gl` - WebGL context
    /// * `matrix` - View-projection matrix
    /// * `viewport_scale` - Current viewport scale (zoom level)
    pub fn render(&mut self, gl: &WebGLContext, matrix: &[f32; 16], viewport_scale: f32) {
        if self.lines.is_empty() {
            return;
        }

        self.build_vertices(viewport_scale);
        gl.draw_triangles(&self.vertices, matrix);
    }
}

impl Default for ThickLines {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thick_line_creation() {
        let line = ThickLine::new(0.0, 0.0, 100.0, 100.0, [1.0, 0.0, 0.0, 1.0], 3.0);
        assert_eq!(line.x1, 0.0);
        assert_eq!(line.screen_thickness, 3.0);
    }

    #[test]
    fn test_thick_lines_batch() {
        let mut lines = ThickLines::with_capacity(10);
        assert!(lines.is_empty());

        lines.add(0.0, 0.0, 100.0, 0.0, [1.0, 1.0, 1.0, 1.0], 2.0);
        lines.add_horizontal(0.0, 100.0, 50.0, [1.0, 0.0, 0.0, 1.0], 3.0);
        lines.add_vertical(50.0, 0.0, 100.0, [0.0, 1.0, 0.0, 1.0], 3.0);

        assert_eq!(lines.len(), 3);
        assert!(!lines.is_empty());

        lines.clear();
        assert!(lines.is_empty());
    }

    #[test]
    fn test_vertex_generation() {
        let mut lines = ThickLines::new();
        lines.add_horizontal(0.0, 100.0, 50.0, [1.0, 1.0, 1.0, 1.0], 4.0);

        // Build vertices at scale 1.0 (4px screen = 4 world units)
        lines.build_vertices(1.0);
        assert_eq!(lines.vertices.len(), 36); // 6 vertices * 6 floats

        // Build vertices at scale 2.0 (4px screen = 2 world units)
        lines.build_vertices(2.0);
        assert_eq!(lines.vertices.len(), 36);
    }
}
