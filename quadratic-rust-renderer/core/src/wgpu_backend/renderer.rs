//! wgpu renderer implementation

use wgpu::{Device, Queue, RenderPass, TextureFormat};

use super::pipelines::RenderPipelines;
use super::texture_manager::TextureManager;

/// Shared wgpu rendering context
///
/// This renderer is used by both:
/// - renderer-wasm (WebGPU mode with OffscreenCanvas surface)
/// - native (headless texture target)
///
/// Platform-specific code is responsible for:
/// - Creating the wgpu Instance and Adapter
/// - Requesting the Device and Queue
/// - Creating the surface/render target
pub struct WgpuRenderer {
    device: Device,
    queue: Queue,
    pipelines: RenderPipelines,
    textures: TextureManager,
    target_format: TextureFormat,
}

impl WgpuRenderer {
    /// Create from existing device/queue
    pub fn new(device: Device, queue: Queue, target_format: TextureFormat) -> Self {
        let pipelines = RenderPipelines::new(&device, target_format);
        let textures = TextureManager::new();

        Self {
            device,
            queue,
            pipelines,
            textures,
            target_format,
        }
    }

    /// Get the device
    pub fn device(&self) -> &Device {
        &self.device
    }

    /// Get the queue
    pub fn queue(&self) -> &Queue {
        &self.queue
    }

    /// Get the target format
    pub fn target_format(&self) -> TextureFormat {
        self.target_format
    }

