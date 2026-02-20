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
            x1, y1, r, g, b, a, x2, y1, r, g, b, a, x2, y2, r, g, b, a,
            // Triangle 2: top-left, bottom-right, bottom-left
            x1, y1, r, g, b, a, x2, y2, r, g, b, a, x1, y2, r, g, b, a,
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

#[cfg(test)]
mod tests {
    use super::*;

    const WHITE: Color = [1.0, 1.0, 1.0, 1.0];
    const RED: Color = [1.0, 0.0, 0.0, 1.0];
    const BLUE: Color = [0.0, 0.0, 1.0, 1.0];
    const TRANSPARENT: Color = [0.5, 0.5, 0.5, 0.5];

    #[test]
    fn test_horizontal_line_new() {
        let line = HorizontalLine::new(10.0, 20.0, 100.0, 2.0, RED);
        assert_eq!(line.x, 10.0);
        assert_eq!(line.y, 20.0);
        assert_eq!(line.width, 100.0);
        assert_eq!(line.height, 2.0);
        assert_eq!(line.color, RED);
    }

    #[test]
    fn test_horizontal_line_clone() {
        let line = HorizontalLine::new(5.0, 15.0, 50.0, 3.0, BLUE);
        let cloned = line;
        assert_eq!(cloned.x, 5.0);
        assert_eq!(cloned.y, 15.0);
        assert_eq!(cloned.width, 50.0);
        assert_eq!(cloned.height, 3.0);
        assert_eq!(cloned.color, BLUE);
    }

    #[test]
    fn test_horizontal_line_copy() {
        let line1 = HorizontalLine::new(0.0, 0.0, 10.0, 1.0, WHITE);
        let line2 = line1;
        // Both should have the same values
        assert_eq!(line1.x, line2.x);
        assert_eq!(line1.y, line2.y);
        assert_eq!(line1.width, line2.width);
        assert_eq!(line1.height, line2.height);
        assert_eq!(line1.color, line2.color);
    }

    #[test]
    fn test_to_triangle_vertices_basic() {
        let line = HorizontalLine::new(0.0, 0.0, 10.0, 2.0, RED);
        let vertices = line.to_triangle_vertices();

        // Should return exactly 36 floats (6 vertices × 6 floats)
        assert_eq!(vertices.len(), 36);

        // Triangle 1: top-left, top-right, bottom-right
        // Vertex 1: top-left (x1, y1)
        assert_eq!(vertices[0], 0.0); // x
        assert_eq!(vertices[1], 0.0); // y
        assert_eq!(vertices[2], 1.0); // r
        assert_eq!(vertices[3], 0.0); // g
        assert_eq!(vertices[4], 0.0); // b
        assert_eq!(vertices[5], 1.0); // a

        // Vertex 2: top-right (x2, y1)
        assert_eq!(vertices[6], 10.0); // x
        assert_eq!(vertices[7], 0.0); // y
        assert_eq!(vertices[8], 1.0); // r
        assert_eq!(vertices[9], 0.0); // g
        assert_eq!(vertices[10], 0.0); // b
        assert_eq!(vertices[11], 1.0); // a

        // Vertex 3: bottom-right (x2, y2)
        assert_eq!(vertices[12], 10.0); // x
        assert_eq!(vertices[13], 2.0); // y
        assert_eq!(vertices[14], 1.0); // r
        assert_eq!(vertices[15], 0.0); // g
        assert_eq!(vertices[16], 0.0); // b
        assert_eq!(vertices[17], 1.0); // a

        // Triangle 2: top-left, bottom-right, bottom-left
        // Vertex 4: top-left (x1, y1) - same as vertex 1
        assert_eq!(vertices[18], 0.0); // x
        assert_eq!(vertices[19], 0.0); // y

        // Vertex 5: bottom-right (x2, y2) - same as vertex 3
        assert_eq!(vertices[24], 10.0); // x
        assert_eq!(vertices[25], 2.0); // y

        // Vertex 6: bottom-left (x1, y2)
        assert_eq!(vertices[30], 0.0); // x
        assert_eq!(vertices[31], 2.0); // y
    }

