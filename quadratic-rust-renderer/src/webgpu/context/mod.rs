//! WebGPU rendering context using wgpu
//!
//! Manages WebGPU state, pipelines, and rendering for the browser worker.
//! Uses the wgpu crate for a stable, cross-platform WebGPU abstraction.
//!
//! ## WebGPU-specific Optimizations
//!
//! This implementation leverages WebGPU features not available in WebGL:
//!
//! - **Render Bundles**: Pre-recorded command sequences for static content
//!   (grid lines, cached text). Replay with near-zero CPU overhead.
//! - **Instanced Rendering**: Single draw call for many similar objects.
//! - **Persistent Bind Groups**: Pre-created and cached, avoiding per-frame allocation.
//! - **Compute Shaders**: GPU-parallel culling and text layout (future).

use std::collections::HashMap;

use super::font_manager::FontManager;
use super::mipmap::MipmapGenerator;
use crate::render_context::CommandBuffer;

mod create;
mod draw;
mod render_context;
mod textures;
mod viewport;

/// Texture ID type (matches WebGL version)
pub type TextureId = u32;

/// WebGPU rendering context using wgpu
pub struct WebGPUContext {
    pub(crate) device: wgpu::Device,
    pub(crate) queue: wgpu::Queue,
    pub(crate) surface: wgpu::Surface<'static>,
    pub(crate) surface_config: wgpu::SurfaceConfiguration,
    pub(crate) width: u32,
    pub(crate) height: u32,

    // Command buffer for deferred rendering
    pub(crate) command_buffer: CommandBuffer,

    // Basic pipeline (triangles/rectangles)
    pub(crate) basic_pipeline: wgpu::RenderPipeline,
    pub(crate) basic_bind_group_layout: wgpu::BindGroupLayout,

    // Line pipeline (native GPU line rasterization)
    pub(crate) line_pipeline: wgpu::RenderPipeline,

    // Text pipeline (MSDF)
    pub(crate) text_pipeline: wgpu::RenderPipeline,
    pub(crate) text_bind_group_layout: wgpu::BindGroupLayout,

    // Sprite pipeline (standard alpha blending)
    pub(crate) sprite_pipeline: wgpu::RenderPipeline,
    pub(crate) sprite_bind_group_layout: wgpu::BindGroupLayout,

    // Sprite pipeline for premultiplied alpha (used for render target textures)
    pub(crate) sprite_premult_pipeline: wgpu::RenderPipeline,

    // Sprite textures indexed by texture ID
    pub(crate) sprite_textures: HashMap<u32, wgpu::Texture>,
    pub(crate) sprite_texture_views: HashMap<u32, wgpu::TextureView>,
    pub(crate) sprite_bind_groups: HashMap<u32, wgpu::BindGroup>,

    // Shared sampler for textures
    pub(crate) linear_sampler: wgpu::Sampler,

    // Mipmap generator for sprite cache textures
    pub(crate) mipmap_generator: MipmapGenerator,

    // Font texture manager
    pub(crate) font_texture_manager: FontManager,

    // Reusable uniform buffer for matrices
    pub(crate) uniform_buffer: wgpu::Buffer,
    pub(crate) text_uniform_buffer: wgpu::Buffer,

    // Reusable vertex/index buffers
    pub(crate) vertex_buffer: wgpu::Buffer,
    pub(crate) vertex_buffer_size: u64,
    pub(crate) index_buffer: wgpu::Buffer,
    pub(crate) index_buffer_size: u64,

    // Surface format (needed for render bundles)
    pub(crate) surface_format: wgpu::TextureFormat,

    // Cached basic bind group (reused when matrix hasn't changed)
    pub(crate) basic_bind_group: wgpu::BindGroup,
}
