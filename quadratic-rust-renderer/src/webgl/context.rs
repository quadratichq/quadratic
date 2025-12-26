//! WebGL2 rendering context
//!
//! Manages WebGL2 state, shaders, and rendering for the browser worker.

use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlImageElement, OffscreenCanvas, WebGl2RenderingContext, WebGlBuffer, WebGlContextAttributes,
    WebGlProgram, WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

use super::primitives::texture::{TextureId, TextureManager};
use super::shaders::{
    BASIC_FRAGMENT_SHADER, BASIC_VERTEX_SHADER, MSDF_FRAGMENT_SHADER, MSDF_VERTEX_SHADER,
    SPRITE_FRAGMENT_SHADER, SPRITE_VERTEX_SHADER,
};

/// WebGL2 rendering context
pub struct WebGLContext {
    canvas: OffscreenCanvas,
    pub(crate) gl: WebGl2RenderingContext,
    width: u32,
    height: u32,

    // Shader program for basic rendering (lines, rectangles)
    pub(crate) basic_program: WebGlProgram,
    pub(crate) matrix_location: WebGlUniformLocation,

    // Shader program for MSDF text rendering
    pub(crate) text_program: WebGlProgram,
    pub(crate) text_matrix_location: WebGlUniformLocation,
    pub(crate) text_texture_location: WebGlUniformLocation,
    pub(crate) text_fwidth_location: WebGlUniformLocation,

    // VAO for text rendering
    pub(crate) text_vao: WebGlVertexArrayObject,
    pub(crate) text_vertex_buffer: WebGlBuffer,
    pub(crate) text_index_buffer: WebGlBuffer,

    // Font textures indexed by texture UID
    pub(crate) font_textures: HashMap<u32, WebGlTexture>,

    // Vertex Array Object for basic geometry
    pub(crate) vao: WebGlVertexArrayObject,
    pub(crate) vertex_buffer: WebGlBuffer,

    // Shader program for sprite rendering
    pub(crate) sprite_program: WebGlProgram,
    pub(crate) sprite_matrix_location: WebGlUniformLocation,
    pub(crate) sprite_texture_location: WebGlUniformLocation,

    // VAO and buffers for sprite rendering
    pub(crate) sprite_vao: WebGlVertexArrayObject,
    pub(crate) sprite_vertex_buffer: WebGlBuffer,
    pub(crate) sprite_index_buffer: WebGlBuffer,

    // Texture manager for sprites
    pub(crate) texture_manager: TextureManager,
}

