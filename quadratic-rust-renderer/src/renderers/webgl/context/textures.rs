use wasm_bindgen::JsValue;
use web_sys::HtmlImageElement;

use super::WebGLContext;
use crate::renderers::FontTextureId;

impl WebGLContext {
    /// Upload a font texture from an HtmlImageElement
    pub fn upload_font_texture(
        &mut self,
        texture_uid: FontTextureId,
        image: &HtmlImageElement,
    ) -> Result<(), JsValue> {
        self.font_texture_manager
            .upload_image(&self.gl, texture_uid, image)
    }

    /// Upload a font texture from raw RGBA pixel data
    pub fn upload_font_texture_from_data(
        &mut self,
        texture_uid: FontTextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        self.font_texture_manager
            .upload_rgba(&self.gl, texture_uid, width, height, data)
    }

    /// Check if a font texture is loaded
    pub fn has_font_texture(&self, texture_uid: FontTextureId) -> bool {
        self.font_texture_manager.has_texture(texture_uid)
    }

    // =========================================================================
    // Emoji textures (reuse font_texture_manager since it's just a UID->texture map)
    // =========================================================================

    /// Upload an emoji spritesheet texture from raw RGBA pixel data
    pub fn upload_emoji_texture_from_data(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        // Reuse font_texture_manager for emoji textures
        self.font_texture_manager
            .upload_rgba(&self.gl, texture_uid, width, height, data)
    }

    /// Check if an emoji texture is loaded
    pub fn has_emoji_texture(&self, texture_uid: u32) -> bool {
        // Emoji textures are stored in the same manager as fonts
        self.font_texture_manager.has_texture(texture_uid)
    }
}
