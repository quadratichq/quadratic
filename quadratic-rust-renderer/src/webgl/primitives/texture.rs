//! Texture management for sprites
//!
//! Provides a texture manager for loading and accessing WebGL textures.

use std::collections::HashMap;
use wasm_bindgen::JsValue;
use web_sys::{HtmlImageElement, WebGl2RenderingContext, WebGlTexture};

/// Unique identifier for a texture
pub type TextureId = u32;

/// Texture metadata
#[derive(Debug, Clone, Copy)]
pub struct TextureInfo {
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
}

/// Manages WebGL textures for sprite rendering
pub struct TextureManager {
    /// Stored textures indexed by TextureId
    textures: HashMap<TextureId, WebGlTexture>,
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
    ///
    /// Returns the texture ID on success.
    pub fn upload_rgba(
        &mut self,
        gl: &WebGl2RenderingContext,
        texture_id: TextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        let texture = gl.create_texture().ok_or("Failed to create texture")?;

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
            .insert(texture_id, TextureInfo { width, height });

        log::info!("Uploaded texture {} ({}x{})", texture_id, width, height);

        Ok(())
    }

    /// Upload a texture from an HTML image element
    pub fn upload_image(
        &mut self,
        gl: &WebGl2RenderingContext,
        texture_id: TextureId,
        image: &HtmlImageElement,
    ) -> Result<(), JsValue> {
        let texture = gl.create_texture().ok_or("Failed to create texture")?;

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
            .insert(texture_id, TextureInfo { width, height });

        log::info!(
            "Uploaded texture {} from image ({}x{})",
            texture_id,
            width,
            height
        );

        Ok(())
    }

    /// Set standard texture parameters for sprite rendering
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
    pub fn has_texture(&self, texture_id: TextureId) -> bool {
        self.textures.contains_key(&texture_id)
    }

    /// Get a texture by ID
    pub fn get(&self, texture_id: TextureId) -> Option<&WebGlTexture> {
        self.textures.get(&texture_id)
    }

    /// Get texture info by ID
    pub fn get_info(&self, texture_id: TextureId) -> Option<TextureInfo> {
        self.texture_info.get(&texture_id).copied()
    }

    /// Remove a texture
    pub fn remove(&mut self, gl: &WebGl2RenderingContext, texture_id: TextureId) {
        if let Some(texture) = self.textures.remove(&texture_id) {
            gl.delete_texture(Some(&texture));
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
    pub fn clear(&mut self, gl: &WebGl2RenderingContext) {
        for texture in self.textures.values() {
            gl.delete_texture(Some(texture));
        }
        self.textures.clear();
        self.texture_info.clear();
        log::info!("Cleared all textures");
    }
}

impl Default for TextureManager {
    fn default() -> Self {
        Self::new()
    }
}