impl WebGLContext {
    /// Create a new WebGL context from an OffscreenCanvas
    pub fn from_offscreen_canvas(canvas: OffscreenCanvas) -> Result<Self, JsValue> {
        let width = canvas.width();
        let height = canvas.height();

        // Configure WebGL context with anti-aliasing
        let context_options = WebGlContextAttributes::new();
        context_options.set_antialias(true);
        context_options.set_alpha(true);
        context_options.set_premultiplied_alpha(true);

        // Get WebGL2 context with options
        let gl = canvas
            .get_context_with_context_options("webgl2", &context_options)?
            .ok_or("WebGL2 not supported")?
            .dyn_into::<WebGl2RenderingContext>()?;

        // Compile and link basic shader program
        let basic_program = Self::create_program(&gl, BASIC_VERTEX_SHADER, BASIC_FRAGMENT_SHADER)?;

        // Get basic program uniform locations
        let matrix_location = gl
            .get_uniform_location(&basic_program, "u_matrix")
            .ok_or("Failed to get u_matrix location")?;

        // Compile and link text shader program
        let text_program = Self::create_program(&gl, MSDF_VERTEX_SHADER, MSDF_FRAGMENT_SHADER)?;

        // Get text program uniform locations
        let text_matrix_location = gl
            .get_uniform_location(&text_program, "u_matrix")
            .ok_or("Failed to get text u_matrix location")?;
        let text_texture_location = gl
            .get_uniform_location(&text_program, "u_texture")
            .ok_or("Failed to get u_texture location")?;
        let text_fwidth_location = gl
            .get_uniform_location(&text_program, "u_fwidth")
            .ok_or("Failed to get u_fwidth location")?;

        // Create basic VAO and buffers
        let vao = gl.create_vertex_array().ok_or("Failed to create VAO")?;

        let vertex_buffer = gl.create_buffer().ok_or("Failed to create vertex buffer")?;

        // Setup basic VAO
        gl.bind_vertex_array(Some(&vao));
        gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&vertex_buffer));

        // Position attribute: 2 floats
        let position_loc = gl.get_attrib_location(&basic_program, "a_position") as u32;
        gl.enable_vertex_attrib_array(position_loc);
        gl.vertex_attrib_pointer_with_i32(
            position_loc,
            2, // 2 components (x, y)
            WebGl2RenderingContext::FLOAT,
            false, // not normalized
            6 * 4, // stride: 6 floats * 4 bytes
            0,     // offset: 0
        );

        // Color attribute: 4 floats
        let color_loc = gl.get_attrib_location(&basic_program, "a_color") as u32;
        gl.enable_vertex_attrib_array(color_loc);
        gl.vertex_attrib_pointer_with_i32(
            color_loc,
            4, // 4 components (r, g, b, a)
            WebGl2RenderingContext::FLOAT,
            false, // not normalized
            6 * 4, // stride: 6 floats * 4 bytes
            2 * 4, // offset: 2 floats * 4 bytes
        );

        gl.bind_vertex_array(None);

        // Create text VAO and buffers
        let text_vao = gl
            .create_vertex_array()
            .ok_or("Failed to create text VAO")?;

        let text_vertex_buffer = gl
            .create_buffer()
            .ok_or("Failed to create text vertex buffer")?;

        let text_index_buffer = gl
            .create_buffer()
            .ok_or("Failed to create text index buffer")?;

        // Setup text VAO
        // Layout: [x, y, u, v, r, g, b, a] = 8 floats per vertex
        gl.bind_vertex_array(Some(&text_vao));
        gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&text_vertex_buffer),
        );
        gl.bind_buffer(
            WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
            Some(&text_index_buffer),
        );

        // Position attribute: 2 floats
        let text_pos_loc = gl.get_attrib_location(&text_program, "a_position") as u32;
        gl.enable_vertex_attrib_array(text_pos_loc);
        gl.vertex_attrib_pointer_with_i32(
            text_pos_loc,
            2, // 2 components (x, y)
            WebGl2RenderingContext::FLOAT,
            false,
            8 * 4, // stride: 8 floats * 4 bytes
            0,     // offset: 0
        );

        // Texcoord attribute: 2 floats
        let texcoord_loc = gl.get_attrib_location(&text_program, "a_texcoord") as u32;
        gl.enable_vertex_attrib_array(texcoord_loc);
        gl.vertex_attrib_pointer_with_i32(
            texcoord_loc,
            2, // 2 components (u, v)
            WebGl2RenderingContext::FLOAT,
            false,
            8 * 4, // stride: 8 floats * 4 bytes
            2 * 4, // offset: 2 floats
        );

        // Color attribute: 4 floats
        let text_color_loc = gl.get_attrib_location(&text_program, "a_color") as u32;
        gl.enable_vertex_attrib_array(text_color_loc);
        gl.vertex_attrib_pointer_with_i32(
            text_color_loc,
            4, // 4 components (r, g, b, a)
            WebGl2RenderingContext::FLOAT,
            false,
            8 * 4, // stride: 8 floats * 4 bytes
            4 * 4, // offset: 4 floats
        );

        gl.bind_vertex_array(None);

        // Compile and link sprite shader program
        let sprite_program =
            Self::create_program(&gl, SPRITE_VERTEX_SHADER, SPRITE_FRAGMENT_SHADER)?;

        // Get sprite program uniform locations
        let sprite_matrix_location = gl
            .get_uniform_location(&sprite_program, "u_matrix")
            .ok_or("Failed to get sprite u_matrix location")?;
        let sprite_texture_location = gl
            .get_uniform_location(&sprite_program, "u_texture")
            .ok_or("Failed to get sprite u_texture location")?;

        // Create sprite VAO and buffers
        let sprite_vao = gl
            .create_vertex_array()
            .ok_or("Failed to create sprite VAO")?;

        let sprite_vertex_buffer = gl
            .create_buffer()
            .ok_or("Failed to create sprite vertex buffer")?;

        let sprite_index_buffer = gl
            .create_buffer()
            .ok_or("Failed to create sprite index buffer")?;

        // Setup sprite VAO
        // Layout: [x, y, u, v, r, g, b, a] = 8 floats per vertex
        gl.bind_vertex_array(Some(&sprite_vao));
        gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&sprite_vertex_buffer),
        );
        gl.bind_buffer(
            WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
            Some(&sprite_index_buffer),
        );

        // Position attribute: 2 floats
        let sprite_pos_loc = gl.get_attrib_location(&sprite_program, "a_position") as u32;
        gl.enable_vertex_attrib_array(sprite_pos_loc);
        gl.vertex_attrib_pointer_with_i32(
            sprite_pos_loc,
            2, // 2 components (x, y)
            WebGl2RenderingContext::FLOAT,
            false,
            8 * 4, // stride: 8 floats * 4 bytes
            0,     // offset: 0
        );

        // Texcoord attribute: 2 floats
        let sprite_texcoord_loc = gl.get_attrib_location(&sprite_program, "a_texcoord") as u32;
        gl.enable_vertex_attrib_array(sprite_texcoord_loc);
        gl.vertex_attrib_pointer_with_i32(
            sprite_texcoord_loc,
            2, // 2 components (u, v)
            WebGl2RenderingContext::FLOAT,
            false,
            8 * 4, // stride: 8 floats * 4 bytes
            2 * 4, // offset: 2 floats
        );

        // Color attribute: 4 floats
        let sprite_color_loc = gl.get_attrib_location(&sprite_program, "a_color") as u32;
        gl.enable_vertex_attrib_array(sprite_color_loc);
        gl.vertex_attrib_pointer_with_i32(
            sprite_color_loc,
            4, // 4 components (r, g, b, a)
            WebGl2RenderingContext::FLOAT,
            false,
            8 * 4, // stride: 8 floats * 4 bytes
            4 * 4, // offset: 4 floats
        );

        gl.bind_vertex_array(None);

        // Enable blending for transparency
        gl.enable(WebGl2RenderingContext::BLEND);
        gl.blend_func(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        log::info!("WebGL2 context created ({}x{})", width, height);

        Ok(Self {
            canvas,
            gl,
            width,
            height,
            basic_program,
            matrix_location,
            text_program,
            text_matrix_location,
            text_texture_location,
            text_fwidth_location,
            vao,
            vertex_buffer,
            text_vao,
            text_vertex_buffer,
            text_index_buffer,
            font_textures: HashMap::new(),
            sprite_program,
            sprite_matrix_location,
            sprite_texture_location,
            sprite_vao,
            sprite_vertex_buffer,
            sprite_index_buffer,
            texture_manager: TextureManager::new(),
        })
    }

    /// Resize the rendering surface
    pub fn resize(&mut self, width: u32, height: u32) {
        // Resize the canvas buffer
        self.canvas.set_width(width);
        self.canvas.set_height(height);

        // Update internal dimensions and viewport
        self.width = width;
        self.height = height;
        self.gl.viewport(0, 0, width as i32, height as i32);
    }

    /// Set the viewport to a specific area
    /// This controls where NDC coordinates map to on the screen
    /// Note: WebGL Y=0 is at bottom, so we flip the y coordinate
    pub fn set_viewport(&self, x: i32, y: i32, width: i32, height: i32) {
        // Flip Y coordinate for WebGL (Y=0 at bottom)
        let flipped_y = self.height as i32 - y - height;
        self.gl.viewport(x, flipped_y, width, height);
    }

    /// Reset viewport to full canvas
    pub fn reset_viewport(&self) {
        self.gl
            .viewport(0, 0, self.width as i32, self.height as i32);
    }

    /// Set scissor rect for clipping
    /// Note: WebGL Y=0 is at bottom, so we flip the y coordinate
    pub fn set_scissor(&self, x: i32, y: i32, width: i32, height: i32) {
        self.gl.enable(WebGl2RenderingContext::SCISSOR_TEST);
        // Flip Y coordinate for WebGL (Y=0 at bottom)
        let flipped_y = self.height as i32 - y - height;
        self.gl.scissor(x, flipped_y, width, height);
    }

    /// Disable scissor test
    pub fn disable_scissor(&self) {
        self.gl.disable(WebGl2RenderingContext::SCISSOR_TEST);
    }

    /// Get current width
    pub fn width(&self) -> u32 {
        self.width
    }

    /// Get current height
    pub fn height(&self) -> u32 {
        self.height
    }

    /// Upload a font texture from an image
    #[allow(dead_code)]
    pub fn upload_font_texture(
        &mut self,
        texture_uid: u32,
        image: &HtmlImageElement,
    ) -> Result<(), JsValue> {
        let texture = self.gl.create_texture().ok_or("Failed to create texture")?;

        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(&texture));

        // Upload image data
        self.gl
            .tex_image_2d_with_u32_and_u32_and_html_image_element(
                WebGl2RenderingContext::TEXTURE_2D,
                0,
                WebGl2RenderingContext::RGBA as i32,
                WebGl2RenderingContext::RGBA,
                WebGl2RenderingContext::UNSIGNED_BYTE,
                image,
            )?;

        self.set_texture_parameters();
        self.font_textures.insert(texture_uid, texture);

        log::info!("Uploaded font texture UID {}", texture_uid);
        Ok(())
    }

    /// Upload a font texture from raw RGBA pixel data
    pub fn upload_font_texture_from_data(
        &mut self,
        texture_uid: u32,
        width: u32,
        height: u32,
        data: &[u8],
    ) -> Result<(), JsValue> {
        let texture = self.gl.create_texture().ok_or("Failed to create texture")?;

        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(&texture));

        // Upload raw pixel data
        self.gl
            .tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
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

        self.set_texture_parameters();
        self.font_textures.insert(texture_uid, texture);

        log::info!(
            "Uploaded font texture UID {} ({}x{})",
            texture_uid,
            width,
            height
        );
        Ok(())
    }

    /// Set texture parameters for MSDF fonts
    fn set_texture_parameters(&self) {
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
    }

    /// Check if a font texture is loaded
    pub fn has_font_texture(&self, texture_uid: u32) -> bool {
        self.font_textures.contains_key(&texture_uid)
    }

    /// Get the WebGL context reference (for advanced operations)
    pub fn gl(&self) -> &WebGl2RenderingContext {
        &self.gl
    }

    /// Clear the canvas with a color
    pub fn clear(&self, r: f32, g: f32, b: f32, a: f32) {
        self.gl.clear_color(r, g, b, a);
        self.gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);
    }

    /// Render lines from vertex data
    /// Each vertex is: [x, y, r, g, b, a] (6 floats)
    /// Lines are rendered as pairs of vertices
    pub fn draw_lines(&self, vertices: &[f32], matrix: &[f32; 16]) {
        if vertices.is_empty() {
            return;
        }

        self.gl.use_program(Some(&self.basic_program));
        self.gl.bind_vertex_array(Some(&self.vao));

        // Upload vertex data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.vertex_buffer),
        );

        // SAFETY: We're passing a slice of f32s to WebGL
        unsafe {
            let array = js_sys::Float32Array::view(vertices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Set matrix uniform
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.matrix_location), false, matrix);

        // Draw lines
        let vertex_count = (vertices.len() / 6) as i32;
        self.gl
            .draw_arrays(WebGl2RenderingContext::LINES, 0, vertex_count);

        self.gl.bind_vertex_array(None);
    }

    /// Render triangles from vertex data (for filled rectangles)
    /// Each vertex is: [x, y, r, g, b, a] (6 floats)
    pub fn draw_triangles(&self, vertices: &[f32], matrix: &[f32; 16]) {
        if vertices.is_empty() {
            return;
        }

        self.gl.use_program(Some(&self.basic_program));
        self.gl.bind_vertex_array(Some(&self.vao));

        // Upload vertex data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.vertex_buffer),
        );

        // SAFETY: We're passing a slice of f32s to WebGL
        unsafe {
            let array = js_sys::Float32Array::view(vertices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Set matrix uniform
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.matrix_location), false, matrix);

        // Draw triangles
        let vertex_count = (vertices.len() / 6) as i32;
        self.gl
            .draw_arrays(WebGl2RenderingContext::TRIANGLES, 0, vertex_count);

        self.gl.bind_vertex_array(None);
    }

    /// Get mutable access to the texture manager
    pub fn texture_manager_mut(&mut self) -> &mut TextureManager {
        &mut self.texture_manager
    }

    /// Get read access to the texture manager
    pub fn texture_manager(&self) -> &TextureManager {
        &self.texture_manager
    }

    /// Render sprites from vertex data (non-indexed)
    /// Each vertex is: [x, y, u, v, r, g, b, a] (8 floats)
    /// Sprites are rendered as 2 triangles (6 vertices) each
    pub fn draw_sprites(&self, texture_id: TextureId, vertices: &[f32], matrix: &[f32; 16]) {
        if vertices.is_empty() {
            return;
        }

        // Get texture from manager
        let texture = match self.texture_manager.get(texture_id) {
            Some(tex) => tex,
            None => {
                log::warn!("Texture {} not found for sprite rendering", texture_id);
                return;
            }
        };

        self.gl.use_program(Some(&self.sprite_program));
        self.gl.bind_vertex_array(Some(&self.sprite_vao));

        // Bind texture
        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.sprite_texture_location), 0);

        // Upload vertex data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.sprite_vertex_buffer),
        );

        // SAFETY: We're passing a slice of f32s to WebGL
        unsafe {
            let array = js_sys::Float32Array::view(vertices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Set matrix uniform
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.sprite_matrix_location), false, matrix);

        // Draw triangles
        let vertex_count = (vertices.len() / 8) as i32;
        self.gl
            .draw_arrays(WebGl2RenderingContext::TRIANGLES, 0, vertex_count);

        self.gl.bind_vertex_array(None);
    }

    /// Render sprites from vertex and index data (indexed rendering)
    /// Each vertex is: [x, y, u, v, r, g, b, a] (8 floats)
    /// Uses indices for efficient quad rendering (4 vertices + 6 indices per sprite)
    pub fn draw_sprites_indexed(
        &self,
        texture_id: TextureId,
        vertices: &[f32],
        indices: &[u16],
        matrix: &[f32; 16],
    ) {
        if vertices.is_empty() || indices.is_empty() {
            return;
        }

        // Get texture from manager
        let texture = match self.texture_manager.get(texture_id) {
            Some(tex) => tex,
            None => {
                log::warn!("Texture {} not found for sprite rendering", texture_id);
                return;
            }
        };

        self.gl.use_program(Some(&self.sprite_program));
        self.gl.bind_vertex_array(Some(&self.sprite_vao));

        // Bind texture
        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.sprite_texture_location), 0);

        // Upload vertex data
        self.gl.bind_buffer(
            WebGl2RenderingContext::ARRAY_BUFFER,
            Some(&self.sprite_vertex_buffer),
        );

        // SAFETY: We're passing a slice of f32s to WebGL
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

        // SAFETY: We're passing a slice of u16s to WebGL
        unsafe {
            let array = js_sys::Uint16Array::view(indices);
            self.gl.buffer_data_with_array_buffer_view(
                WebGl2RenderingContext::ELEMENT_ARRAY_BUFFER,
                &array,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        }

        // Set matrix uniform
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.sprite_matrix_location), false, matrix);

        // Draw indexed triangles
        self.gl.draw_elements_with_i32(
            WebGl2RenderingContext::TRIANGLES,
            indices.len() as i32,
            WebGl2RenderingContext::UNSIGNED_SHORT,
            0,
        );

        self.gl.bind_vertex_array(None);
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
            x, y, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
            // Top-right (UV: 1, 1 - flipped from 1, 0)
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

        // Restore standard alpha blending
        self.gl.blend_func(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );
    }

    /// Get the canvas width
    pub fn canvas_width(&self) -> u32 {
        self.width
    }

    /// Get the canvas height
    pub fn canvas_height(&self) -> u32 {
        self.height
    }
}
