//! SpriteCache - sprite caching for zoomed-out text rendering
//!
//! At low zoom levels, rendering individual MSDF glyphs becomes expensive.
//! Instead, we pre-render each hash's text to a texture ("sprite") and
//! display that texture with mipmaps for smooth scaling.
//!
//! This module only handles the sprite caching. The actual text data
//! comes from HashRenderData received from the layout worker.
//!
//! NOTE: Sprite caching is currently disabled during the renderer refactor.
//! The cache management is preserved, but offscreen rendering is stubbed out.
//! This can be reimplemented using core's render-to-texture capabilities.

use std::collections::HashMap;

use quadratic_renderer_core::{HashRenderData, TextBuffer};

/// Scale threshold below which we switch from MSDF text to sprite rendering.
pub const SPRITE_SCALE_THRESHOLD: f32 = 0.25;

/// Sprite cache entry for a single hash
pub struct HashSpriteCache {
    /// Hash coordinates
    pub hash_x: i64,
    pub hash_y: i64,

    /// World bounds for positioning
    pub world_x: f32,
    pub world_y: f32,
    pub world_width: f32,
    pub world_height: f32,

    /// Whether the sprite needs to be regenerated
    pub dirty: bool,

    // Note: Render targets removed during refactor
    // sprite_cache: Option<RenderTarget>,
    // sprite_cache_webgpu: Option<WebGPURenderTarget>,
}

impl HashSpriteCache {
    /// Create a new sprite cache entry from HashRenderData
    pub fn new(data: &HashRenderData) -> Self {
        Self {
            hash_x: data.hash_x,
            hash_y: data.hash_y,
            world_x: data.world_x,
            world_y: data.world_y,
            world_width: data.world_width,
            world_height: data.world_height,
            dirty: true,
        }
    }

    /// Update bounds from new HashRenderData
    pub fn update_bounds(&mut self, data: &HashRenderData) {
        if self.world_x != data.world_x
            || self.world_y != data.world_y
            || self.world_width != data.world_width
            || self.world_height != data.world_height
        {
            self.world_x = data.world_x;
            self.world_y = data.world_y;
            self.world_width = data.world_width;
            self.world_height = data.world_height;
            self.dirty = true;
        }
    }

    /// Mark sprite as dirty (needs rebuild)
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    /// Check if sprite is dirty
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    /// Check if this should use sprite rendering at the given scale
    pub fn should_use_sprite(&self, user_scale: f32) -> bool {
        user_scale < SPRITE_SCALE_THRESHOLD
    }

    /// Rebuild sprite if dirty (WebGPU) - STUBBED OUT
    ///
    /// NOTE: This is currently a no-op during the renderer refactor.
    /// Sprite caching will be reimplemented using core's render-to-texture.
    pub fn rebuild_sprite_webgpu(
        &mut self,
        _ctx: &mut quadratic_renderer_core::wgpu_backend::WgpuRenderContext,
        _text_buffers: &[TextBuffer],
        _horizontal_lines: Option<&Vec<quadratic_renderer_core::HorizontalLineData>>,
        _atlas_font_size: f32,
        _distance_range: f32,
    ) {
        // Sprite caching disabled during refactor
        self.dirty = false;
    }

    /// Check if sprite is ready for rendering
    pub fn has_sprite(&self) -> bool {
        // Sprite caching disabled during refactor
        false
    }

    /// Get world bounds for positioning sprite quad
    pub fn world_bounds(&self) -> (f32, f32, f32, f32) {
        (self.world_x, self.world_y, self.world_width, self.world_height)
    }
}

/// Sprite cache manager
pub struct SpriteCacheManager {
    /// Cache entries by hash coordinates
    caches: HashMap<(i64, i64), HashSpriteCache>,
}

impl Default for SpriteCacheManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SpriteCacheManager {
    /// Create new sprite cache manager
    pub fn new() -> Self {
        Self {
            caches: HashMap::new(),
        }
    }

    /// Get or create cache entry for a hash
    pub fn get_or_create(&mut self, hash_x: i64, hash_y: i64, data: &HashRenderData) -> &mut HashSpriteCache {
        self.caches
            .entry((hash_x, hash_y))
            .or_insert_with(|| HashSpriteCache::new(data))
    }

    /// Update cache from hash render data
    pub fn update_from_hash_data(&mut self, data: &HashRenderData) {
        if let Some(cache) = self.caches.get_mut(&(data.hash_x, data.hash_y)) {
            cache.update_bounds(data);
        } else {
            self.caches
                .insert((data.hash_x, data.hash_y), HashSpriteCache::new(data));
        }
    }

    /// Get cache entry for a hash
    pub fn get(&self, hash_x: i64, hash_y: i64) -> Option<&HashSpriteCache> {
        self.caches.get(&(hash_x, hash_y))
    }

    /// Get mutable cache entry for a hash
    pub fn get_mut(&mut self, hash_x: i64, hash_y: i64) -> Option<&mut HashSpriteCache> {
        self.caches.get_mut(&(hash_x, hash_y))
    }

    /// Clear all caches
    pub fn clear(&mut self) {
        self.caches.clear();
    }

    /// Mark all caches as dirty
    pub fn mark_all_dirty(&mut self) {
        for cache in self.caches.values_mut() {
            cache.mark_dirty();
        }
    }
}
