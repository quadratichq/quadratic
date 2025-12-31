//! Quadratic Rust Renderer
//!
//! A GPU-accelerated renderer for the Quadratic spreadsheet application.
//! Designed to run in a Web Worker for browser rendering.
//!
//! ## Architecture
//!
//! - `renderers`: Graphics backends (WebGL2 and WebGPU)
//! - `sheets`: Sheet data (cells, fills, text hashes)
//! - `ui`: UI elements (grid lines, cursor, headings)
//! - `viewport`: Camera/viewport state and math
//! - `worker`: Web Worker entry point (browser only)
//!
//! ## Usage (Browser)
//!
//! 1. Transfer an OffscreenCanvas to the worker
//! 2. Check WebGPU availability and create appropriate renderer
//! 3. Call frame() on each animation frame
//!
//! ```javascript
//! // Recommended: Use unified WorkerRenderer
//! if (WorkerRenderer.is_webgpu_available()) {
//!     const renderer = await WorkerRenderer.new_webgpu(canvas);
//! } else {
//!     const renderer = new WorkerRenderer(canvas);
//! }
//!
//! // Legacy: WorkerRendererGPU still works for backwards compatibility
//! if (WorkerRendererGPU.is_available()) {
//!     const renderer = await WorkerRendererGPU.new(canvas);
//! } else {
//!     const renderer = new WorkerRenderer(canvas);
//! }
//! ```

#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(dead_code)] // POC - many things are scaffolded but not yet used

// Platform-agnostic modules
mod renderers;
mod sheets;
mod ui;
mod utils;
mod viewport;

// Worker module (browser-only entry point)
#[cfg(feature = "wasm")]
pub mod worker;

// Re-export main types
pub use viewport::Viewport;

#[cfg(feature = "wasm")]
pub use worker::WorkerRenderer;

/// Initialize the renderer (WASM entry point)
#[cfg(feature = "wasm")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn init_wasm() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    let _ = log::set_logger(&utils::console_logger::CONSOLE_LOGGER);
    log::set_max_level(log::LevelFilter::Debug);

    log::info!("Quadratic Rust Renderer (WASM Worker) initialized");
}

/// Initialize the renderer (native entry point)
#[cfg(feature = "native")]
pub fn init_native() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("Quadratic Rust Renderer (native) initialized");
}