    #[test]
    fn test_to_triangle_vertices_offset_position() {
        let line = HorizontalLine::new(5.0, 10.0, 20.0, 3.0, BLUE);
        let vertices = line.to_triangle_vertices();

        // Check that positions are correctly offset
        assert_eq!(vertices[0], 5.0); // x1
        assert_eq!(vertices[1], 10.0); // y1
        assert_eq!(vertices[6], 25.0); // x2 = x1 + width
        assert_eq!(vertices[7], 10.0); // y1
        assert_eq!(vertices[12], 25.0); // x2
        assert_eq!(vertices[13], 13.0); // y2 = y1 + height
    }

    #[test]
    fn test_to_triangle_vertices_color() {
        let line = HorizontalLine::new(0.0, 0.0, 10.0, 1.0, TRANSPARENT);
        let vertices = line.to_triangle_vertices();

        // All vertices should have the same color
        for i in 0..6 {
            let base = i * 6;
            assert_eq!(vertices[base + 2], 0.5); // r
            assert_eq!(vertices[base + 3], 0.5); // g
            assert_eq!(vertices[base + 4], 0.5); // b
            assert_eq!(vertices[base + 5], 0.5); // a
        }
    }

    #[test]
    fn test_to_triangle_vertices_zero_width() {
        let line = HorizontalLine::new(10.0, 20.0, 0.0, 2.0, RED);
        let vertices = line.to_triangle_vertices();

        // x1 and x2 should be the same
        assert_eq!(vertices[0], 10.0);
        assert_eq!(vertices[6], 10.0);
        assert_eq!(vertices[12], 10.0);
        assert_eq!(vertices[30], 10.0);
    }

    #[test]
    fn test_to_triangle_vertices_zero_height() {
        let line = HorizontalLine::new(10.0, 20.0, 100.0, 0.0, RED);
        let vertices = line.to_triangle_vertices();

        // y1 and y2 should be the same
        assert_eq!(vertices[1], 20.0);
        assert_eq!(vertices[7], 20.0);
        assert_eq!(vertices[13], 20.0);
        assert_eq!(vertices[31], 20.0);
    }

    #[test]
    fn test_lines_to_vertices_empty() {
        let lines: &[HorizontalLine] = &[];
        let vertices = lines_to_vertices(lines);
        assert!(vertices.is_empty());
    }

    #[test]
    fn test_lines_to_vertices_single() {
        let line = HorizontalLine::new(0.0, 0.0, 10.0, 2.0, RED);
        let lines = &[line];
        let vertices = lines_to_vertices(lines);

        assert_eq!(vertices.len(), 36);
        // Should match the single line's vertices
        let single_vertices = line.to_triangle_vertices();
        assert_eq!(vertices, single_vertices);
    }

    #[test]
    fn test_lines_to_vertices_multiple() {
        let line1 = HorizontalLine::new(0.0, 0.0, 10.0, 2.0, RED);
        let line2 = HorizontalLine::new(20.0, 5.0, 15.0, 1.0, BLUE);
        let line3 = HorizontalLine::new(50.0, 10.0, 5.0, 3.0, WHITE);
        let lines = &[line1, line2, line3];
        let vertices = lines_to_vertices(lines);

        // Should have 3 lines × 36 floats = 108 floats
        assert_eq!(vertices.len(), 108);

        // First 36 floats should match line1
        let line1_vertices = line1.to_triangle_vertices();
        assert_eq!(&vertices[0..36], &line1_vertices[..]);

        // Next 36 floats should match line2
        let line2_vertices = line2.to_triangle_vertices();
        assert_eq!(&vertices[36..72], &line2_vertices[..]);

        // Last 36 floats should match line3
        let line3_vertices = line3.to_triangle_vertices();
        assert_eq!(&vertices[72..108], &line3_vertices[..]);
    }

    #[test]
    fn test_lines_to_vertices_capacity() {
        let line1 = HorizontalLine::new(0.0, 0.0, 10.0, 2.0, RED);
        let line2 = HorizontalLine::new(20.0, 5.0, 15.0, 1.0, BLUE);
        let lines = &[line1, line2];
        let vertices = lines_to_vertices(lines);

        // The function pre-allocates capacity, so we can't directly test it,
        // but we can verify the result is correct
        assert_eq!(vertices.len(), 72);
        assert_eq!(vertices.capacity(), 72); // Should be exactly the needed capacity
    }
}
