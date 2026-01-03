//! wgpu rendering backend
//!
//! This module provides GPU rendering using wgpu, which works on:
//! - Browser (WebGPU)
//! - Native (Vulkan, Metal, DX12)
//!
//! The same rendering code is used for both platforms - only the
//! surface/target creation differs.

#[cfg(feature = "wgpu")]
mod pipelines;
#[cfg(feature = "wgpu")]
mod renderer;
#[cfg(feature = "wgpu")]
mod shaders;
#[cfg(feature = "wgpu")]
mod texture_manager;

#[cfg(feature = "wgpu")]
pub use renderer::WgpuRenderer;
#[cfg(feature = "wgpu")]
pub use texture_manager::TextureManager;
