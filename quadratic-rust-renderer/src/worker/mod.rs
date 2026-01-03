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
//! if (WorkerRenderer.is_webgpu_available()) {
//!     const renderer = await WorkerRenderer.new_webgpu(canvas);
//! } else {
//!     const renderer = new WorkerRenderer(canvas);
//! }
//! ```

mod backend;
pub mod batch_receiver;
pub mod js;
pub mod message_handler;
mod render;
mod renderer;
mod state;

pub use backend::{BackendType, RenderBackend};
pub use batch_receiver::BatchCache;
pub use renderer::WorkerRenderer;
pub use state::RendererState;
