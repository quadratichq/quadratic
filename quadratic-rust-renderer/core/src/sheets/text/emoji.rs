//! Emoji sprite data
//!
//! Data structures for rendering emoji as sprites.

use std::collections::HashMap;

/// Cached data for rendering an emoji sprite
#[derive(Debug, Clone)]
pub struct EmojiSpriteData {
    /// X position in world coordinates
    pub x: f32,
    /// Y position in world coordinates
    pub y: f32,
    /// Width in world coordinates
    pub width: f32,
    /// Height in world coordinates
    pub height: f32,
    /// UV coordinates [u0, v0, u1, v1]
    pub uvs: [f32; 4],
}

impl EmojiSpriteData {
    /// Create new emoji sprite data
    pub fn new(x: f32, y: f32, width: f32, height: f32, uvs: [f32; 4]) -> Self {
        Self {
            x,
            y,
            width,
            height,
            uvs,
        }
    }

    /// Generate vertex data for this sprite
    ///
    /// Returns vertices in format [x, y, u, v, r, g, b, a] for 4 vertices
    pub fn to_vertices(&self) -> [f32; 32] {
        let x1 = self.x;
        let y1 = self.y;
        let x2 = self.x + self.width;
        let y2 = self.y + self.height;
        let [u0, v0, u1, v1] = self.uvs;

        // White color (emoji are full color in texture)
        let r = 1.0;
        let g = 1.0;
        let b = 1.0;
        let a = 1.0;

        [
            // Top-left
            x1, y1, u0, v0, r, g, b, a,
            // Top-right
            x2, y1, u1, v0, r, g, b, a,
            // Bottom-right
            x2, y2, u1, v1, r, g, b, a,
            // Bottom-left
            x1, y2, u0, v1, r, g, b, a,
        ]
    }

    /// Generate index data for this sprite (assuming vertex_offset)
    pub fn to_indices(vertex_offset: u32) -> [u32; 6] {
        [
            vertex_offset,
            vertex_offset + 1,
            vertex_offset + 2,
            vertex_offset,
            vertex_offset + 2,
            vertex_offset + 3,
        ]
    }
}

/// Collection of emoji sprites grouped by texture ID
pub type EmojiSpriteCache = HashMap<u32, Vec<EmojiSpriteData>>;

/// Create a new empty emoji sprite cache
pub fn new_emoji_cache() -> EmojiSpriteCache {
    HashMap::new()
}
