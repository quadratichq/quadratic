//! Sprite primitive
//!
//! Textured rectangles for rendering images and sprite sheets.

use super::Color;
use super::texture::TextureId;
use crate::webgl::WebGLContext;

/// UV coordinates for texture sampling
#[derive(Debug, Clone, Copy)]
pub struct UVRect {
    /// Left edge (0.0-1.0)
    pub u1: f32,
    /// Top edge (0.0-1.0)
    pub v1: f32,
    /// Right edge (0.0-1.0)
    pub u2: f32,
    /// Bottom edge (0.0-1.0)
    pub v2: f32,
}

impl UVRect {
    /// Full texture (0,0 to 1,1)
    pub const FULL: Self = Self {
        u1: 0.0,
        v1: 0.0,
        u2: 1.0,
        v2: 1.0,
    };

    /// Create UV rect from pixel coordinates
    pub fn from_pixels(
        x: u32,
        y: u32,
        width: u32,
        height: u32,
        tex_width: u32,
        tex_height: u32,
    ) -> Self {
        Self {
            u1: x as f32 / tex_width as f32,
            v1: y as f32 / tex_height as f32,
            u2: (x + width) as f32 / tex_width as f32,
            v2: (y + height) as f32 / tex_height as f32,
        }
    }

    /// Create a new UV rect
    pub fn new(u1: f32, v1: f32, u2: f32, v2: f32) -> Self {
        Self { u1, v1, u2, v2 }
    }
}

impl Default for UVRect {
    fn default() -> Self {
        Self::FULL
    }
}

/// A textured sprite (data only, use Sprites for rendering)
#[derive(Debug, Clone, Copy)]
pub struct Sprite {
    /// X position
    pub x: f32,
    /// Y position
    pub y: f32,
    /// Width in pixels
    pub width: f32,
    /// Height in pixels
    pub height: f32,
    /// Texture coordinates
    pub uv: UVRect,
    /// Color tint (multiplied with texture color)
    pub color: Color,
}

impl Sprite {
    /// Create a new sprite with full texture and white tint
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self {
            x,
            y,
            width,
            height,
            uv: UVRect::FULL,
            color: [1.0, 1.0, 1.0, 1.0],
        }
    }

    /// Create a sprite with custom UV coordinates
    pub fn with_uv(x: f32, y: f32, width: f32, height: f32, uv: UVRect) -> Self {
        Self {
            x,
            y,
            width,
            height,
            uv,
            color: [1.0, 1.0, 1.0, 1.0],
        }
    }

    /// Create a sprite with a color tint
    pub fn with_color(x: f32, y: f32, width: f32, height: f32, color: Color) -> Self {
        Self {
            x,
            y,
            width,
            height,
            uv: UVRect::FULL,
            color,
        }
    }

    /// Create a sprite with UV and color
    pub fn with_uv_and_color(
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        uv: UVRect,
        color: Color,
    ) -> Self {
        Self {
            x,
            y,
            width,
            height,
            uv,
            color,
        }
    }
}

/// A batch of sprites for efficient rendering
///
/// All sprites in a batch must use the same texture.
/// Collects sprite vertices and renders them all in one draw call.
pub struct Sprites {
    /// The texture ID for this batch
    texture_id: TextureId,
    /// Vertex data: [x, y, u, v, r, g, b, a, ...] (8 floats per vertex, 6 vertices per sprite)
    vertices: Vec<f32>,
    /// Index data for indexed rendering (optional, for better performance)
    indices: Vec<u16>,
    /// Whether to use indexed rendering
    use_indices: bool,
}

impl Sprites {
    /// Create a new empty sprites batch for a texture
    pub fn new(texture_id: TextureId) -> Self {
        Self {
            texture_id,
            vertices: Vec::new(),
            indices: Vec::new(),
            use_indices: true,
        }
    }

    /// Create with pre-allocated capacity (number of sprites)
    pub fn with_capacity(texture_id: TextureId, sprite_count: usize) -> Self {
        Self {
            texture_id,
            // 8 floats per vertex, 4 vertices per sprite (with indices)
            vertices: Vec::with_capacity(sprite_count * 32),
            // 6 indices per sprite (2 triangles)
            indices: Vec::with_capacity(sprite_count * 6),
            use_indices: true,
        }
    }

    /// Get the texture ID for this batch
    pub fn texture_id(&self) -> TextureId {
        self.texture_id
    }

