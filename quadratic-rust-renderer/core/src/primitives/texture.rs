//! Texture types and registry
//!
//! Shared types for texture management across rendering backends.

use std::collections::HashMap;

/// Unique identifier for a texture
pub type TextureId = u32;

/// Texture metadata
#[derive(Debug, Clone, Copy)]
pub struct TextureInfo {
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
}

/// Backend-agnostic texture registry
///
/// Stores texture metadata and provides ID generation.
/// Backend-specific texture handles are stored separately by each renderer.
pub struct TextureRegistry {
    /// Texture metadata indexed by TextureId
    texture_info: HashMap<TextureId, TextureInfo>,
    /// Next available texture ID for auto-assignment
    next_id: TextureId,
}

impl TextureRegistry {
    /// Create a new empty texture registry
    pub fn new() -> Self {
        Self {
            texture_info: HashMap::new(),
            next_id: 1, // Start at 1 so 0 can be reserved/invalid
        }
    }

    /// Generate a new unique texture ID
    pub fn generate_id(&mut self) -> TextureId {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    /// Register a texture with its metadata
    pub fn register(&mut self, texture_id: TextureId, width: u32, height: u32) {
        self.texture_info
            .insert(texture_id, TextureInfo { width, height });
    }

    /// Check if a texture is registered
    pub fn has_texture(&self, texture_id: TextureId) -> bool {
        self.texture_info.contains_key(&texture_id)
    }

    /// Get texture info by ID
    pub fn get_info(&self, texture_id: TextureId) -> Option<TextureInfo> {
        self.texture_info.get(&texture_id).copied()
    }

    /// Unregister a texture
    pub fn unregister(&mut self, texture_id: TextureId) -> bool {
        self.texture_info.remove(&texture_id).is_some()
    }

    /// Get the number of registered textures
    pub fn len(&self) -> usize {
        self.texture_info.len()
    }

    /// Check if no textures are registered
    pub fn is_empty(&self) -> bool {
        self.texture_info.is_empty()
    }

    /// Clear all texture registrations
    pub fn clear(&mut self) {
        self.texture_info.clear();
    }
}

impl Default for TextureRegistry {
    fn default() -> Self {
        Self::new()
    }
}
