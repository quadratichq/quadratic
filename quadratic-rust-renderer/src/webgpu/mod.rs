//! WebGPU rendering backend
//!
//! This module provides WebGPU rendering for the browser worker.
//! WebGPU is the preferred backend when available, with WebGL2 as fallback.

mod context;
pub mod primitives;
mod render_context_impl;
mod shaders;

pub use context::WebGPUContext;

// Re-export shared primitives
pub use crate::primitives::{
    Color, Line, Lines, NativeLine, NativeLines, Rect, Rects, Sprite, Sprites, UVRect,
};

// Re-export backend-specific texture management
pub use primitives::{TextureId, TextureInfo, TextureManager};
