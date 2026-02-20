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

#[cfg(test)]
mod tests {
    use super::*;
    use wgpu::{
        Backends, DeviceDescriptor, Features, Instance, InstanceDescriptor, Limits, MemoryHints,
        PowerPreference, RequestAdapterOptions,
    };

    fn create_test_device() -> Option<(Device, Queue)> {
        let instance = Instance::new(InstanceDescriptor {
            backends: Backends::all(),
            ..Default::default()
        });

        let adapter = pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
            power_preference: PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
        }))
        .or_else(|| {
            pollster::block_on(instance.request_adapter(&RequestAdapterOptions {
                power_preference: PowerPreference::LowPower,
                compatible_surface: None,
                force_fallback_adapter: true,
            }))
        })?;

        pollster::block_on(adapter.request_device(
            &DeviceDescriptor {
                label: Some("Test Device"),
                required_features: Features::empty(),
                required_limits: Limits::default(),
                memory_hints: MemoryHints::default(),
            },
            None,
        ))
        .ok()
    }

    #[test]
    fn test_new() {
        let manager = TextureManager::new();
        assert_eq!(manager.textures.len(), 0);
    }

    #[test]
    fn test_default() {
        let manager = TextureManager::default();
        assert_eq!(manager.textures.len(), 0);
    }

    #[test]
    fn test_has_when_empty() {
        let manager = TextureManager::new();
        assert!(!manager.has(1));
    }

    #[test]
    fn test_get_when_empty() {
        let manager = TextureManager::new();
        assert!(manager.get(1).is_none());
    }

    #[test]
    fn test_remove_when_empty() {
        let mut manager = TextureManager::new();
        manager.remove(1);
        assert_eq!(manager.textures.len(), 0);
    }

    #[test]
    fn test_upload_size_mismatch() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let invalid_data = vec![0u8; 10];
        let result = manager.upload(&device, &queue, 1, 2, 2, &invalid_data);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Texture data size mismatch"));
    }

    #[test]
    fn test_upload_size_mismatch_too_large() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let invalid_data = vec![0u8; 100];
        let result = manager.upload(&device, &queue, 1, 2, 2, &invalid_data);
        assert!(result.is_err());
    }

    #[test]
    fn test_upload_size_mismatch_too_small() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let invalid_data = vec![0u8; 5];
        let result = manager.upload(&device, &queue, 1, 2, 2, &invalid_data);
        assert!(result.is_err());
    }

    #[test]
    fn test_upload_success() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let width = 2;
        let height = 2;
        let data = vec![255u8; (width * height * 4) as usize];

        let result = manager.upload(&device, &queue, 1, width, height, &data);
        assert!(result.is_ok());
    }

    #[test]
    fn test_has_after_upload() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let width = 2;
        let height = 2;
        let data = vec![255u8; (width * height * 4) as usize];

        manager
            .upload(&device, &queue, 1, width, height, &data)
            .unwrap();
        assert!(manager.has(1));
        assert!(!manager.has(2));
    }

    #[test]
    fn test_get_after_upload() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let width = 2;
        let height = 2;
        let data = vec![255u8; (width * height * 4) as usize];

        manager
            .upload(&device, &queue, 1, width, height, &data)
            .unwrap();
        assert!(manager.get(1).is_some());
        assert!(manager.get(2).is_none());
    }

    #[test]
    fn test_remove_after_upload() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let width = 2;
        let height = 2;
        let data = vec![255u8; (width * height * 4) as usize];

        manager
            .upload(&device, &queue, 1, width, height, &data)
            .unwrap();
        assert!(manager.has(1));

        manager.remove(1);
        assert!(!manager.has(1));
        assert!(manager.get(1).is_none());
    }

    #[test]
    fn test_upload_replaces_existing() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let width = 2;
        let height = 2;
        let data1 = vec![255u8; (width * height * 4) as usize];
        let data2 = vec![128u8; (width * height * 4) as usize];

        manager
            .upload(&device, &queue, 1, width, height, &data1)
            .unwrap();
        assert!(manager.has(1));

        manager
            .upload(&device, &queue, 1, width, height, &data2)
            .unwrap();
        assert!(manager.has(1));
        assert_eq!(manager.textures.len(), 1);
    }

    #[test]
    fn test_multiple_textures() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let width = 2;
        let height = 2;
        let data = vec![255u8; (width * height * 4) as usize];

        manager
            .upload(&device, &queue, 1, width, height, &data)
            .unwrap();
        manager
            .upload(&device, &queue, 2, width, height, &data)
            .unwrap();
        manager
            .upload(&device, &queue, 3, width, height, &data)
            .unwrap();

        assert!(manager.has(1));
        assert!(manager.has(2));
        assert!(manager.has(3));
        assert_eq!(manager.textures.len(), 3);

        assert!(manager.get(1).is_some());
        assert!(manager.get(2).is_some());
        assert!(manager.get(3).is_some());
    }

    #[test]
    fn test_remove_one_of_multiple() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let width = 2;
        let height = 2;
        let data = vec![255u8; (width * height * 4) as usize];

        manager
            .upload(&device, &queue, 1, width, height, &data)
            .unwrap();
        manager
            .upload(&device, &queue, 2, width, height, &data)
            .unwrap();
        manager
            .upload(&device, &queue, 3, width, height, &data)
            .unwrap();

        manager.remove(2);

        assert!(manager.has(1));
        assert!(!manager.has(2));
        assert!(manager.has(3));
        assert_eq!(manager.textures.len(), 2);
    }

    #[test]
    fn test_different_sizes() {
        let Some((device, queue)) = create_test_device() else {
            eprintln!("Skipping test: no GPU adapter available");
            return;
        };
        let mut manager = TextureManager::new();

        let data1x1 = vec![255u8; 4];
        let data2x2 = vec![255u8; 16];
        let data4x4 = vec![255u8; 64];

        manager.upload(&device, &queue, 1, 1, 1, &data1x1).unwrap();
        manager.upload(&device, &queue, 2, 2, 2, &data2x2).unwrap();
        manager.upload(&device, &queue, 3, 4, 4, &data4x4).unwrap();

        assert!(manager.has(1));
        assert!(manager.has(2));
        assert!(manager.has(3));
    }
}
