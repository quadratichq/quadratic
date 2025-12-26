//! WebGPU viewport accessors
//!
//! Additional viewport-related methods not covered by RenderContext trait.
//! The main viewport methods (resize, width, height) are in render_context.rs.

use super::WebGPUContext;

impl WebGPUContext {
    /// Get surface texture for rendering
    pub fn get_current_texture(&self) -> Result<wgpu::SurfaceTexture, wgpu::SurfaceError> {
        self.surface.get_current_texture()
    }

    /// Get the device
    pub fn device(&self) -> &wgpu::Device {
        &self.device
    }

    /// Get the queue
    pub fn queue(&self) -> &wgpu::Queue {
        &self.queue
    }
}
