//! Thick rectangle (outline) primitive with viewport-independent screen thickness
//!
//! Renders rectangle outlines as quads with a border thickness that remains
//! constant in screen space regardless of viewport zoom level.

use super::Color;
use crate::webgl::WebGLContext;

/// A thick rectangle outline (data only, use ThickRects for rendering)
#[derive(Debug, Clone, Copy)]
pub struct ThickRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub color: Color,
    /// Border thickness in screen pixels (will remain constant regardless of zoom)
    pub screen_thickness: f32,
}

impl ThickRect {
    /// Create a new thick rectangle outline
    pub fn new(x: f32, y: f32, width: f32, height: f32, color: Color, screen_thickness: f32) -> Self {
        Self {
            x,
            y,
            width,
            height,
            color,
            screen_thickness,
        }
    }

    /// Create from corner coordinates
    pub fn from_corners(
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        color: Color,
        screen_thickness: f32,
    ) -> Self {
        Self {
            x: x1.min(x2),
            y: y1.min(y2),
            width: (x2 - x1).abs(),
            height: (y2 - y1).abs(),
            color,
            screen_thickness,
        }
    }
}

/// A batch of thick rectangle outlines for efficient rendering
///
/// Collects rectangle data and renders them all in one draw call as quads.
/// Each rectangle border is rendered with a thickness that stays constant in
/// screen pixels regardless of viewport scale/zoom.
pub struct ThickRects {
    /// Rectangle data stored for later vertex generation
    rects: Vec<ThickRect>,
    /// Pre-allocated vertex buffer for rendering
    vertices: Vec<f32>,
}

impl ThickRects {
    /// Create a new empty thick rectangles batch
    pub fn new() -> Self {
        Self {
            rects: Vec::new(),
            vertices: Vec::new(),
        }
    }

    /// Create with pre-allocated capacity (number of rectangles)
    pub fn with_capacity(rect_count: usize) -> Self {
        Self {
            rects: Vec::with_capacity(rect_count),
            // 4 edges per rect, 6 vertices per edge (2 triangles), 6 floats per vertex
            vertices: Vec::with_capacity(rect_count * 4 * 36),
        }
    }

    /// Add a rectangle outline by position and size with screen-space thickness
    #[inline]
    pub fn add(
        &mut self,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        color: Color,
        screen_thickness: f32,
    ) {
        self.rects.push(ThickRect {
            x,
            y,
            width,
            height,
            color,
            screen_thickness,
        });
    }

    /// Add a rectangle outline from corner coordinates
    #[inline]
    pub fn add_corners(
        &mut self,
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        color: Color,
        screen_thickness: f32,
    ) {
        self.rects.push(ThickRect::from_corners(x1, y1, x2, y2, color, screen_thickness));
    }

    /// Add a ThickRect struct
    #[inline]
    pub fn push(&mut self, rect: ThickRect) {
        self.rects.push(rect);
    }

    /// Clear all rectangles (keeps capacity)
    pub fn clear(&mut self) {
        self.rects.clear();
        self.vertices.clear();
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.rects.is_empty()
    }

    /// Get number of rectangles
    pub fn len(&self) -> usize {
        self.rects.len()
    }

    /// Reserve capacity for additional rectangles
    pub fn reserve(&mut self, additional: usize) {
        self.rects.reserve(additional);
        self.vertices.reserve(additional * 4 * 36);
    }

    /// Add a single edge (thick line segment) to the vertex buffer
    #[inline]
    fn add_edge(
        vertices: &mut Vec<f32>,
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        half_thickness: f32,
        is_horizontal: bool,
        color: Color,
    ) {
        let (perp_x, perp_y) = if is_horizontal {
            (0.0, half_thickness)
        } else {
            (half_thickness, 0.0)
        };

        // Four corners of the edge quad
        let v0_x = x1 - perp_x;
        let v0_y = y1 - perp_y;
        let v1_x = x1 + perp_x;
        let v1_y = y1 + perp_y;
        let v2_x = x2 + perp_x;
        let v2_y = y2 + perp_y;
        let v3_x = x2 - perp_x;
        let v3_y = y2 - perp_y;

        let c = color;

        // Triangle 1: v0, v1, v2
        vertices.extend_from_slice(&[
            v0_x, v0_y, c[0], c[1], c[2], c[3],
            v1_x, v1_y, c[0], c[1], c[2], c[3],
            v2_x, v2_y, c[0], c[1], c[2], c[3],
        ]);

        // Triangle 2: v0, v2, v3
        vertices.extend_from_slice(&[
            v0_x, v0_y, c[0], c[1], c[2], c[3],
            v2_x, v2_y, c[0], c[1], c[2], c[3],
            v3_x, v3_y, c[0], c[1], c[2], c[3],
        ]);
    }

