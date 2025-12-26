//! WebGL2 rendering backend
//!
//! This module provides WebGL2 rendering for the browser worker.

mod context;
mod font_manager;
mod framebuffer;
mod programs;
mod shaders;
mod text;
mod texture_manager;

pub use context::WebGLContext;
pub use font_manager::FontManager;
pub use framebuffer::{ortho_matrix, RenderTarget};
pub use texture_manager::TextureManager;

// Re-export shared primitives
pub use crate::primitives::{
    Color, FontTextureId, FontTextureInfo, Line, Lines, NativeLine, NativeLines, Rect, Rects,
    Sprite, Sprites, TextureId, TextureInfo, UVRect,
};
