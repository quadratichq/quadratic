//! Lines - renders using triangles for configurable thickness
//!
//! Unlike `NativeLines`, these lines can have any thickness and can either:
//! - Maintain constant pixel thickness (stays same size on screen regardless of zoom)
//! - Scale with the viewport (world-space thickness, gets thicker/thinner with zoom)

use super::Color;
use crate::RenderContext;

/// How line thickness should behave during zoom
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum LineScaling {
    /// Thickness stays constant in pixels (e.g., always 2px on screen)
    /// This is typical for UI elements like selection borders
    #[default]
    Pixel,

    /// Thickness scales with the world (e.g., a 10-unit thick line in world space)
    /// This is typical for data visualization or drawings
    World,
}

/// A line segment (data only)
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

/// A batch of lines rendered as triangles for configurable thickness
///
/// These lines are rendered as thin rectangles (2 triangles per line),
/// allowing for arbitrary thickness and proper scaling behavior.
pub struct Lines {
    /// Line data
    lines: Vec<Line>,
    /// Pre-built vertex data
    vertices: Vec<f32>,
    /// Line thickness
    thickness: f32,
    /// How thickness should scale
    scaling: LineScaling,
}

impl Lines {
    /// Create a new empty lines batch with default settings
    /// (1.0 thickness, pixel scaling)
    pub fn new() -> Self {
        Self {
            lines: Vec::new(),
            vertices: Vec::new(),
            thickness: 1.0,
            scaling: LineScaling::Pixel,
        }
    }

    /// Create a new lines batch with specified thickness and scaling
    pub fn with_thickness(thickness: f32, scaling: LineScaling) -> Self {
        Self {
            lines: Vec::new(),
            vertices: Vec::new(),
            thickness,
            scaling,
        }
    }

    /// Create with pre-allocated capacity
    pub fn with_capacity(line_count: usize) -> Self {
        Self {
            lines: Vec::with_capacity(line_count),
            vertices: Vec::with_capacity(line_count * 36), // 6 vertices * 6 floats
            thickness: 1.0,
            scaling: LineScaling::Pixel,
        }
    }

    /// Set the line thickness
    pub fn set_thickness(&mut self, thickness: f32) {
        self.thickness = thickness;
    }

    /// Get the line thickness
    pub fn thickness(&self) -> f32 {
        self.thickness
    }

    /// Set the scaling mode
    pub fn set_scaling(&mut self, scaling: LineScaling) {
        self.scaling = scaling;
    }

    /// Get the scaling mode
    pub fn scaling(&self) -> LineScaling {
        self.scaling
    }

    /// Add a line by coordinates
    #[inline]
    pub fn add(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, color: Color) {
        self.lines.push(Line {
            x1,
            y1,
            x2,
            y2,
            color,
        });
    }

    /// Add a Line struct
    #[inline]
    pub fn push(&mut self, line: Line) {
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

    /// Get the raw line data
    pub fn lines(&self) -> &[Line] {
        &self.lines
    }

    /// Get the vertex data after building
    /// Must call `build_vertices()` or `render()` first to populate
    pub fn vertices(&self) -> &[f32] {
        &self.vertices
    }

    /// Build and get vertices for a specific viewport scale
    pub fn get_vertices(&mut self, viewport_scale: f32) -> &[f32] {
        self.build_vertices(viewport_scale);
        &self.vertices
    }

    /// Build triangle vertices for all lines
    ///
    /// # Arguments
    /// * `viewport_scale` - Current viewport scale (zoom level).
    ///   Used for `LineScaling::Pixel` to maintain constant screen thickness.
    ///   Ignored for `LineScaling::World`.
    fn build_vertices(&mut self, viewport_scale: f32) {
        self.vertices.clear();
        self.vertices.reserve(self.lines.len() * 36);

        // Calculate half thickness in world coordinates
        let half_thickness = match self.scaling {
            LineScaling::Pixel => {
                // Convert pixel thickness to world units
                (self.thickness / viewport_scale) / 2.0
            }
            LineScaling::World => {
                // Thickness is already in world units
                self.thickness / 2.0
            }
        };

        for line in &self.lines {
            let dx = line.x2 - line.x1;
            let dy = line.y2 - line.y1;

            // Calculate perpendicular vector for line thickness
            let (perp_x, perp_y) = if dx == 0.0 && dy == 0.0 {
                // Degenerate line (point) - arbitrary perpendicular
                (half_thickness, 0.0)
            } else if dx == 0.0 {
                // Vertical line
                (half_thickness, 0.0)
            } else if dy == 0.0 {
                // Horizontal line
                (0.0, half_thickness)
            } else {
                // General case - perpendicular to line direction
                let len = (dx * dx + dy * dy).sqrt();
                let nx = -dy / len * half_thickness;
                let ny = dx / len * half_thickness;
                (nx, ny)
            };

            // Four corners of the line quad
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
                v0_x, v0_y, c[0], c[1], c[2], c[3], v1_x, v1_y, c[0], c[1], c[2], c[3], v2_x, v2_y,
                c[0], c[1], c[2], c[3],
            ]);

            // Triangle 2: v0, v2, v3
            self.vertices.extend_from_slice(&[
                v0_x, v0_y, c[0], c[1], c[2], c[3], v2_x, v2_y, c[0], c[1], c[2], c[3], v3_x, v3_y,
                c[0], c[1], c[2], c[3],
            ]);
        }
    }

    /// Render all lines
    ///
    /// # Arguments
    /// * `ctx` - The render context
    /// * `matrix` - The view-projection matrix
    /// * `viewport_scale` - Current viewport scale (zoom level).
    ///   Required for `LineScaling::Pixel` mode. For `LineScaling::World`, pass any value.
    pub fn render(
        &mut self,
        ctx: &mut impl RenderContext,
        matrix: &[f32; 16],
        viewport_scale: f32,
    ) {
        if self.is_empty() {
            return;
        }
        self.build_vertices(viewport_scale);
        ctx.draw_triangles(&self.vertices, matrix);
    }
}

impl Default for Lines {
    fn default() -> Self {
        Self::new()
    }
}
