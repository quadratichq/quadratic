//! Rectangle primitive. These are fill only. Use Lines or NativeLines for outlines.

use super::Color;
use crate::render_context::RenderContext;

/// A filled rectangle (data only)
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
/// Collects rectangle vertices for batched rendering.
/// Use with RenderContext::draw_triangles() to render.
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
            x, y, color[0], color[1], color[2], color[3],
            x2, y, color[0], color[1], color[2], color[3],
            x, y2, color[0], color[1], color[2], color[3],
        ]);
        // Triangle 2: top-right, bottom-right, bottom-left
        self.vertices.extend_from_slice(&[
            x2, y, color[0], color[1], color[2], color[3],
            x2, y2, color[0], color[1], color[2], color[3],
            x, y2, color[0], color[1], color[2], color[3],
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

    /// Get raw vertex data for rendering
    /// Format: [x, y, r, g, b, a, ...] (6 floats per vertex, 6 vertices per rect)
    pub fn vertices(&self) -> &[f32] {
        &self.vertices
    }

    /// Render all rectangles using the provided context
    pub fn render(&self, ctx: &mut impl RenderContext, matrix: &[f32; 16]) {
        if !self.is_empty() {
            ctx.draw_triangles(&self.vertices, matrix);
        }
    }
}

impl Default for Rects {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WHITE: Color = [1.0, 1.0, 1.0, 1.0];
    const RED: Color = [1.0, 0.0, 0.0, 1.0];
    const BLUE: Color = [0.0, 0.0, 1.0, 1.0];

    // =========================================================================
    // Rect tests
    // =========================================================================

    #[test]
    fn test_rect_new() {
        let rect = Rect::new(10.0, 20.0, 100.0, 50.0, WHITE);
        assert_eq!(rect.x, 10.0);
        assert_eq!(rect.y, 20.0);
        assert_eq!(rect.width, 100.0);
        assert_eq!(rect.height, 50.0);
        assert_eq!(rect.color, WHITE);
    }

    #[test]
    fn test_rect_clone() {
        let rect = Rect::new(10.0, 20.0, 100.0, 50.0, RED);
        let cloned = rect;
        assert_eq!(cloned.x, 10.0);
        assert_eq!(cloned.color, RED);
    }

    // =========================================================================
    // Rects batch tests
    // =========================================================================

    #[test]
    fn test_rects_new() {
        let rects = Rects::new();
        assert!(rects.is_empty());
        assert_eq!(rects.len(), 0);
    }

    #[test]
    fn test_rects_default() {
        let rects = Rects::default();
        assert!(rects.is_empty());
    }

    #[test]
    fn test_rects_with_capacity() {
        let rects = Rects::with_capacity(10);
        assert!(rects.is_empty());
        // Should have pre-allocated capacity for 10 rects
    }

    #[test]
    fn test_rects_add() {
        let mut rects = Rects::new();
        rects.add(0.0, 0.0, 100.0, 50.0, WHITE);

        assert!(!rects.is_empty());
        assert_eq!(rects.len(), 1);
        // 2 triangles * 3 vertices * 6 floats = 36 floats
        assert_eq!(rects.vertices().len(), 36);
    }

    #[test]
    fn test_rects_push() {
        let mut rects = Rects::new();
        let rect = Rect::new(10.0, 20.0, 100.0, 50.0, RED);
        rects.push(rect);

        assert_eq!(rects.len(), 1);
    }

    #[test]
    fn test_rects_clear() {
        let mut rects = Rects::new();
        rects.add(0.0, 0.0, 100.0, 50.0, WHITE);
        assert!(!rects.is_empty());

        rects.clear();
        assert!(rects.is_empty());
        assert_eq!(rects.len(), 0);
    }

    #[test]
    fn test_rects_multiple() {
        let mut rects = Rects::new();
        rects.add(0.0, 0.0, 100.0, 50.0, WHITE);
        rects.add(100.0, 0.0, 100.0, 50.0, RED);
        rects.add(200.0, 0.0, 100.0, 50.0, BLUE);

        assert_eq!(rects.len(), 3);
        // 3 rects * 36 floats = 108 floats
        assert_eq!(rects.vertices().len(), 108);
    }

    #[test]
    fn test_rects_reserve() {
        let mut rects = Rects::new();
        rects.reserve(100);
        // Should have capacity for 100 rects now
        assert!(rects.is_empty());
    }

    #[test]
    fn test_rects_vertex_format() {
        let mut rects = Rects::new();
        let color: Color = [0.5, 0.6, 0.7, 0.8];
        rects.add(10.0, 20.0, 100.0, 50.0, color);

        let v = rects.vertices();

        // First vertex of first triangle should be top-left
        assert_eq!(v[0], 10.0); // x
        assert_eq!(v[1], 20.0); // y
        assert_eq!(v[2], 0.5); // r
        assert_eq!(v[3], 0.6); // g
        assert_eq!(v[4], 0.7); // b
        assert_eq!(v[5], 0.8); // a

        // Second vertex should be top-right
        assert_eq!(v[6], 110.0); // x + width
        assert_eq!(v[7], 20.0); // y

        // Third vertex should be bottom-left
        assert_eq!(v[12], 10.0); // x
        assert_eq!(v[13], 70.0); // y + height
    }

    #[test]
    fn test_rects_triangle_count() {
        let mut rects = Rects::new();
        rects.add(0.0, 0.0, 100.0, 50.0, WHITE);

        // Each rect should produce 6 vertices (2 triangles)
        let vertex_count = rects.vertices().len() / 6; // 6 floats per vertex
        assert_eq!(vertex_count, 6);
    }

    #[test]
    fn test_rects_zero_size() {
        let mut rects = Rects::new();
        rects.add(10.0, 20.0, 0.0, 0.0, WHITE);

        // Should still add the rect (degenerate but valid)
        assert_eq!(rects.len(), 1);
    }
}