    /// Add a sprite by coordinates with full texture and white tint
    #[inline]
    pub fn add(&mut self, x: f32, y: f32, width: f32, height: f32) {
        self.add_full(x, y, width, height, UVRect::FULL, [1.0, 1.0, 1.0, 1.0]);
    }

    /// Add a sprite with UV coordinates
    #[inline]
    pub fn add_with_uv(&mut self, x: f32, y: f32, width: f32, height: f32, uv: UVRect) {
        self.add_full(x, y, width, height, uv, [1.0, 1.0, 1.0, 1.0]);
    }

    /// Add a sprite with color tint
    #[inline]
    pub fn add_with_color(&mut self, x: f32, y: f32, width: f32, height: f32, color: Color) {
        self.add_full(x, y, width, height, UVRect::FULL, color);
    }

    /// Add a sprite with all parameters
    #[inline]
    pub fn add_full(&mut self, x: f32, y: f32, width: f32, height: f32, uv: UVRect, color: Color) {
        let x2 = x + width;
        let y2 = y + height;

        if self.use_indices {
            // Indexed rendering: 4 vertices per sprite
            let base_index = (self.vertices.len() / 8) as u16;

            // Vertices: top-left, top-right, bottom-right, bottom-left
            self.vertices.extend_from_slice(&[
                // Top-left
                x, y, uv.u1, uv.v1, color[0], color[1], color[2], color[3], // Top-right
                x2, y, uv.u2, uv.v1, color[0], color[1], color[2], color[3],
                // Bottom-right
                x2, y2, uv.u2, uv.v2, color[0], color[1], color[2], color[3], // Bottom-left
                x, y2, uv.u1, uv.v2, color[0], color[1], color[2], color[3],
            ]);

            // Indices for two triangles
            self.indices.extend_from_slice(&[
                base_index,
                base_index + 1,
                base_index + 2,
                base_index,
                base_index + 2,
                base_index + 3,
            ]);
        } else {
            // Non-indexed: 6 vertices per sprite (2 triangles)
            // Triangle 1: top-left, top-right, bottom-left
            self.vertices.extend_from_slice(&[
                x, y, uv.u1, uv.v1, color[0], color[1], color[2], color[3], x2, y, uv.u2, uv.v1,
                color[0], color[1], color[2], color[3], x, y2, uv.u1, uv.v2, color[0], color[1],
                color[2], color[3],
            ]);
            // Triangle 2: top-right, bottom-right, bottom-left
            self.vertices.extend_from_slice(&[
                x2, y, uv.u2, uv.v1, color[0], color[1], color[2], color[3], x2, y2, uv.u2, uv.v2,
                color[0], color[1], color[2], color[3], x, y2, uv.u1, uv.v2, color[0], color[1],
                color[2], color[3],
            ]);
        }
    }

    /// Add a Sprite struct
    #[inline]
    pub fn push(&mut self, sprite: Sprite) {
        self.add_full(
            sprite.x,
            sprite.y,
            sprite.width,
            sprite.height,
            sprite.uv,
            sprite.color,
        );
    }

    /// Clear all sprites (keeps capacity)
    pub fn clear(&mut self) {
        self.vertices.clear();
        self.indices.clear();
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }

    /// Get number of sprites
    pub fn len(&self) -> usize {
        if self.use_indices {
            self.vertices.len() / 32
        } else {
            self.vertices.len() / 48
        }
    }

    /// Reserve capacity for additional sprites
    pub fn reserve(&mut self, additional: usize) {
        if self.use_indices {
            self.vertices.reserve(additional * 32);
            self.indices.reserve(additional * 6);
        } else {
            self.vertices.reserve(additional * 48);
        }
    }

    /// Get the vertex data
    pub fn vertices(&self) -> &[f32] {
        &self.vertices
    }

    /// Get the index data (if using indexed rendering)
    pub fn indices(&self) -> &[u16] {
        &self.indices
    }

    /// Check if using indexed rendering
    pub fn uses_indices(&self) -> bool {
        self.use_indices
    }

    /// Render all sprites to WebGL in one draw call
    pub fn render(&self, gl: &WebGLContext, matrix: &[f32; 16]) {
        if !self.vertices.is_empty() {
            if self.use_indices {
                gl.draw_sprites_indexed(self.texture_id, &self.vertices, &self.indices, matrix);
            } else {
                gl.draw_sprites(self.texture_id, &self.vertices, matrix);
            }
        }
    }
}

impl Default for Sprites {
    fn default() -> Self {
        Self::new(0)
    }
}
