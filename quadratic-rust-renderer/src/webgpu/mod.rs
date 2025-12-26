//! WebGPU rendering backend
//!
//! This module provides WebGPU rendering for the browser worker.
//! WebGPU is the preferred backend when available, with WebGL2 as fallback.

mod context;
mod font_manager;
mod mipmap;
mod render_target;
pub(crate) mod shaders;
mod texture_manager;

pub use context::WebGPUContext;
pub use font_manager::FontManager;
pub use mipmap::MipmapGenerator;
pub use render_target::RenderTarget;
pub use texture_manager::TextureManager;

// Re-export shared primitives
pub use crate::primitives::{
    Color, FontTextureId, FontTextureInfo, Line, Lines, NativeLine, NativeLines, Rect, Rects,
    Sprite, Sprites, TextureId, TextureInfo, UVRect,
};
