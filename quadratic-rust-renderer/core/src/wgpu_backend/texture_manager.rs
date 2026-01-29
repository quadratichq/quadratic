//! Texture manager for wgpu

use std::collections::HashMap;
use wgpu::{Device, Queue, Texture, TextureView};

/// Manages textures for rendering
pub struct TextureManager {
    textures: HashMap<u32, (Texture, TextureView)>,
}

impl TextureManager {
    pub fn new() -> Self {
        Self {
            textures: HashMap::new(),
        }
    }

    /// Upload a texture
    pub fn upload(
        &mut self,
        device: &Device,
        queue: &Queue,
        id: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), anyhow::Error> {
        let expected_size = (width * height * 4) as usize;
        if data.len() != expected_size {
            return Err(anyhow::anyhow!(
                "Texture data size mismatch: expected {} bytes for {}x{} RGBA, got {}",
                expected_size,
                width,
                height,
                data.len()
            ));
        }

        // Remove existing texture if present to avoid GPU memory leak
        self.remove(id);

        let size = wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        };

        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some(&format!("Texture {}", id)),
            size,
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
            size,
        );

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        self.textures.insert(id, (texture, view));

        Ok(())
    }

    /// Get a texture view by ID
    pub fn get(&self, id: u32) -> Option<&TextureView> {
        self.textures.get(&id).map(|(_, view)| view)
    }

    /// Check if texture exists
    pub fn has(&self, id: u32) -> bool {
        self.textures.contains_key(&id)
    }

    /// Remove a texture
    pub fn remove(&mut self, id: u32) {
        self.textures.remove(&id);
    }
}

impl Default for TextureManager {
    fn default() -> Self {
        Self::new()
    }
}
