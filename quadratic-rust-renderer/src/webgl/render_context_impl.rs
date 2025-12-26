//! RenderContext implementation for WebGL2
//!
//! Uses a buffered command model where draw calls are recorded
//! and executed at end_frame().

use web_sys::WebGl2RenderingContext;

use crate::primitives::TextureId;
use crate::render_context::{DrawCommand, RenderContext, RenderError};

use super::WebGLContext;

impl RenderContext for WebGLContext {
    fn begin_frame(&mut self) {
        self.command_buffer.clear();
    }

    fn end_frame(&mut self) {
        // Execute all buffered commands
        for command in self.command_buffer.commands() {
            self.execute_command(command);
        }
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
        if vertices.is_empty() {
            return;
        }
        self.command_buffer.push(DrawCommand::Triangles {
            vertices: vertices.to_vec(),
            matrix: *matrix,
        });
    }

    fn draw_lines(&mut self, vertices: &[f32], matrix: &[f32; 16]) {
        if vertices.is_empty() {
            return;
        }
        self.command_buffer.push(DrawCommand::Lines {
            vertices: vertices.to_vec(),
            matrix: *matrix,
        });
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
        self.command_buffer.push(DrawCommand::Sprites {
            texture_id,
            vertices: vertices.to_vec(),
            indices: indices.to_vec(),
            matrix: *matrix,
        });
    }

    fn has_font_texture(&self, texture_uid: u32) -> bool {
        self.font_textures.contains_key(&texture_uid)
    }

    fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), RenderError> {
        let texture = self
            .gl
            .create_texture()
            .ok_or_else(|| RenderError("Failed to create texture".to_string()))?;

        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(&texture));

        self.gl
            .tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
                WebGl2RenderingContext::TEXTURE_2D,
                0,
                WebGl2RenderingContext::RGBA as i32,
                width as i32,
                height as i32,
                0,
                WebGl2RenderingContext::RGBA,
                WebGl2RenderingContext::UNSIGNED_BYTE,
                Some(data),
            )
            .map_err(|e| RenderError(format!("Failed to upload texture: {:?}", e)))?;

        // Set texture parameters
        self.gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_WRAP_S,
            WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
        );
        self.gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_WRAP_T,
            WebGl2RenderingContext::CLAMP_TO_EDGE as i32,
        );
        self.gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_MIN_FILTER,
            WebGl2RenderingContext::LINEAR as i32,
        );
        self.gl.tex_parameteri(
            WebGl2RenderingContext::TEXTURE_2D,
            WebGl2RenderingContext::TEXTURE_MAG_FILTER,
            WebGl2RenderingContext::LINEAR as i32,
        );

        self.font_textures.insert(texture_uid, texture);

        log::info!(
            "Uploaded font texture UID {} ({}x{})",
            texture_uid,
            width,
            height
        );
        Ok(())
    }

    fn has_sprite_texture(&self, texture_id: TextureId) -> bool {
        self.texture_manager.get(texture_id).is_some()
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
}

impl WebGLContext {
    /// Execute a single draw command
    fn execute_command(&self, command: &DrawCommand) {
        match command {
            DrawCommand::Clear { r, g, b, a } => {
                self.gl.clear_color(*r, *g, *b, *a);
                self.gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);
            }

            DrawCommand::SetViewport { x, y, width, height } => {
                let flipped_y = self.height as i32 - y - height;
                self.gl.viewport(*x, flipped_y, *width, *height);
            }

            DrawCommand::ResetViewport => {
                self.gl
                    .viewport(0, 0, self.width as i32, self.height as i32);
            }

            DrawCommand::SetScissor { x, y, width, height } => {
                self.gl.enable(WebGl2RenderingContext::SCISSOR_TEST);
                let flipped_y = self.height as i32 - y - height;
                self.gl.scissor(*x, flipped_y, *width, *height);
            }

            DrawCommand::DisableScissor => {
                self.gl.disable(WebGl2RenderingContext::SCISSOR_TEST);
            }

            DrawCommand::Triangles { vertices, matrix } => {
                self.execute_draw_triangles(vertices, matrix);
            }

            DrawCommand::Lines { vertices, matrix } => {
                self.execute_draw_lines(vertices, matrix);
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
                self.execute_draw_text(
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
                self.execute_draw_sprites(*texture_id, vertices, indices, matrix);
            }
        }
    }

    fn execute_draw_triangles(&self, vertices: &[f32], matrix: &[f32; 16]) {
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

    fn execute_draw_lines(&self, vertices: &[f32], matrix: &[f32; 16]) {
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

    fn execute_draw_text(
        &self,
        vertices: &[f32],
        indices: &[u32],
        texture_uid: u32,
        matrix: &[f32; 16],
        viewport_scale: f32,
        font_scale: f32,
        distance_range: f32,
    ) {
        let texture = match self.font_textures.get(&texture_uid) {
            Some(t) => t,
            None => {
                log::warn!("Font texture {} not found", texture_uid);
                return;
            }
        };

        self.gl.use_program(Some(&self.text_program));
        self.gl.bind_vertex_array(Some(&self.text_vao));

        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.text_texture_location), 0);

        let fwidth = distance_range * font_scale * viewport_scale;
        self.gl.uniform1f(Some(&self.text_fwidth_location), fwidth);

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

        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.text_matrix_location), false, matrix);

        self.gl.draw_elements_with_i32(
            WebGl2RenderingContext::TRIANGLES,
            indices.len() as i32,
            WebGl2RenderingContext::UNSIGNED_INT,
            0,
        );

        self.gl.bind_vertex_array(None);
    }

    fn execute_draw_sprites(
        &self,
        texture_id: TextureId,
        vertices: &[f32],
        indices: &[u32],
        matrix: &[f32; 16],
    ) {
        let texture = match self.texture_manager.get(texture_id) {
            Some(tex) => tex,
            None => {
                log::warn!("Texture {} not found for sprite rendering", texture_id);
                return;
            }
        };

        self.gl.use_program(Some(&self.sprite_program));
        self.gl.bind_vertex_array(Some(&self.sprite_vao));

        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.sprite_texture_location), 0);

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

        self.gl.bind_buffer(
            WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
            Some(&self.sprite_index_buffer),
        );

        // Convert u32 indices to u16 for WebGL
        let indices_u16: Vec<u16> = indices.iter().map(|&i| i as u16).collect();

        unsafe {
            let array = js_sys::Uint16Array::view(&indices_u16);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.sprite_matrix_location), false, matrix);

        self.gl.draw_elements_with_i32(
            WebGl2RenderingContext::TRIANGLES,
            indices_u16.len() as i32,
            WebGl2RenderingContext::UNSIGNED_SHORT,
            0,
        );

        self.gl.bind_vertex_array(None);
    }
}
