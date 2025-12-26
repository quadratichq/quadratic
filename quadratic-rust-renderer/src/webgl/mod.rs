//! WebGL2 rendering backend
//!
//! This module provides WebGL2 rendering for the browser worker.

mod context;
mod framebuffer;
pub mod primitives;
mod programs;
mod shaders;
mod text;

pub use context::WebGLContext;
pub use framebuffer::{ortho_matrix, RenderTarget};
pub use primitives::{
    Color, Line, Lines, Rect, Rects, Sprite, Sprites, TextureId, TextureInfo, TextureManager,
    UVRect,
};
