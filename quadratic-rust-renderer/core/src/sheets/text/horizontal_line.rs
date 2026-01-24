//! Horizontal line data for text decorations
//!
//! Used for underline and strikethrough rendering.

use crate::primitives::Color;

/// A horizontal line (underline or strikethrough)
#[derive(Debug, Clone, Copy)]
pub struct HorizontalLine {
    /// X position in world coordinates
    pub x: f32,
    /// Y position in world coordinates
    pub y: f32,
    /// Width in world coordinates
    pub width: f32,
    /// Height (thickness) in world coordinates
    pub height: f32,
    /// Color [r, g, b, a]
    pub color: Color,
}

impl HorizontalLine {
    /// Create a new horizontal line
    pub fn new(x: f32, y: f32, width: f32, height: f32, color: Color) -> Self {
        Self {
            x,
            y,
            width,
            height,
            color,
        }
    }

    /// Generate vertex data for this line as two triangles
    ///
    /// Returns 36 floats: 6 vertices × 6 floats [x, y, r, g, b, a]
    pub fn to_triangle_vertices(&self) -> [f32; 36] {
        let x1 = self.x;
        let y1 = self.y;
        let x2 = self.x + self.width;
        let y2 = self.y + self.height;
        let [r, g, b, a] = self.color;

        [
            // Triangle 1: top-left, top-right, bottom-right
            x1, y1, r, g, b, a,
            x2, y1, r, g, b, a,
            x2, y2, r, g, b, a,
            // Triangle 2: top-left, bottom-right, bottom-left
            x1, y1, r, g, b, a,
            x2, y2, r, g, b, a,
            x1, y2, r, g, b, a,
        ]
    }
}

/// Convert a slice of horizontal lines to triangle vertex data
pub fn lines_to_vertices(lines: &[HorizontalLine]) -> Vec<f32> {
    let mut vertices = Vec::with_capacity(lines.len() * 36);
    for line in lines {
        vertices.extend_from_slice(&line.to_triangle_vertices());
    }
    vertices
}
