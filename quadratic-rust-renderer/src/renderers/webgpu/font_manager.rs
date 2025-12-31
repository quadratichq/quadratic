//! WebGPU font texture storage
//!
//! Backend-specific storage for WebGPU font texture handles.

use std::collections::HashMap;

#[cfg(feature = "wasm")]
use wasm_bindgen::JsValue;

pub use super::super::primitives::{FontTextureId, FontTextureInfo};

/// Error type for font texture operations (cross-platform)
#[cfg(not(feature = "wasm"))]
pub type FontTextureError = String;
#[cfg(feature = "wasm")]
pub type FontTextureError = JsValue;

/// Manages WebGPU textures for font rendering
///
/// Unlike sprite textures, font textures also cache bind groups
/// because MSDF text rendering uses a different shader and bind group layout.
pub struct FontManager {
    /// Stored textures indexed by FontTextureId
    textures: HashMap<FontTextureId, wgpu::Texture>,
    /// Texture views for binding
    texture_views: HashMap<FontTextureId, wgpu::TextureView>,
    /// Bind groups for text rendering
    bind_groups: HashMap<FontTextureId, wgpu::BindGroup>,
    /// Texture metadata
    texture_info: HashMap<FontTextureId, FontTextureInfo>,
}

impl Default for FontManager {
    fn default() -> Self {
        Self::new()
    }
}

impl FontManager {
    /// Create a new empty font texture manager
    pub fn new() -> Self {
        Self {
            textures: HashMap::new(),
            texture_views: HashMap::new(),
            bind_groups: HashMap::new(),
            texture_info: HashMap::new(),
        }
    }

    /// Upload a texture from raw RGBA pixel data
    ///
    /// This creates the texture and texture view, but does NOT create the bind group.
    /// Call `create_bind_group` after uploading to create the bind group.
    pub fn upload_rgba(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        texture_id: FontTextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), FontTextureError> {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Font Texture"),
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
            .insert(texture_id, FontTextureInfo { width, height });

        log::info!(
            "Uploaded font texture {} ({}x{})",
            texture_id,
            width,
            height
        );

        Ok(())
    }

    /// Create a bind group for the given texture
    ///
    /// This must be called after `upload_rgba` to create the bind group
    /// needed for rendering.
    pub fn create_bind_group(
        &mut self,
        device: &wgpu::Device,
        texture_id: FontTextureId,
        bind_group_layout: &wgpu::BindGroupLayout,
        uniform_buffer: &wgpu::Buffer,
        sampler: &wgpu::Sampler,
    ) -> bool {
        let texture_view = match self.texture_views.get(&texture_id) {
            Some(v) => v,
            None => return false,
        };

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Font Bind Group"),
            layout: bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(texture_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(sampler),
                },
            ],
        });

        self.bind_groups.insert(texture_id, bind_group);
        true
    }

    /// Upload a texture and create its bind group in one call
    pub fn upload_rgba_with_bind_group(
        &mut self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        texture_id: FontTextureId,
        width: u32,
        height: u32,
        data: &[u8],
        bind_group_layout: &wgpu::BindGroupLayout,
        uniform_buffer: &wgpu::Buffer,
        sampler: &wgpu::Sampler,
    ) -> Result<(), FontTextureError> {
        self.upload_rgba(device, queue, texture_id, width, height, data)?;
        self.create_bind_group(
            device,
            texture_id,
            bind_group_layout,
            uniform_buffer,
            sampler,
        );
        Ok(())
    }

    /// Check if a texture is loaded
    pub fn has_texture(&self, texture_id: FontTextureId) -> bool {
        self.textures.contains_key(&texture_id)
    }

    /// Check if a bind group exists for the texture
    pub fn has_bind_group(&self, texture_id: FontTextureId) -> bool {
        self.bind_groups.contains_key(&texture_id)
    }

    /// Get a texture by ID
    pub fn get(&self, texture_id: FontTextureId) -> Option<&wgpu::Texture> {
        self.textures.get(&texture_id)
    }

    /// Get a texture view by ID
    pub fn get_view(&self, texture_id: FontTextureId) -> Option<&wgpu::TextureView> {
        self.texture_views.get(&texture_id)
    }

    /// Get a bind group by ID
    pub fn get_bind_group(&self, texture_id: FontTextureId) -> Option<&wgpu::BindGroup> {
        self.bind_groups.get(&texture_id)
    }

    /// Get texture info by ID
    pub fn get_info(&self, texture_id: FontTextureId) -> Option<FontTextureInfo> {
        self.texture_info.get(&texture_id).copied()
    }

    /// Remove a texture and its bind group
    pub fn remove(&mut self, texture_id: FontTextureId) {
        if self.textures.remove(&texture_id).is_some() {
            self.texture_views.remove(&texture_id);
            self.bind_groups.remove(&texture_id);
            self.texture_info.remove(&texture_id);
            log::info!("Deleted font texture {}", texture_id);
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

    /// Clear all textures and bind groups
    pub fn clear(&mut self) {
        self.textures.clear();
        self.texture_views.clear();
        self.bind_groups.clear();
        self.texture_info.clear();
        log::info!("Cleared all font textures");
    }
}
