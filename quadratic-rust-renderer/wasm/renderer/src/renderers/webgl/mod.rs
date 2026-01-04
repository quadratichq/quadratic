//! WebGL2 rendering backend
//!
//! This module provides WebGL2 rendering for the browser worker.

mod context;
mod font_manager;
pub mod framebuffer;
mod programs;
pub(crate) mod shaders;
mod text;
mod texture_manager;

pub use context::WebGLContext;
pub use framebuffer::RenderTarget;
