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
            x1, y1, u0, v0, r, g, b, a, // Top-right
            x2, y1, u1, v0, r, g, b, a, // Bottom-right
            x2, y2, u1, v1, r, g, b, a, // Bottom-left
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_emoji_sprite_data_new() {
        let sprite = EmojiSpriteData::new(10.0, 20.0, 100.0, 50.0, [0.0, 0.1, 0.5, 0.6]);
        assert_eq!(sprite.x, 10.0);
        assert_eq!(sprite.y, 20.0);
        assert_eq!(sprite.width, 100.0);
        assert_eq!(sprite.height, 50.0);
        assert_eq!(sprite.uvs, [0.0, 0.1, 0.5, 0.6]);
    }

    #[test]
    fn test_emoji_sprite_data_new_zero_values() {
        let sprite = EmojiSpriteData::new(0.0, 0.0, 0.0, 0.0, [0.0, 0.0, 0.0, 0.0]);
        assert_eq!(sprite.x, 0.0);
        assert_eq!(sprite.y, 0.0);
        assert_eq!(sprite.width, 0.0);
        assert_eq!(sprite.height, 0.0);
        assert_eq!(sprite.uvs, [0.0, 0.0, 0.0, 0.0]);
    }

    #[test]
    fn test_emoji_sprite_data_new_negative_values() {
        let sprite = EmojiSpriteData::new(-10.0, -20.0, 100.0, 50.0, [0.0, 0.0, 1.0, 1.0]);
        assert_eq!(sprite.x, -10.0);
        assert_eq!(sprite.y, -20.0);
        assert_eq!(sprite.width, 100.0);
        assert_eq!(sprite.height, 50.0);
    }

    #[test]
    fn test_emoji_sprite_data_clone() {
        let sprite = EmojiSpriteData::new(10.0, 20.0, 100.0, 50.0, [0.0, 0.1, 0.5, 0.6]);
        let cloned = sprite.clone();
        assert_eq!(cloned.x, sprite.x);
        assert_eq!(cloned.y, sprite.y);
        assert_eq!(cloned.width, sprite.width);
        assert_eq!(cloned.height, sprite.height);
        assert_eq!(cloned.uvs, sprite.uvs);
    }

    #[test]
    fn test_to_vertices() {
        let sprite = EmojiSpriteData::new(10.0, 20.0, 100.0, 50.0, [0.0, 0.1, 0.5, 0.6]);
        let vertices = sprite.to_vertices();

        // Expected format: [x, y, u, v, r, g, b, a] for 4 vertices = 32 floats
        assert_eq!(vertices.len(), 32);

        // Top-left vertex: x1, y1, u0, v0, r, g, b, a
        assert_eq!(vertices[0], 10.0); // x1
        assert_eq!(vertices[1], 20.0); // y1
        assert_eq!(vertices[2], 0.0); // u0
        assert_eq!(vertices[3], 0.1); // v0
        assert_eq!(vertices[4], 1.0); // r
        assert_eq!(vertices[5], 1.0); // g
        assert_eq!(vertices[6], 1.0); // b
        assert_eq!(vertices[7], 1.0); // a

        // Top-right vertex: x2, y1, u1, v0, r, g, b, a
        assert_eq!(vertices[8], 110.0); // x2 = x + width
        assert_eq!(vertices[9], 20.0); // y1
        assert_eq!(vertices[10], 0.5); // u1
        assert_eq!(vertices[11], 0.1); // v0
        assert_eq!(vertices[12], 1.0); // r
        assert_eq!(vertices[13], 1.0); // g
        assert_eq!(vertices[14], 1.0); // b
        assert_eq!(vertices[15], 1.0); // a

        // Bottom-right vertex: x2, y2, u1, v1, r, g, b, a
        assert_eq!(vertices[16], 110.0); // x2
        assert_eq!(vertices[17], 70.0); // y2 = y + height
        assert_eq!(vertices[18], 0.5); // u1
        assert_eq!(vertices[19], 0.6); // v1
        assert_eq!(vertices[20], 1.0); // r
        assert_eq!(vertices[21], 1.0); // g
        assert_eq!(vertices[22], 1.0); // b
        assert_eq!(vertices[23], 1.0); // a

        // Bottom-left vertex: x1, y2, u0, v1, r, g, b, a
        assert_eq!(vertices[24], 10.0); // x1
        assert_eq!(vertices[25], 70.0); // y2
        assert_eq!(vertices[26], 0.0); // u0
        assert_eq!(vertices[27], 0.6); // v1
        assert_eq!(vertices[28], 1.0); // r
        assert_eq!(vertices[29], 1.0); // g
        assert_eq!(vertices[30], 1.0); // b
        assert_eq!(vertices[31], 1.0); // a
    }

    #[test]
    fn test_to_vertices_zero_size() {
        let sprite = EmojiSpriteData::new(10.0, 20.0, 0.0, 0.0, [0.0, 0.0, 1.0, 1.0]);
        let vertices = sprite.to_vertices();

        // Top-left and top-right should have same x
        assert_eq!(vertices[0], 10.0); // x1
        assert_eq!(vertices[8], 10.0); // x2 = x + 0

        // Top-left and bottom-left should have same y
        assert_eq!(vertices[1], 20.0); // y1
        assert_eq!(vertices[25], 20.0); // y2 = y + 0
    }

    #[test]
    fn test_to_vertices_negative_position() {
        let sprite = EmojiSpriteData::new(-10.0, -20.0, 100.0, 50.0, [0.0, 0.0, 1.0, 1.0]);
        let vertices = sprite.to_vertices();

        assert_eq!(vertices[0], -10.0); // x1
        assert_eq!(vertices[1], -20.0); // y1
        assert_eq!(vertices[8], 90.0); // x2 = -10 + 100
        assert_eq!(vertices[17], 30.0); // y2 = -20 + 50
    }

    #[test]
    fn test_to_vertices_color_always_white() {
        let sprite1 = EmojiSpriteData::new(0.0, 0.0, 10.0, 10.0, [0.0, 0.0, 1.0, 1.0]);
        let sprite2 = EmojiSpriteData::new(100.0, 200.0, 50.0, 75.0, [0.2, 0.3, 0.8, 0.9]);

        let vertices1 = sprite1.to_vertices();
        let vertices2 = sprite2.to_vertices();

        // All color components should be 1.0 (white) for both sprites
        for i in 0..4 {
            let base = i * 8;
            assert_eq!(vertices1[base + 4], 1.0); // r
            assert_eq!(vertices1[base + 5], 1.0); // g
            assert_eq!(vertices1[base + 6], 1.0); // b
            assert_eq!(vertices1[base + 7], 1.0); // a

            assert_eq!(vertices2[base + 4], 1.0); // r
            assert_eq!(vertices2[base + 5], 1.0); // g
            assert_eq!(vertices2[base + 6], 1.0); // b
            assert_eq!(vertices2[base + 7], 1.0); // a
        }
    }

    #[test]
    fn test_to_indices_zero_offset() {
        let indices = EmojiSpriteData::to_indices(0);

        // Expected: two triangles forming a quad
        // Triangle 1: 0, 1, 2
        // Triangle 2: 0, 2, 3
        assert_eq!(indices, [0, 1, 2, 0, 2, 3]);
    }

    #[test]
    fn test_to_indices_with_offset() {
        let indices = EmojiSpriteData::to_indices(10);

        // Should offset all indices by 10
        assert_eq!(indices, [10, 11, 12, 10, 12, 13]);
    }

    #[test]
    fn test_to_indices_large_offset() {
        let indices = EmojiSpriteData::to_indices(1000);
        assert_eq!(indices, [1000, 1001, 1002, 1000, 1002, 1003]);
    }

    #[test]
    fn test_to_indices_max_offset() {
        let indices = EmojiSpriteData::to_indices(u32::MAX - 3);
        // Should handle large offsets correctly (though this would overflow in practice)
        assert_eq!(indices[0], u32::MAX - 3);
        assert_eq!(indices[1], u32::MAX - 2);
        assert_eq!(indices[2], u32::MAX - 1);
    }

    #[test]
    fn test_new_emoji_cache() {
        let cache = new_emoji_cache();
        assert!(cache.is_empty());
        assert_eq!(cache.len(), 0);
    }

    #[test]
    fn test_emoji_sprite_cache_usage() {
        let mut cache = new_emoji_cache();

        let sprite1 = EmojiSpriteData::new(0.0, 0.0, 10.0, 10.0, [0.0, 0.0, 1.0, 1.0]);
        let sprite2 = EmojiSpriteData::new(10.0, 10.0, 10.0, 10.0, [0.0, 0.0, 1.0, 1.0]);

        cache.insert(1, vec![sprite1.clone()]);
        cache.insert(2, vec![sprite2.clone()]);

        assert_eq!(cache.len(), 2);
        assert_eq!(cache.get(&1).unwrap().len(), 1);
        assert_eq!(cache.get(&2).unwrap().len(), 1);

        // Add another sprite to texture 1
        cache.get_mut(&1).unwrap().push(sprite2);
        assert_eq!(cache.get(&1).unwrap().len(), 2);
    }
}
