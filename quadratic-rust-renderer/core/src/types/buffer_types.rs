//! Buffer types for GPU upload
//!
//! These types are designed to be passed directly as ArrayBuffer/Float32Array
//! via `postMessage` with Transferable objects. No serialization needed.

use bincode::{Decode, Encode};
use serde::{Deserialize, Serialize};

/// Text buffer ready for GPU upload
/// Vertices: [x, y, u, v, r, g, b, a] per vertex (8 floats)
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct TextBuffer {
    pub texture_uid: u32,
    pub font_size: f32,
    /// Vertex data: x, y, u, v, r, g, b, a per vertex
    pub vertices: Vec<f32>,
    /// Index data for indexed drawing
    pub indices: Vec<u32>,
}

impl TextBuffer {
    pub fn new(texture_uid: u32, font_size: f32) -> Self {
        Self {
            texture_uid,
            font_size,
            vertices: Vec::new(),
            indices: Vec::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Get vertex count (each vertex is 8 floats)
    pub fn vertex_count(&self) -> usize {
        self.vertices.len() / 8
    }
}

/// Fill/rectangle buffer
/// Vertices: [x, y, r, g, b, a] per vertex (6 floats, triangles)
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct FillBuffer {
    /// Vertex data: x, y, r, g, b, a per vertex (triangles)
    pub vertices: Vec<f32>,
}

impl FillBuffer {
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Reserve space for N rectangles (each rect = 2 triangles = 6 vertices)
    pub fn reserve(&mut self, rect_count: usize) {
        self.vertices.reserve(rect_count * 6 * 6); // 6 vertices * 6 floats
    }

    /// Add a colored rectangle as two triangles
    pub fn add_rect(&mut self, x: f32, y: f32, width: f32, height: f32, color: [f32; 4]) {
        let x2 = x + width;
        let y2 = y + height;
        let [r, g, b, a] = color;

        // Triangle 1: top-left, top-right, bottom-right
        self.vertices.extend_from_slice(&[x, y, r, g, b, a]);
        self.vertices.extend_from_slice(&[x2, y, r, g, b, a]);
        self.vertices.extend_from_slice(&[x2, y2, r, g, b, a]);

        // Triangle 2: top-left, bottom-right, bottom-left
        self.vertices.extend_from_slice(&[x, y, r, g, b, a]);
        self.vertices.extend_from_slice(&[x2, y2, r, g, b, a]);
        self.vertices.extend_from_slice(&[x, y2, r, g, b, a]);
    }
}

/// Line buffer for grid lines, borders, etc.
/// Vertices: [x, y, r, g, b, a] per vertex (6 floats, lines)
#[derive(Debug, Clone, Default, Serialize, Deserialize, Encode, Decode)]
pub struct LineBuffer {
    /// Vertex data: x, y, r, g, b, a per vertex (line pairs)
    pub vertices: Vec<f32>,
}

impl LineBuffer {
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Add a line segment
    pub fn add_line(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, color: [f32; 4]) {
        let [r, g, b, a] = color;
        self.vertices.extend_from_slice(&[x1, y1, r, g, b, a]);
        self.vertices.extend_from_slice(&[x2, y2, r, g, b, a]);
    }
}

/// Horizontal line data (underline/strikethrough)
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct HorizontalLineData {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub color: [f32; 4],
}

/// Emoji sprite instance data
#[derive(Debug, Clone, Serialize, Deserialize, Encode, Decode)]
pub struct EmojiSpriteData {
    /// X position (center) in world coordinates
    pub x: f32,
    /// Y position (center) in world coordinates
    pub y: f32,
    /// Width in world coordinates
    pub width: f32,
    /// Height in world coordinates
    pub height: f32,
    /// UV coordinates [u0, v0, u1, v1]
    pub uvs: [f32; 4],
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // TextBuffer tests
    // =========================================================================

    #[test]
    fn test_text_buffer_new() {
        let buffer = TextBuffer::new(1, 32.0);
        assert_eq!(buffer.texture_uid, 1);
        assert_eq!(buffer.font_size, 32.0);
        assert!(buffer.is_empty());
        assert_eq!(buffer.vertex_count(), 0);
    }

    #[test]
    fn test_text_buffer_default() {
        let buffer = TextBuffer::default();
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_text_buffer_vertex_count() {
        let mut buffer = TextBuffer::new(1, 32.0);
        // 8 floats per vertex
        buffer.vertices = vec![0.0; 8 * 4]; // 4 vertices
        assert_eq!(buffer.vertex_count(), 4);
    }

    // =========================================================================
    // FillBuffer tests
    // =========================================================================

    #[test]
    fn test_fill_buffer_new() {
        let buffer = FillBuffer::new();
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_fill_buffer_default() {
        let buffer = FillBuffer::default();
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_fill_buffer_add_rect() {
        let mut buffer = FillBuffer::new();
        buffer.add_rect(10.0, 20.0, 100.0, 50.0, [1.0, 0.0, 0.0, 1.0]);

        assert!(!buffer.is_empty());
        // 2 triangles * 3 vertices * 6 floats = 36 floats
        assert_eq!(buffer.vertices.len(), 36);
    }

    #[test]
    fn test_fill_buffer_reserve() {
        let mut buffer = FillBuffer::new();
        buffer.reserve(10);
        // Should have capacity but still be empty
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_fill_buffer_multiple_rects() {
        let mut buffer = FillBuffer::new();
        buffer.add_rect(0.0, 0.0, 100.0, 50.0, [1.0, 1.0, 1.0, 1.0]);
        buffer.add_rect(100.0, 0.0, 100.0, 50.0, [0.0, 0.0, 1.0, 1.0]);

        // 2 rects * 36 floats = 72 floats
        assert_eq!(buffer.vertices.len(), 72);
    }

    #[test]
    fn test_fill_buffer_vertex_format() {
        let mut buffer = FillBuffer::new();
        buffer.add_rect(10.0, 20.0, 100.0, 50.0, [0.5, 0.6, 0.7, 0.8]);

        let v = &buffer.vertices;

        // First vertex: x, y, r, g, b, a
        assert_eq!(v[0], 10.0);
        assert_eq!(v[1], 20.0);
        assert_eq!(v[2], 0.5);
        assert_eq!(v[3], 0.6);
        assert_eq!(v[4], 0.7);
        assert_eq!(v[5], 0.8);
    }

    // =========================================================================
    // LineBuffer tests
    // =========================================================================

    #[test]
    fn test_line_buffer_new() {
        let buffer = LineBuffer::new();
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_line_buffer_default() {
        let buffer = LineBuffer::default();
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_line_buffer_add_line() {
        let mut buffer = LineBuffer::new();
        buffer.add_line(0.0, 0.0, 100.0, 100.0, [1.0, 1.0, 1.0, 1.0]);

        assert!(!buffer.is_empty());
        // 2 vertices * 6 floats = 12 floats
        assert_eq!(buffer.vertices.len(), 12);
    }

    #[test]
    fn test_line_buffer_multiple_lines() {
        let mut buffer = LineBuffer::new();
        buffer.add_line(0.0, 0.0, 100.0, 0.0, [1.0, 1.0, 1.0, 1.0]);
        buffer.add_line(0.0, 0.0, 0.0, 100.0, [1.0, 0.0, 0.0, 1.0]);
        buffer.add_line(100.0, 0.0, 100.0, 100.0, [0.0, 1.0, 0.0, 1.0]);

        // 3 lines * 12 floats = 36 floats
        assert_eq!(buffer.vertices.len(), 36);
    }

    #[test]
    fn test_line_buffer_vertex_format() {
        let mut buffer = LineBuffer::new();
        buffer.add_line(10.0, 20.0, 30.0, 40.0, [0.5, 0.6, 0.7, 0.8]);

        let v = &buffer.vertices;

        // First vertex: x1, y1, r, g, b, a
        assert_eq!(v[0], 10.0);
        assert_eq!(v[1], 20.0);
        assert_eq!(v[2], 0.5);
        assert_eq!(v[3], 0.6);
        assert_eq!(v[4], 0.7);
        assert_eq!(v[5], 0.8);

        // Second vertex: x2, y2, r, g, b, a
        assert_eq!(v[6], 30.0);
        assert_eq!(v[7], 40.0);
        assert_eq!(v[8], 0.5);
        assert_eq!(v[9], 0.6);
        assert_eq!(v[10], 0.7);
        assert_eq!(v[11], 0.8);
    }

    // =========================================================================
    // HorizontalLineData tests
    // =========================================================================

    #[test]
    fn test_horizontal_line_data() {
        let line = HorizontalLineData {
            x: 10.0,
            y: 20.0,
            width: 100.0,
            height: 2.0,
            color: [1.0, 0.0, 0.0, 1.0],
        };

        assert_eq!(line.x, 10.0);
        assert_eq!(line.y, 20.0);
        assert_eq!(line.width, 100.0);
        assert_eq!(line.height, 2.0);
    }

    // =========================================================================
    // EmojiSpriteData tests
    // =========================================================================

    #[test]
    fn test_emoji_sprite_data() {
        let sprite = EmojiSpriteData {
            x: 50.0,
            y: 100.0,
            width: 20.0,
            height: 20.0,
            uvs: [0.0, 0.0, 1.0, 1.0],
        };

        assert_eq!(sprite.x, 50.0);
        assert_eq!(sprite.y, 100.0);
        assert_eq!(sprite.width, 20.0);
        assert_eq!(sprite.height, 20.0);
        assert_eq!(sprite.uvs, [0.0, 0.0, 1.0, 1.0]);
    }
}
