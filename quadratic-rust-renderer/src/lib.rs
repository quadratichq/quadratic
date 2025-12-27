//! Quadratic Rust Renderer
//!
//! A GPU-accelerated renderer for the Quadratic spreadsheet application.
//! Designed to run in a Web Worker for browser rendering.
//!
//! ## Architecture
//!
//! - `content`: Platform-agnostic rendering content (grid lines, cursor, cells)
//! - `viewport`: Camera/viewport state and math
//! - `webgl`: WebGL2 rendering backend (browser only)
//! - `webgpu`: WebGPU rendering backend (browser only, preferred when available)
//! - `worker`: Web Worker entry point (browser only)
//!
//! ## Usage (Browser)
//!
//! 1. Transfer an OffscreenCanvas to the worker
//! 2. Check WebGPU availability with `WorkerRendererGPU.is_available()`
//! 3. Create `WorkerRendererGPU` (async) if available, otherwise `WorkerRenderer` (sync)
//! 4. Call frame() on each animation frame
//!
//! ```javascript
//! if (WorkerRendererGPU.is_available()) {
//!     const renderer = await WorkerRendererGPU.new(canvas);
//! } else {
//!     const renderer = new WorkerRenderer(canvas);
//! }
//! ```

#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(dead_code)] // POC - many things are scaffolded but not yet used

// Platform-agnostic modules
pub mod cells;
pub mod content;
pub mod fills;
pub mod headings;
pub mod primitives;
pub mod render_context;
pub mod text;
pub mod utils;
pub mod viewport;

// Re-export the render context types
pub use render_context::{CommandBuffer, DrawCommand, RenderContext, RenderError};

// Browser-only modules (WebGL + WebGPU + Worker)
#[cfg(feature = "wasm")]
pub mod webgl;
#[cfg(feature = "wasm")]
pub mod webgpu;
#[cfg(feature = "wasm")]
pub mod worker;

// Re-export main types
pub use content::Content;
pub use viewport::Viewport;

#[cfg(feature = "wasm")]
pub use worker::{WorkerRenderer, WorkerRendererGPU};

/// Initialize the renderer (WASM entry point)
#[cfg(feature = "wasm")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn init_wasm() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    log::set_logger(&utils::console_logger::CONSOLE_LOGGER).unwrap();
    log::set_max_level(log::LevelFilter::Debug);

    log::info!("Quadratic Rust Renderer (WASM Worker) initialized");
}

/// Initialize the renderer (native entry point)
#[cfg(feature = "native")]
pub fn init_native() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("Quadratic Rust Renderer (native) initialized");
}