    /// Build vertex data for all rectangles given the current viewport scale
    ///
    /// This converts screen-space thickness to world-space thickness by dividing
    /// by the viewport scale. Must be called before render().
    fn build_vertices(&mut self, viewport_scale: f32) {
        self.vertices.clear();
        self.vertices.reserve(self.rects.len() * 4 * 36);

        for rect in &self.rects {
            // Convert screen thickness to world thickness
            let world_thickness = rect.screen_thickness / viewport_scale;
            let half = world_thickness / 2.0;

            let x1 = rect.x;
            let y1 = rect.y;
            let x2 = rect.x + rect.width;
            let y2 = rect.y + rect.height;
            let c = rect.color;

            // Top edge (horizontal): extends outward by half thickness
            Self::add_edge(&mut self.vertices, x1 - half, y1, x2 + half, y1, half, true, c);

            // Bottom edge (horizontal): extends outward by half thickness
            Self::add_edge(&mut self.vertices, x1 - half, y2, x2 + half, y2, half, true, c);

            // Left edge (vertical): between top and bottom edges
            Self::add_edge(&mut self.vertices, x1, y1 + half, x1, y2 - half, half, false, c);

            // Right edge (vertical): between top and bottom edges
            Self::add_edge(&mut self.vertices, x2, y1 + half, x2, y2 - half, half, false, c);
        }
    }

    /// Render all thick rectangle outlines to WebGL in one draw call
    ///
    /// # Arguments
    /// * `gl` - WebGL context
    /// * `matrix` - View-projection matrix
    /// * `viewport_scale` - Current viewport scale (zoom level)
    pub fn render(&mut self, gl: &WebGLContext, matrix: &[f32; 16], viewport_scale: f32) {
        if self.rects.is_empty() {
            return;
        }

        self.build_vertices(viewport_scale);
        gl.draw_triangles(&self.vertices, matrix);
    }
}

impl Default for ThickRects {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_thick_rect_creation() {
        let rect = ThickRect::new(10.0, 20.0, 100.0, 50.0, [1.0, 0.0, 0.0, 1.0], 3.0);
        assert_eq!(rect.x, 10.0);
        assert_eq!(rect.y, 20.0);
        assert_eq!(rect.width, 100.0);
        assert_eq!(rect.height, 50.0);
        assert_eq!(rect.screen_thickness, 3.0);
    }

    #[test]
    fn test_thick_rect_from_corners() {
        let rect = ThickRect::from_corners(100.0, 50.0, 10.0, 20.0, [1.0, 1.0, 1.0, 1.0], 2.0);
        assert_eq!(rect.x, 10.0);
        assert_eq!(rect.y, 20.0);
        assert_eq!(rect.width, 90.0);
        assert_eq!(rect.height, 30.0);
    }

    #[test]
    fn test_thick_rects_batch() {
        let mut rects = ThickRects::with_capacity(10);
        assert!(rects.is_empty());

        rects.add(0.0, 0.0, 100.0, 50.0, [1.0, 1.0, 1.0, 1.0], 2.0);
        rects.add_corners(10.0, 10.0, 90.0, 40.0, [1.0, 0.0, 0.0, 1.0], 3.0);

        assert_eq!(rects.len(), 2);
        assert!(!rects.is_empty());

        rects.clear();
        assert!(rects.is_empty());
    }

    #[test]
    fn test_vertex_generation() {
        let mut rects = ThickRects::new();
        rects.add(0.0, 0.0, 100.0, 50.0, [1.0, 1.0, 1.0, 1.0], 4.0);

        // Build vertices at scale 1.0
        rects.build_vertices(1.0);
        // 4 edges * 6 vertices * 6 floats = 144 floats
        assert_eq!(rects.vertices.len(), 144);

        // Build vertices at scale 2.0 (thickness should be halved in world space)
        rects.build_vertices(2.0);
        assert_eq!(rects.vertices.len(), 144);
    }
}
