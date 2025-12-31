//! WebGL2 draw methods not covered by RenderContext trait
//!
//! These are specialized draw methods that require direct WebGL access
//! or have different signatures than the trait methods.

use web_sys::{WebGl2RenderingContext, WebGlTexture};

use super::WebGLContext;

impl WebGLContext {
    /// Get the WebGL context reference
    pub fn gl(&self) -> &WebGl2RenderingContext {
        &self.gl
    }

    /// Render a sprite using a raw WebGlTexture (for cached render targets)
    /// Draws a single textured quad at the specified world position
    pub fn draw_sprite_with_texture(
        &self,
        texture: &WebGlTexture,
        x: f32,
        y: f32,
        width: f32,
        height: f32,
        matrix: &[f32; 16],
    ) {
        let x2 = x + width;
        let y2 = y + height;

        // Vertex data: [x, y, u, v, r, g, b, a] - white tint, full texture
        // Note: V coordinates are flipped (1-v) because OpenGL framebuffer textures
        // have origin at bottom-left, but we render with Y-down world coordinates
        let vertices: [f32; 32] = [
            // Top-left (UV: 0, 1 - flipped from 0, 0)
            x, y, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, // Top-right (UV: 1, 1 - flipped from 1, 0)
            x2, y, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
            // Bottom-right (UV: 1, 0 - flipped from 1, 1)
            x2, y2, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0,
            // Bottom-left (UV: 0, 0 - flipped from 0, 1)
            x, y2, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0,
        ];

        let indices: [u16; 6] = [0, 1, 2, 0, 2, 3];

        // Use premultiplied alpha blending for render target textures.
        // When we render text to a framebuffer with standard blending, the RGB
        // values become premultiplied by alpha. Using (ONE, ONE_MINUS_SRC_ALPHA)
        // prevents double-multiplying by alpha when drawing the sprite.
        self.gl.blend_func(
            WebGl2RenderingContext::ONE,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        self.gl.use_program(Some(&self.sprite_program));
        self.gl.bind_vertex_array(Some(&self.sprite_vao));

        // Bind the raw texture
        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.sprite_texture_location), 0);

        // Upload vertex data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.sprite_vertex_buffer),
        );

        unsafe {
            let array = js_sys::Float32Array::view(&vertices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Upload index data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
            Some(&self.sprite_index_buffer),
        );

        unsafe {
            let array = js_sys::Uint16Array::view(&indices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Set matrix uniform
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.sprite_matrix_location), false, matrix);

        // Draw
        self.gl.draw_elements_with_i32(
            WebGl2RenderingContext::TRIANGLES,
            6,
            WebGl2RenderingContext::UNSIGNED_SHORT,
            0,
        );

        self.gl.bind_vertex_array(None);

        // Restore standard alpha blending with proper separate functions
        self.gl.blend_func_separate(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
            WebGl2RenderingContext::ONE,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );
    }
}
