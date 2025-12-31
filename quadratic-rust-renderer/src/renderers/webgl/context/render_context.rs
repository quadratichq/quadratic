//! RenderContext trait implementation for WebGL2
//!
//! Executes draw calls immediately for compatibility with existing code
//! that mixes direct WebGLContext calls with RenderContext trait calls.

use web_sys::WebGl2RenderingContext;

use super::WebGLContext;
use crate::renderers::render_context::{RenderContext, RenderError};
use crate::renderers::TextureId;

impl RenderContext for WebGLContext {
    fn begin_frame(&mut self) {
        // No-op for immediate mode
    }

    fn end_frame(&mut self) {
        // No-op for immediate mode
    }

    fn resize(&mut self, width: u32, height: u32) {
        self.canvas.set_width(width);
        self.canvas.set_height(height);
        self.width = width;
        self.height = height;
        self.gl.viewport(0, 0, width as i32, height as i32);
    }

    fn width(&self) -> u32 {
        self.width
    }

    fn height(&self) -> u32 {
        self.height
    }

    fn backend_name(&self) -> &'static str {
        "WebGL2"
    }

    fn clear(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.gl.clear_color(r, g, b, a);
        self.gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);
    }

    fn set_viewport(&mut self, x: i32, y: i32, width: i32, height: i32) {
        // WebGL viewport Y is from bottom, but we pass Y from top
        let flipped_y = self.height as i32 - y - height;
        self.gl.viewport(x, flipped_y, width, height);
    }

    fn reset_viewport(&mut self) {
        self.gl
            .viewport(0, 0, self.width as i32, self.height as i32);
    }

    fn set_scissor(&mut self, x: i32, y: i32, width: i32, height: i32) {
        self.gl.enable(WebGl2RenderingContext::SCISSOR_TEST);
        let flipped_y = self.height as i32 - y - height;
        self.gl.scissor(x, flipped_y, width, height);
    }

    fn disable_scissor(&mut self) {
        self.gl.disable(WebGl2RenderingContext::SCISSOR_TEST);
    }

    fn draw_triangles(&mut self, vertices: &[f32], matrix: &[f32; 16]) {
        if vertices.is_empty() {
            return;
        }

        // Ensure blending is enabled with proper state
        self.gl.enable(WebGl2RenderingContext::BLEND);
        self.gl.blend_func_separate(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
            WebGl2RenderingContext::ONE,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        self.gl.use_program(Some(&self.basic_program));
        self.gl.bind_vertex_array(Some(&self.vao));

        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.vertex_buffer),
        );

        unsafe {
            let array = js_sys::Float32Array::view(vertices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.matrix_location), false, matrix);

        let vertex_count = (vertices.len() / 6) as i32;
        self.gl
            .draw_arrays(WebGl2RenderingContext::TRIANGLES, 0, vertex_count);

        self.gl.bind_vertex_array(None);
    }

    fn draw_lines(&mut self, vertices: &[f32], matrix: &[f32; 16]) {
        if vertices.is_empty() {
            return;
        }

        // Ensure blending is enabled with proper state
        self.gl.enable(WebGl2RenderingContext::BLEND);
        self.gl.blend_func_separate(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
            WebGl2RenderingContext::ONE,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        self.gl.use_program(Some(&self.basic_program));
        self.gl.bind_vertex_array(Some(&self.vao));

        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.vertex_buffer),
        );

        unsafe {
            let array = js_sys::Float32Array::view(vertices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.matrix_location), false, matrix);

        let vertex_count = (vertices.len() / 6) as i32;
        self.gl
            .draw_arrays(WebGl2RenderingContext::LINES, 0, vertex_count);

        self.gl.bind_vertex_array(None);
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
        if vertices.is_empty() || indices.is_empty() {
            return;
        }

        // Get the font texture
        let texture = match self.font_texture_manager.get(texture_uid) {
            Some(t) => t,
            None => return,
        };

        self.gl.use_program(Some(&self.text_program));
        self.gl.bind_vertex_array(Some(&self.text_vao));

        // Upload vertex data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.text_vertex_buffer),
        );
        unsafe {
            let array = js_sys::Float32Array::view(vertices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Upload index data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
            Some(&self.text_index_buffer),
        );
        unsafe {
            let array = js_sys::Uint32Array::view(indices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Set uniforms
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.text_matrix_location), false, matrix);

        // Bind texture
        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.text_texture_location), 0);

        // Calculate fwidth for antialiasing
        let fwidth = font_scale * distance_range * viewport_scale;
        self.gl.uniform1f(Some(&self.text_fwidth_location), fwidth);

        // Enable blending for text with separate RGB/Alpha blend functions
        // RGB: (SrcAlpha, OneMinusSrcAlpha) - standard alpha blending
        // Alpha: (One, OneMinusSrcAlpha) - preserves alpha without squaring
        // This matches WebGPU behavior and prevents text from appearing lighter
        self.gl.enable(WebGl2RenderingContext::BLEND);
        self.gl.blend_func_separate(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
            WebGl2RenderingContext::ONE,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        // Draw
        self.gl.draw_elements_with_i32(
            WebGl2RenderingContext::TRIANGLES,
            indices.len() as i32,
            WebGl2RenderingContext::UNSIGNED_INT,
            0,
        );

        self.gl.bind_vertex_array(None);
    }

    fn has_font_texture(&self, texture_uid: u32) -> bool {
        self.font_texture_manager.has_texture(texture_uid)
    }

    fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError> {
        self.font_texture_manager
            .upload_rgba(&self.gl, texture_uid, width, height, data)
            .map_err(|e| RenderError(format!("Failed to upload font texture: {:?}", e)))
    }

    fn has_sprite_texture(&self, texture_id: TextureId) -> bool {
        self.texture_manager.has_texture(texture_id)
    }

    fn upload_sprite_texture(
        &mut self,
        texture_id: TextureId,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError> {
        self.texture_manager
            .upload_rgba(&self.gl, texture_id, width, height, data)
            .map_err(|e| RenderError(format!("Failed to upload sprite texture: {:?}", e)))
    }

    fn remove_sprite_texture(&mut self, texture_id: TextureId) {
        self.texture_manager.remove(&self.gl, texture_id);
    }

    fn draw_sprites(
        &mut self,
        texture_id: TextureId,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() || indices.is_empty() {
            return;
        }

        let texture = match self.texture_manager.get(texture_id) {
            Some(t) => t,
            None => return,
        };

        self.gl.use_program(Some(&self.sprite_program));
        self.gl.bind_vertex_array(Some(&self.sprite_vao));

        // Upload vertex data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.sprite_vertex_buffer),
        );
        unsafe {
            let array = js_sys::Float32Array::view(vertices);
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
            let array = js_sys::Uint32Array::view(indices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Set uniforms
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.sprite_matrix_location), false, matrix);

        // Bind texture
        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.sprite_texture_location), 0);

        // Enable blending with proper state
        self.gl.enable(WebGl2RenderingContext::BLEND);
        self.gl.blend_func_separate(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
            WebGl2RenderingContext::ONE,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        // Draw
        self.gl.draw_elements_with_i32(
            WebGl2RenderingContext::TRIANGLES,
            indices.len() as i32,
            WebGl2RenderingContext::UNSIGNED_INT,
            0,
        );

        self.gl.bind_vertex_array(None);
    }
}
