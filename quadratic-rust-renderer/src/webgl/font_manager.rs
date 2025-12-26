//! WebGL font texture storage
//!
//! Backend-specific storage for WebGL font texture handles.

use std::collections::HashMap;
use wasm_bindgen::JsValue;
use web_sys::{HtmlImageElement, WebGl2RenderingContext, WebGlTexture};

pub use crate::primitives::{FontTextureId, FontTextureInfo};

/// Manages WebGL textures for font rendering
#[derive(Debug, Default)]
pub struct FontManager {
    /// Stored textures indexed by FontTextureId
    textures: HashMap<FontTextureId, WebGlTexture>,
    /// Texture metadata
    texture_info: HashMap<FontTextureId, FontTextureInfo>,
}

impl FontManager {
    /// Create a new empty font texture manager
    pub fn new() -> Self {
        Self {
            textures: HashMap::new(),
            texture_info: HashMap::new(),
        }
    }

    /// Upload a texture from raw RGBA pixel data
    pub fn upload_rgba(
        &mut self,
        gl: &WebGl2RenderingContext,
        texture_id: FontTextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        let texture = gl.create_texture().ok_or("Failed to create font texture")?;

        gl.bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(&texture));

        // Upload raw RGBA pixel data
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            WebGl2RenderingContext::TEXTURE_2D,
            0,                                   // mip level
            WebGl2RenderingContext::RGBA as i32, // internal format
            width as i32,
            height as i32,
            0,                                     // border (must be 0)
            WebGl2RenderingContext::RGBA,          // format
            WebGl2RenderingContext::UNSIGNED_BYTE, // type
            Some(data),
        )?;

        Self::set_texture_parameters(gl);

        self.textures.insert(texture_id, texture);
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

    /// Upload a texture from an HTML image element
    pub fn upload_image(
        &mut self,
        gl: &WebGl2RenderingContext,
        texture_id: FontTextureId,
        image: &HtmlImageElement,
    ) -> Result<(), JsValue> {
        let texture = gl.create_texture().ok_or("Failed to create font texture")?;

        gl.bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(&texture));

        // Upload image data
        gl.tex_image_2d_with_u32_and_u32_and_html_image_element(
            WebGl2RenderingContext::TEXTURE_2D,
            0,
            WebGl2RenderingContext::RGBA as i32,
            WebGl2RenderingContext::RGBA,
            WebGl2RenderingContext::UNSIGNED_BYTE,
            image,
        )?;

        Self::set_texture_parameters(gl);

        let width = image.natural_width();
        let height = image.natural_height();

        self.textures.insert(texture_id, texture);
        self.texture_info
            .insert(texture_id, FontTextureInfo { width, height });

        log::info!(
            "Uploaded font texture {} from image ({}x{})",
            texture_id,
            width,
            height
        );

        Ok(())
    }

    /// Set texture parameters optimized for MSDF font rendering
    fn set_texture_parameters(gl: &WebGl2RenderingContext) {
        gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_WRAP_S,
            WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
        );
        gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_WRAP_T,
            WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
        );
        gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_MIN_FILTER,
            WebGl2RenderingContext::LINEAR as i32,
        );
        gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_MAG_FILTER,
            WebGl2RenderingContext::LINEAR as i32,
        );
    }

    /// Check if a texture is loaded
    pub fn has_texture(&self, texture_id: FontTextureId) -> bool {
        self.textures.contains_key(&texture_id)
    }

    /// Get a texture by ID
    pub fn get(&self, texture_id: FontTextureId) -> Option<&WebGlTexture> {
        self.textures.get(&texture_id)
    }

    /// Get texture info by ID
    pub fn get_info(&self, texture_id: FontTextureId) -> Option<FontTextureInfo> {
        self.texture_info.get(&texture_id).copied()
    }

    /// Remove a texture
    pub fn remove(&mut self, gl: &WebGl2RenderingContext, texture_id: FontTextureId) {
        if let Some(texture) = self.textures.remove(&texture_id) {
            gl.delete_texture(Some(&texture));
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

    /// Clear all textures
    pub fn clear(&mut self, gl: &WebGl2RenderingContext) {
        for texture in self.textures.values() {
            gl.delete_texture(Some(texture));
        }
        self.textures.clear();
        self.texture_info.clear();
        log::info!("Cleared all font textures");
    }
}
