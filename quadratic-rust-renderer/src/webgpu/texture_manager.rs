//! WebGPU texture storage
//!
//! Backend-specific storage for WebGPU texture handles.

use std::collections::HashMap;
use wasm_bindgen::JsValue;

pub use crate::primitives::{TextureId, TextureInfo};

/// Manages GPU textures for sprite rendering
#[derive(Debug, Default)]
pub struct TextureManager {
    /// Stored textures indexed by TextureId
    textures: HashMap<TextureId, wgpu::Texture>,
    /// Texture views for binding
    texture_views: HashMap<TextureId, wgpu::TextureView>,
    /// Texture metadata
    texture_info: HashMap<TextureId, TextureInfo>,
    /// Next available texture ID for auto-assignment
    next_id: TextureId,
}

impl TextureManager {
    /// Create a new empty texture manager
    pub fn new() -> Self {
        Self {
            textures: HashMap::new(),
            texture_views: HashMap::new(),
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

    /// Upload a texture from raw RGBA pixel data
    pub fn upload_rgba(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        texture_id: TextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Sprite Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
            view_formats: &[],
        });

        queue.write_texture(
            wgpu::ImageCopyTexture {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            data,
            wgpu::ImageDataLayout {
                offset: 0,
                bytes_per_row: Some(width * 4),
                rows_per_image: Some(height),
            },
            wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
        );

        let texture_view = texture.create_view(&wgpu::TextureViewDescriptor::default());

        self.textures.insert(texture_id, texture);
        self.texture_views.insert(texture_id, texture_view);
        self.texture_info
            .insert(texture_id, TextureInfo { width, height });

        log::info!("Uploaded texture {} ({}x{})", texture_id, width, height);

        Ok(())
    }

    /// Check if a texture is loaded
    pub fn has_texture(&self, texture_id: TextureId) -> bool {
        self.textures.contains_key(&texture_id)
    }

    /// Get a texture by ID
    pub fn get(&self, texture_id: TextureId) -> Option<&wgpu::Texture> {
        self.textures.get(&texture_id)
    }

    /// Get a texture view by ID
    pub fn get_view(&self, texture_id: TextureId) -> Option<&wgpu::TextureView> {
        self.texture_views.get(&texture_id)
    }

    /// Get texture info by ID
    pub fn get_info(&self, texture_id: TextureId) -> Option<TextureInfo> {
        self.texture_info.get(&texture_id).copied()
    }

    /// Remove a texture
    pub fn remove(&mut self, texture_id: TextureId) {
        if self.textures.remove(&texture_id).is_some() {
            self.texture_views.remove(&texture_id);
            self.texture_info.remove(&texture_id);
            log::info!("Deleted texture {}", texture_id);
        }
    }

    /// Get the number of loaded textures
    pub fn len(&self) -> usize {
        self.textures.len()
    }

    /// Check if no textures are loaded
    pub fn is_empty(&self) -> bool {
        self.textures.is_empty()
    }

    /// Clear all textures
    pub fn clear(&mut self) {
        self.textures.clear();
        self.texture_views.clear();
        self.texture_info.clear();
        log::info!("Cleared all textures");
    }
}
