//! WebGL2 rendering context
//!
//! Manages WebGL2 state, shaders, and rendering for the browser worker.

use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlImageElement, OffscreenCanvas, WebGl2RenderingContext, WebGlBuffer, WebGlContextAttributes,
    WebGlProgram, WebGlShader, WebGlTexture, WebGlUniformLocation, WebGlVertexArrayObject,
};

use super::shaders::{
    BASIC_FRAGMENT_SHADER, BASIC_VERTEX_SHADER, MSDF_FRAGMENT_SHADER, MSDF_VERTEX_SHADER,
};

/// WebGL2 rendering context
pub struct WebGLContext {
    canvas: OffscreenCanvas,
    gl: WebGl2RenderingContext,
    width: u32,
    height: u32,

    // Shader program for basic rendering (lines, rectangles)
    basic_program: WebGlProgram,
    matrix_location: WebGlUniformLocation,

    // Shader program for MSDF text rendering
    text_program: WebGlProgram,
    text_matrix_location: WebGlUniformLocation,
    text_texture_location: WebGlUniformLocation,
    text_fwidth_location: WebGlUniformLocation,

    // Vertex Array Object for basic geometry
    vao: WebGlVertexArrayObject,
    vertex_buffer: WebGlBuffer,

    // VAO for text rendering
    text_vao: WebGlVertexArrayObject,
    text_vertex_buffer: WebGlBuffer,
    text_index_buffer: WebGlBuffer,

    // Font textures indexed by texture UID
    font_textures: HashMap<u32, WebGlTexture>,
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
        })
    }

    /// Compile a shader
    fn compile_shader(
        gl: &WebGl2RenderingContext,
        shader_type: u32,
        source: &str,
    ) -> Result<WebGlShader, JsValue> {
        let shader = gl
            .create_shader(shader_type)
            .ok_or("Failed to create shader")?;

        gl.shader_source(&shader, source);
        gl.compile_shader(&shader);

        if gl
            .get_shader_parameter(&shader, WebGl2RenderingContext::COMPILE_STATUS)
            .as_bool()
            .unwrap_or(false)
        {
            Ok(shader)
        } else {
            let log = gl.get_shader_info_log(&shader).unwrap_or_default();
            gl.delete_shader(Some(&shader));
            Err(JsValue::from_str(&format!(
                "Shader compilation failed: {}",
                log
            )))
        }
    }

    /// Create and link a shader program
    fn create_program(
        gl: &WebGl2RenderingContext,
        vertex_source: &str,
        fragment_source: &str,
    ) -> Result<WebGlProgram, JsValue> {
        let vertex_shader =
            Self::compile_shader(gl, WebGl2RenderingContext::VERTEX_SHADER, vertex_source)?;
        let fragment_shader =
            Self::compile_shader(gl, WebGl2RenderingContext::FRAGMENT_SHADER, fragment_source)?;

        let program = gl.create_program().ok_or("Failed to create program")?;

        gl.attach_shader(&program, &vertex_shader);
        gl.attach_shader(&program, &fragment_shader);
        gl.link_program(&program);

        // Clean up shaders (they're now part of the program)
        gl.delete_shader(Some(&vertex_shader));
        gl.delete_shader(Some(&fragment_shader));

        if gl
            .get_program_parameter(&program, WebGl2RenderingContext::LINK_STATUS)
            .as_bool()
            .unwrap_or(false)
        {
            Ok(program)
        } else {
            let log = gl.get_program_info_log(&program).unwrap_or_default();
            gl.delete_program(Some(&program));
            Err(JsValue::from_str(&format!(
                "Program linking failed: {}",
                log
            )))
        }
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

    /// Render text mesh
    /// vertices: [x, y, u, v, r, g, b, a] per vertex (8 floats)
    /// indices: triangle indices (u32 to support large meshes)
    /// Render text mesh with MSDF shader
    ///
    /// Parameters:
    /// - `vertices`: Vertex data [x, y, u, v, r, g, b, a] per vertex
    /// - `indices`: Triangle indices
    /// - `texture_uid`: Font texture ID
    /// - `matrix`: View-projection matrix
    /// - `viewport_scale`: Current zoom level
    /// - `font_scale`: render_font_size / atlas_font_size (e.g., 14/42 for OpenSans)
    /// - `distance_range`: MSDF distance field range (typically 4)
    pub fn draw_text(
        &self,
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

        let texture = match self.font_textures.get(&texture_uid) {
            Some(t) => t,
            None => {
                log::warn!("Font texture {} not found", texture_uid);
                return;
            }
        };

        self.gl.use_program(Some(&self.text_program));
        self.gl.bind_vertex_array(Some(&self.text_vao));

        // Bind texture
        self.gl.active_texture(WebGl2RenderingContext::TEXTURE0);
        self.gl
            .bind_texture(WebGl2RenderingContext::TEXTURE_2D, Some(texture));
        self.gl.uniform1i(Some(&self.text_texture_location), 0);

        // Set fwidth uniform (for MSDF anti-aliasing)
        // Formula: distance_range * font_scale * viewport_scale
        // For OpenSans at 14px (atlas 42px): 4 * (14/42) * scale ≈ 1.33 * scale
        let fwidth = distance_range * font_scale * viewport_scale;
        self.gl.uniform1f(Some(&self.text_fwidth_location), fwidth);

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

        // Upload index data (u32 to support large meshes)
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

        // Set matrix uniform
        self.gl
            .uniform_matrix4fv_with_f32_array(Some(&self.text_matrix_location), false, matrix);

        // Draw indexed triangles (UNSIGNED_INT for u32 indices)
        self.gl.draw_elements_with_i32(
            WebGl2RenderingContext::TRIANGLES,
            indices.len() as i32,
            WebGl2RenderingContext::UNSIGNED_INT,
            0,
        );

        self.gl.bind_vertex_array(None);
    }

    /// Get the WebGL context reference (for advanced operations)
    pub fn gl(&self) -> &WebGl2RenderingContext {
        &self.gl
    }
}
