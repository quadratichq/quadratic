//! Buffer types for zero-copy transfer between workers
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
