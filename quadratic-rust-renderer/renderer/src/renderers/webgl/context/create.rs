use wasm_bindgen::{JsCast, JsValue};
use web_sys::{OffscreenCanvas, WebGl2RenderingContext, WebGlContextAttributes};

use super::super::font_manager::FontManager;
use super::super::shaders::{
    BASIC_FRAGMENT_SHADER, BASIC_VERTEX_SHADER, MSDF_FRAGMENT_SHADER, MSDF_VERTEX_SHADER,
    SPRITE_FRAGMENT_SHADER, SPRITE_VERTEX_SHADER,
};
use super::super::texture_manager::TextureManager;
use super::WebGLContext;
use crate::renderers::render_context::CommandBuffer;

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

        // Enable blending for transparency with proper state
        // Use blend_func_separate to match WebGPU behavior:
        // RGB: (SrcAlpha, OneMinusSrcAlpha) - standard alpha blending
        // Alpha: (One, OneMinusSrcAlpha) - preserves alpha without squaring
        gl.enable(WebGl2RenderingContext::BLEND);
        gl.blend_func_separate(
            WebGl2RenderingContext::SRC_ALPHA,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
            WebGl2RenderingContext::ONE,
            WebGl2RenderingContext::ONE_MINUS_SRC_ALPHA,
        );

        log::info!("WebGL2 context created ({}x{})", width, height);

        Ok(Self {
            canvas,
            gl,
            width,
            height,
            command_buffer: CommandBuffer::new(),
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
            font_texture_manager: FontManager::new(),
            sprite_program,
            sprite_matrix_location,
            sprite_texture_location,
            sprite_vao,
            sprite_vertex_buffer,
            sprite_index_buffer,
            texture_manager: TextureManager::new(),
        })
    }
}
