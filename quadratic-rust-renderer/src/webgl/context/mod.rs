//! WebGL2 rendering context
//!
//! Manages WebGL2 state, shaders, and rendering for the browser worker.

use web_sys::{
    OffscreenCanvas, WebGl2RenderingContext, WebGlBuffer, WebGlProgram, WebGlUniformLocation,
    WebGlVertexArrayObject,
};

use super::font_manager::FontManager;

use super::texture_manager::TextureManager;
use crate::render_context::CommandBuffer;

mod create;
mod draw;
mod render_context;
mod textures;
mod viewport;

/// WebGL2 rendering context
pub struct WebGLContext {
    pub(crate) canvas: OffscreenCanvas,
    pub(crate) gl: WebGl2RenderingContext,
    pub(crate) width: u32,
    pub(crate) height: u32,

    // Command buffer for deferred rendering
    pub(crate) command_buffer: CommandBuffer,

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

    // Font texture manager
    pub(crate) font_texture_manager: FontManager,

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