    /// Draw colored triangles
    pub fn draw_triangles<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() {
            return;
        }
        self.pipelines
            .draw_triangles(pass, &self.device, &self.queue, vertices, matrix);
    }

    /// Draw colored lines
    pub fn draw_lines<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        vertices: &[f32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() {
            return;
        }
        self.pipelines
            .draw_lines(pass, &self.device, &self.queue, vertices, matrix);
    }

    /// Draw MSDF text
    #[allow(clippy::too_many_arguments)]
    pub fn draw_text<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        vertices: &[f32],
        indices: &[u32],
        texture_uid: u32,
        matrix: &[f32; 16],
        scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        if vertices.is_empty() || indices.is_empty() {
            return;
        }

        if let Some(texture_view) = self.textures.get(texture_uid) {
            self.pipelines.draw_text(
                pass,
                &self.device,
                &self.queue,
                vertices,
                indices,
                texture_view,
                matrix,
                scale,
                font_scale,
                distance_range,
            );
        }
    }

    /// Draw emoji/image sprites
    pub fn draw_sprites<'a>(
        &'a self,
        pass: &mut RenderPass<'a>,
        texture_uid: u32,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() {
            return;
        }

        if let Some(texture_view) = self.textures.get(texture_uid) {
            self.pipelines.draw_sprites(
                pass,
                &self.device,
                &self.queue,
                vertices,
                indices,
                texture_view,
                matrix,
            );
        }
    }

    /// Upload a texture
    pub fn upload_texture(
        &mut self,
        id: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), anyhow::Error> {
        self.textures
            .upload(&self.device, &self.queue, id, width, height, data)
    }

    /// Check if texture exists
    pub fn has_texture(&self, id: u32) -> bool {
        self.textures.has(id)
    }

    /// Remove a texture
    pub fn remove_texture(&mut self, id: u32) {
        self.textures.remove(id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_renderer() -> WgpuRenderer {
        pollster::block_on(async {
            let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
                backends: wgpu::Backends::all(),
                ..Default::default()
            });

            let adapter = instance
                .request_adapter(&wgpu::RequestAdapterOptions {
                    power_preference: wgpu::PowerPreference::default(),
                    compatible_surface: None,
                    force_fallback_adapter: false,
                })
                .await
                .expect("Failed to find an appropriate adapter");

            let (device, queue) = adapter
                .request_device(
                    &wgpu::DeviceDescriptor {
                        required_features: wgpu::Features::empty(),
                        required_limits: wgpu::Limits::default(),
                        label: None,
                        memory_hints: wgpu::MemoryHints::default(),
                    },
                    None,
                )
                .await
                .expect("Failed to create device");

            WgpuRenderer::new(device, queue, wgpu::TextureFormat::Rgba8Unorm)
        })
    }

    #[test]
    fn test_new() {
        let renderer = create_test_renderer();
        assert_eq!(renderer.target_format(), wgpu::TextureFormat::Rgba8Unorm);
    }

    #[test]
    fn test_getters() {
        let renderer = create_test_renderer();

        // Test that getters return references
        let _device = renderer.device();
        let _queue = renderer.queue();
        let format = renderer.target_format();

        assert_eq!(format, wgpu::TextureFormat::Rgba8Unorm);
    }

    #[test]
    fn test_texture_management() {
        let mut renderer = create_test_renderer();

        // Initially no texture
        assert!(!renderer.has_texture(1));

        // Upload a texture
        let width = 2;
        let height = 2;
        let data = vec![255u8; (width * height * 4) as usize]; // RGBA data
        renderer.upload_texture(1, width, height, &data).unwrap();

        // Texture should now exist
        assert!(renderer.has_texture(1));

        // Remove texture
        renderer.remove_texture(1);

        // Texture should be gone
        assert!(!renderer.has_texture(1));
    }

    #[test]
    fn test_upload_texture_multiple() {
        let mut renderer = create_test_renderer();

        // Upload multiple textures
        let data1 = vec![255u8; 16]; // 2x2 RGBA
        let data2 = vec![128u8; 16]; // 2x2 RGBA

        renderer.upload_texture(1, 2, 2, &data1).unwrap();
        renderer.upload_texture(2, 2, 2, &data2).unwrap();

        assert!(renderer.has_texture(1));
        assert!(renderer.has_texture(2));

        // Remove one
        renderer.remove_texture(1);
        assert!(!renderer.has_texture(1));
        assert!(renderer.has_texture(2));
    }

    #[test]
    fn test_upload_texture_replace() {
        let mut renderer = create_test_renderer();

        let data1 = vec![255u8; 16]; // 2x2 RGBA
        let data2 = vec![128u8; 16]; // 2x2 RGBA

        renderer.upload_texture(1, 2, 2, &data1).unwrap();
        assert!(renderer.has_texture(1));

        // Replace with new data
        renderer.upload_texture(1, 2, 2, &data2).unwrap();
        assert!(renderer.has_texture(1));
    }

    #[test]
    fn test_upload_texture_invalid_size() {
        let mut renderer = create_test_renderer();

        // Wrong data size
        let data = vec![255u8; 8]; // Should be 16 bytes for 2x2 RGBA
        let result = renderer.upload_texture(1, 2, 2, &data);

        assert!(result.is_err());
        assert!(!renderer.has_texture(1));
    }

    #[test]
    fn test_remove_nonexistent_texture() {
        let mut renderer = create_test_renderer();

        // Removing non-existent texture should not panic
        renderer.remove_texture(999);
        assert!(!renderer.has_texture(999));
    }

    #[test]
    fn test_draw_triangles_empty_vertices() {
        let renderer = create_test_renderer();

        // Create a minimal render pass to test early return
        let texture = renderer.device().create_texture(&wgpu::TextureDescriptor {
            label: None,
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = renderer
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        let matrix = [1.0f32; 16];

        // Should not panic with empty vertices
        renderer.draw_triangles(&mut pass, &[], &matrix);

        drop(pass);
    }

    #[test]
    fn test_draw_lines_empty_vertices() {
        let renderer = create_test_renderer();

        let texture = renderer.device().create_texture(&wgpu::TextureDescriptor {
            label: None,
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = renderer
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        let matrix = [1.0f32; 16];

        // Should not panic with empty vertices
        renderer.draw_lines(&mut pass, &[], &matrix);

        drop(pass);
    }

    #[test]
    fn test_draw_text_empty_vertices() {
        let renderer = create_test_renderer();

        let texture = renderer.device().create_texture(&wgpu::TextureDescriptor {
            label: None,
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = renderer
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        let matrix = [1.0f32; 16];

        // Should not panic with empty vertices
        renderer.draw_text(&mut pass, &[], &[], 1, &matrix, 1.0, 1.0, 1.0);

        // Should not panic with empty indices
        renderer.draw_text(&mut pass, &[1.0], &[], 1, &matrix, 1.0, 1.0, 1.0);

        drop(pass);
    }

    #[test]
    fn test_draw_text_missing_texture() {
        let renderer = create_test_renderer();

        let texture = renderer.device().create_texture(&wgpu::TextureDescriptor {
            label: None,
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = renderer
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        let matrix = [1.0f32; 16];
        let vertices = [1.0f32; 12]; // 3 vertices
        let indices = [0u32, 1, 2];

        // Should not panic when texture doesn't exist
        renderer.draw_text(&mut pass, &vertices, &indices, 999, &matrix, 1.0, 1.0, 1.0);

        drop(pass);
    }

    #[test]
    fn test_draw_sprites_empty_vertices() {
        let renderer = create_test_renderer();

        let texture = renderer.device().create_texture(&wgpu::TextureDescriptor {
            label: None,
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = renderer
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        let matrix = [1.0f32; 16];

        // Should not panic with empty vertices
        renderer.draw_sprites(&mut pass, 1, &[], &[], &matrix);

        drop(pass);
    }

    #[test]
    fn test_draw_sprites_missing_texture() {
        let renderer = create_test_renderer();

        let texture = renderer.device().create_texture(&wgpu::TextureDescriptor {
            label: None,
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        });

        let view = texture.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = renderer
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
        });

        let matrix = [1.0f32; 16];
        let vertices = [1.0f32; 12]; // 3 vertices
        let indices = [0u32, 1, 2];

        // Should not panic when texture doesn't exist
        renderer.draw_sprites(&mut pass, 999, &vertices, &indices, &matrix);

        drop(pass);
    }
}
