//! WebGPU rendering backend
//!
//! This module provides WebGPU rendering for the browser worker.
//! WebGPU is the preferred backend when available, with WebGL2 as fallback.

mod context;
mod font_manager;
mod mipmap;
pub mod render_target;
pub(crate) mod shaders;
mod texture_manager;

pub use context::WebGPUContext;
pub use render_target::RenderTarget;
