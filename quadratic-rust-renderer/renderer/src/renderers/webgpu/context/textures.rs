//! WebGPU texture management
//!
//! Additional texture methods not covered by RenderContext trait.
//! The main texture methods are in render_context.rs.

#[cfg(feature = "wasm")]
use wasm_bindgen::JsValue;

use super::WebGPUContext;

/// Error type for texture operations (cross-platform)
#[cfg(not(feature = "wasm"))]
pub type TextureError = String;
#[cfg(feature = "wasm")]
pub type TextureError = JsValue;

impl WebGPUContext {
    /// Check if a font texture exists
    pub fn has_font_texture(&self, texture_uid: u32) -> bool {
        self.font_texture_manager.has_texture(texture_uid)
    }

    /// Check if an emoji texture exists
    /// Emoji textures are stored in the font texture manager (same upload path)
    pub fn has_emoji_texture(&self, texture_uid: u32) -> bool {
        self.font_texture_manager.has_texture(texture_uid)
    }

    /// Upload a font texture from raw RGBA pixel data
    pub fn upload_font_texture_from_data(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), TextureError> {
        self.font_texture_manager.upload_rgba_with_bind_group(
            &self.device,
            &self.queue,
            texture_uid,
            width,
            height,
            data,
            &self.text_bind_group_layout,
            &self.text_uniform_buffer,
            &self.linear_sampler,
        )
    }

    /// Generate mipmaps for a render target texture
    pub fn generate_mipmaps(&self, render_target: &super::super::render_target::RenderTarget) {
        if render_target.mip_level_count > 1 {
            log::debug!(
                "[WebGPU] Generating {} mip levels for {}x{} texture",
                render_target.mip_level_count,
                render_target.width,
                render_target.height
            );
            self.mipmap_generator.generate(
                &self.device,
                &self.queue,
                &render_target.texture,
                render_target.width,
                render_target.height,
                render_target.mip_level_count,
            );
        } else {
            log::warn!(
                "[WebGPU] Skipping mipmap generation: only {} mip levels",
                render_target.mip_level_count
            );
        }
    }
}
