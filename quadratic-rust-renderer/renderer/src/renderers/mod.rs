pub(crate) mod primitives;
pub mod render_context;
pub mod webgl;
pub mod webgpu;

// Re-export render context types at the renderers level

// Re-export backend contexts
pub use webgl::WebGLContext;
pub use webgpu::WebGPUContext;

// Re-export primitives
pub use primitives::{
    Color, FontTextureId, LineScaling, Lines, NativeLines, Rects, TextureId,
};
