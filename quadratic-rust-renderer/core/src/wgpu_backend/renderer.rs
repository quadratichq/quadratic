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
