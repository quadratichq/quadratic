//! Framebuffer for render-to-texture operations
//!
//! Used to pre-render text hashes to sprite textures for efficient
//! rendering when zoomed out (based on the War and Peace and WebGL technique).

use wasm_bindgen::JsValue;
use web_sys::{WebGl2RenderingContext, WebGlFramebuffer, WebGlTexture};

/// A framebuffer with an attached color texture for render-to-texture operations
pub struct RenderTarget {
    /// The framebuffer object
    framebuffer: WebGlFramebuffer,
    /// The color texture attachment
    pub texture: WebGlTexture,
    /// Width in pixels
    pub width: u32,
    /// Height in pixels
    pub height: u32,
    /// Whether this render target uses mipmaps
    uses_mipmaps: bool,
}

impl RenderTarget {
    /// Create a new render target with the specified dimensions
    pub fn new(gl: &WebGl2RenderingContext, width: u32, height: u32) -> Result<Self, JsValue> {
        Self::create(gl, width, height, false)
    }

    /// Create a new render target with mipmap support for smooth minification
    /// Call `generate_mipmaps()` after rendering to create the mip chain
    pub fn new_with_mipmaps(
        gl: &WebGl2RenderingContext,
        width: u32,
        height: u32,
    ) -> Result<Self, JsValue> {
        Self::create(gl, width, height, true)
    }

    /// Internal creation function
    fn create(
        gl: &WebGl2RenderingContext,
        width: u32,
        height: u32,
        use_mipmaps: bool,
    ) -> Result<Self, JsValue> {
        // Create framebuffer
        let framebuffer = gl
            .create_framebuffer()
            .ok_or("Failed to create framebuffer")?;

        // Create texture for color attachment
        let texture = gl.create_texture().ok_or("Failed to create texture")?;

        gl.bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(&texture));

        // Allocate texture storage (RGBA, no initial data)
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            WebGl2RenderingContext::TEXTURE_2D,
            0,                                   // mip level
            WebGl2RenderingContext::RGBA as i32, // internal format
            width as i32,
            height as i32,
            0,                                     // border
            WebGl2RenderingContext::RGBA,          // format
            WebGl2RenderingContext::UNSIGNED_BYTE, // type
            None,                                  // no initial data
        )?;

        // Set texture parameters
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

        // Set filtering based on mipmap usage
        if use_mipmaps {
            // Use trilinear filtering for smooth mipmap transitions
            gl.tex_parameteri(
                WebGl2RenderingContext::TEXTURE_2D,
                WebGl2RenderingContext::TEXTURE_MIN_FILTER,
                WebGl2RenderingContext::LINEAR_MIPMAP_LINEAR as i32,
            );
        } else {
            gl.tex_parameteri(
                WebGl2RenderingContext::TEXTURE_2D,
                WebGl2RenderingContext::TEXTURE_MIN_FILTER,
                WebGl2RenderingContext::LINEAR as i32,
            );
        }
        gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_MAG_FILTER,
            WebGl2RenderingContext::LINEAR as i32,
        );

        // Attach texture to framebuffer
        gl.bind_framebuffer(WebGl2RenderingContext::FRAMEBUFFER, Some(&framebuffer));
        gl.framebuffer_texture_2d(
            WebGl2RenderingContext::FRAMEBUFFER,
            WebGl2RenderingContext::COLOR_ATTACHMENT0,
            WebGl2RenderingContext::TEXTURE_2D,
            Some(&texture),
            0,
        );

        // Check framebuffer completeness
        let status = gl.check_framebuffer_status(WebGl2RenderingContext::FRAMEBUFFER);
        if status != WebGl2RenderingContext::FRAMEBUFFER_COMPLETE {
            gl.bind_framebuffer(WebGl2RenderingContext::FRAMEBUFFER, None);
            return Err(JsValue::from_str(&format!(
                "Framebuffer incomplete: {}",
                status
            )));
        }

        // Unbind framebuffer (return to default)
        gl.bind_framebuffer(WebGl2RenderingContext::FRAMEBUFFER, None);
        gl.bind_texture(WebGl2RenderingContext::TEXTURE_2D, None);

        Ok(Self {
            framebuffer,
            texture,
            width,
            height,
            uses_mipmaps: use_mipmaps,
        })
    }

    /// Generate mipmaps for the texture (call after rendering)
    /// This creates a chain of progressively smaller versions for smooth minification
    pub fn generate_mipmaps(&self, gl: &WebGl2RenderingContext) {
        if self.uses_mipmaps {
            gl.bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(&self.texture));
            gl.generate_mipmap(WebGl2RenderingContext::TEXTURE_2D);
            gl.bind_texture(WebGl2RenderingContext::TEXTURE_2D, None);
        }
    }

    /// Bind this render target for rendering
    /// After calling this, all draw calls will render to this target's texture
    pub fn bind(&self, gl: &WebGl2RenderingContext) {
        gl.bind_framebuffer(WebGl2RenderingContext::FRAMEBUFFER, Some(&self.framebuffer));
        gl.viewport(0, 0, self.width as i32, self.height as i32);
    }

    /// Unbind this render target (return to default framebuffer)
    pub fn unbind(gl: &WebGl2RenderingContext, canvas_width: u32, canvas_height: u32) {
        gl.bind_framebuffer(WebGl2RenderingContext::FRAMEBUFFER, None);
        gl.viewport(0, 0, canvas_width as i32, canvas_height as i32);
    }

    /// Clear the render target with transparent black
    pub fn clear(&self, gl: &WebGl2RenderingContext) {
        self.bind(gl);
        gl.clear_color(0.0, 0.0, 0.0, 0.0);
        gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);
    }

    /// Get the framebuffer
    pub fn framebuffer(&self) -> &WebGlFramebuffer {
        &self.framebuffer
    }

    /// Delete the framebuffer and texture
    pub fn delete(self, gl: &WebGl2RenderingContext) {
        gl.delete_framebuffer(Some(&self.framebuffer));
        gl.delete_texture(Some(&self.texture));
    }
}

/// Create an orthographic projection matrix for rendering to a render target
/// Maps world coordinates to NDC (-1 to 1)
pub fn ortho_matrix(left: f32, right: f32, bottom: f32, top: f32) -> [f32; 16] {
    let sx = 2.0 / (right - left);
    let sy = 2.0 / (top - bottom);
    let tx = -(right + left) / (right - left);
    let ty = -(top + bottom) / (top - bottom);

    [
        sx, 0.0, 0.0, 0.0, 0.0, sy, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, tx, ty, 0.0, 1.0,
    ]
}
