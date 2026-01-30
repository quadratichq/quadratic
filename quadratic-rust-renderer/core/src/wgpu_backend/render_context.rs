//! WgpuRenderContext - implements RenderContext for wgpu
//!
//! This wraps WgpuRenderer and provides a surface-based rendering context
//! that implements the RenderContext trait.

use wgpu::{
    Device, Queue, Surface, SurfaceConfiguration, SurfaceTexture, TextureFormat, TextureView,
};

use super::WgpuRenderer;
use crate::render_context::{CommandBuffer, DrawCommand, RenderContext, RenderError, TextureId};

/// Backend type for wgpu
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WgpuBackend {
    /// WebGPU (native or web)
    WebGpu,
    /// Vulkan
    Vulkan,
    /// Metal (macOS/iOS)
    Metal,
    /// DirectX 12
    Dx12,
    /// OpenGL (via wgpu's GL backend, includes WebGL2)
    Gl,
    /// Unknown/other
    Other,
}

impl WgpuBackend {
    /// Get a string name for the backend
    pub fn name(&self) -> &'static str {
        match self {
            WgpuBackend::WebGpu => "wgpu-WebGPU",
            WgpuBackend::Vulkan => "wgpu-Vulkan",
            WgpuBackend::Metal => "wgpu-Metal",
            WgpuBackend::Dx12 => "wgpu-DX12",
            WgpuBackend::Gl => "wgpu-GL",
            WgpuBackend::Other => "wgpu-Unknown",
        }
    }
}

/// WgpuRenderContext - Surface-based rendering context
///
/// This implements the RenderContext trait for rendering to a wgpu surface.
/// Used for both browser (OffscreenCanvas) and native (window) rendering.
///
/// ## Usage
///
/// ```ignore
/// let ctx = WgpuRenderContext::new(device, queue, surface, config).await?;
/// ctx.begin_frame();
/// ctx.clear(0.9, 0.9, 0.9, 1.0);
/// ctx.draw_triangles(&vertices, &matrix);
/// ctx.end_frame();
/// ```
pub struct WgpuRenderContext {
    /// Core wgpu renderer (pipelines, textures, draw methods)
    renderer: WgpuRenderer,

    /// Surface to render to
    surface: Surface<'static>,

    /// Surface configuration
    config: SurfaceConfiguration,

    /// Current surface texture (acquired at begin_frame)
    current_texture: Option<SurfaceTexture>,

    /// Current texture view
    current_view: Option<TextureView>,

    /// Command buffer for deferred rendering
    command_buffer: CommandBuffer,

    /// Canvas dimensions
    width: u32,
    height: u32,

    /// Backend type for reporting
    backend: WgpuBackend,
}

impl WgpuRenderContext {
    /// Create a new render context from existing wgpu resources
    pub fn new(
        device: Device,
        queue: Queue,
        surface: Surface<'static>,
        config: SurfaceConfiguration,
        backend: WgpuBackend,
    ) -> Self {
        let width = config.width;
        let height = config.height;
        let format = config.format;

        Self {
            renderer: WgpuRenderer::new(device, queue, format),
            surface,
            config,
            current_texture: None,
            current_view: None,
            command_buffer: CommandBuffer::new(),
            width,
            height,
            backend,
        }
    }

    /// Get the underlying device
    pub fn device(&self) -> &Device {
        self.renderer.device()
    }

    /// Get the underlying queue
    pub fn queue(&self) -> &Queue {
        self.renderer.queue()
    }

    /// Get the surface format
    pub fn format(&self) -> TextureFormat {
        self.config.format
    }

    /// Execute all buffered commands
    fn execute_commands(&mut self) {
        let Some(view) = self.current_view.as_ref() else {
            log::warn!("No current texture view - did you call begin_frame()?");
            return;
        };

        let mut encoder = self
            .renderer
            .device()
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("Render Encoder"),
            });

        // Find clear color from commands
        let clear_color = self
            .command_buffer
            .commands()
            .iter()
            .find_map(|cmd| {
                if let DrawCommand::Clear { r, g, b, a } = cmd {
                    Some(wgpu::Color {
                        r: *r as f64,
                        g: *g as f64,
                        b: *b as f64,
                        a: *a as f64,
                    })
                } else {
                    None
                }
            })
            .unwrap_or(wgpu::Color::WHITE);

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Main Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(clear_color),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            // Execute draw commands
            for cmd in self.command_buffer.commands() {
                match cmd {
                    DrawCommand::Clear { .. } => {
                        // Already handled in load op
                    }
                    DrawCommand::SetViewport { x, y, width, height } => {
                        pass.set_viewport(
                            *x as f32,
                            *y as f32,
                            *width as f32,
                            *height as f32,
                            0.0,
                            1.0,
                        );
                    }
                    DrawCommand::ResetViewport => {
                        pass.set_viewport(
                            0.0,
                            0.0,
                            self.width as f32,
                            self.height as f32,
                            0.0,
                            1.0,
                        );
                    }
                    DrawCommand::SetScissor { x, y, width, height } => {
                        pass.set_scissor_rect(
                            *x as u32,
                            *y as u32,
                            *width as u32,
                            *height as u32,
                        );
                    }
                    DrawCommand::DisableScissor => {
                        pass.set_scissor_rect(0, 0, self.width, self.height);
                    }
                    DrawCommand::Triangles { vertices, matrix } => {
                        self.renderer.draw_triangles(&mut pass, vertices, matrix);
                    }
                    DrawCommand::Lines { vertices, matrix } => {
                        self.renderer.draw_lines(&mut pass, vertices, matrix);
                    }
                    DrawCommand::Text {
                        vertices,
                        indices,
                        texture_uid,
                        matrix,
                        viewport_scale,
                        font_scale,
                        distance_range,
                    } => {
                        self.renderer.draw_text(
                            &mut pass,
                            vertices,
                            indices,
                            *texture_uid,
                            matrix,
                            *viewport_scale,
                            *font_scale,
                            *distance_range,
                        );
                    }
                    DrawCommand::Sprites {
                        texture_id,
                        vertices,
                        indices,
                        matrix,
                    } => {
                        self.renderer
                            .draw_sprites(&mut pass, *texture_id, vertices, indices, matrix);
                    }
                }
            }
        }

        self.renderer.queue().submit(std::iter::once(encoder.finish()));
    }
}

