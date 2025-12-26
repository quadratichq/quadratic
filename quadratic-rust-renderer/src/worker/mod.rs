//! Worker renderer module
//!
//! This module provides the browser worker entry point for rendering.
//! Supports both WebGPU (preferred) and WebGL2 (fallback) backends.
//!
//! # Usage
//!
//! From JavaScript, check WebGPU availability and create the appropriate renderer:
//!
//! ```javascript
//! if (WorkerRendererGPU.is_available()) {
//!     const renderer = await WorkerRendererGPU.new(canvas);
//! } else {
//!     const renderer = new WorkerRenderer(canvas);
//! }
//! ```

mod backend;
mod renderer;
mod renderer_webgpu;

pub use backend::{BackendType, RenderBackend};
pub use renderer::WorkerRenderer;
pub use renderer_webgpu::WorkerRendererGPU;
