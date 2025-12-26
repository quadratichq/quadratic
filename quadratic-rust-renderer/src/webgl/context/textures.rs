use wasm_bindgen::JsValue;
use web_sys::HtmlImageElement;

use crate::webgl::{FontTextureId, WebGLContext};

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
}