impl RenderContext for WgpuRenderContext {
    fn begin_frame(&mut self) {
        self.command_buffer.clear();

        // Acquire next surface texture
        match self.surface.get_current_texture() {
            Ok(texture) => {
                let view = texture
                    .texture
                    .create_view(&wgpu::TextureViewDescriptor::default());
                self.current_texture = Some(texture);
                self.current_view = Some(view);
            }
            Err(e) => {
                log::error!("Failed to acquire surface texture: {:?}", e);
            }
        }
    }

    fn end_frame(&mut self) {
        self.execute_commands();

        // Present the frame
        if let Some(texture) = self.current_texture.take() {
            texture.present();
        }
        self.current_view = None;
    }

    fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }

        self.width = width;
        self.height = height;
        self.config.width = width;
        self.config.height = height;
        self.surface.configure(self.renderer.device(), &self.config);
    }

    fn width(&self) -> u32 {
        self.width
    }

    fn height(&self) -> u32 {
        self.height
    }

    fn backend_name(&self) -> &'static str {
        self.backend.name()
    }

    fn clear(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.command_buffer.push(DrawCommand::Clear { r, g, b, a });
    }

    fn set_viewport(&mut self, x: i32, y: i32, width: i32, height: i32) {
        self.command_buffer
            .push(DrawCommand::SetViewport { x, y, width, height });
    }

    fn reset_viewport(&mut self) {
        self.command_buffer.push(DrawCommand::ResetViewport);
    }

    fn set_scissor(&mut self, x: i32, y: i32, width: i32, height: i32) {
        self.command_buffer
            .push(DrawCommand::SetScissor { x, y, width, height });
    }

    fn disable_scissor(&mut self) {
        self.command_buffer.push(DrawCommand::DisableScissor);
    }

    fn draw_triangles(&mut self, vertices: &[f32], matrix: &[f32; 16]) {
        if !vertices.is_empty() {
            self.command_buffer.push(DrawCommand::Triangles {
                vertices: vertices.to_vec(),
                matrix: *matrix,
            });
        }
    }

    fn draw_lines(&mut self, vertices: &[f32], matrix: &[f32; 16]) {
        if !vertices.is_empty() {
            self.command_buffer.push(DrawCommand::Lines {
                vertices: vertices.to_vec(),
                matrix: *matrix,
            });
        }
    }

    fn draw_text(
        &mut self,
        vertices: &[f32],
        indices: &[u32],
        texture_uid: u32,
        matrix: &[f32; 16],
        viewport_scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        if !vertices.is_empty() && !indices.is_empty() {
            self.command_buffer.push(DrawCommand::Text {
                vertices: vertices.to_vec(),
                indices: indices.to_vec(),
                texture_uid,
                matrix: *matrix,
                viewport_scale,
                font_scale,
                distance_range,
            });
        }
    }

    fn draw_sprites(
        &mut self,
        texture_id: TextureId,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    ) {
        if !vertices.is_empty() {
            self.command_buffer.push(DrawCommand::Sprites {
                texture_id,
                vertices: vertices.to_vec(),
                indices: indices.to_vec(),
                matrix: *matrix,
            });
        }
    }

    fn has_font_texture(&self, texture_uid: u32) -> bool {
        self.renderer.has_texture(texture_uid)
    }

    fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError> {
        self.renderer
            .upload_texture(texture_uid, width, height, data)
            .map_err(|e| RenderError(e.to_string()))
    }

    fn has_sprite_texture(&self, texture_id: TextureId) -> bool {
        self.renderer.has_texture(texture_id)
    }

    fn upload_sprite_texture(
        &mut self,
        texture_id: TextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError> {
        self.renderer
            .upload_texture(texture_id, width, height, data)
            .map_err(|e| RenderError(e.to_string()))
    }

    fn remove_sprite_texture(&mut self, texture_id: TextureId) {
        self.renderer.remove_texture(texture_id);
    }
}
