//! Quadratic Rust Renderer
//!
//! A GPU-accelerated renderer for the Quadratic spreadsheet application.
//! Designed to run in a Web Worker for browser rendering.
//!
//! ## Architecture
//!
//! Uses `quadratic-renderer-core` for platform-agnostic rendering via wgpu.
//! The wgpu backend supports both WebGPU (preferred) and WebGL2 (fallback).
//!
//! - `sheets`: Sheet data (cells, fills, text hashes)
//! - `ui`: UI elements (grid lines, cursor, headings)
//! - `viewport`: Camera/viewport state and math
//! - `worker`: Web Worker entry point (browser only)
//!
//! ## Usage (Browser)
//!
//! 1. Transfer an OffscreenCanvas to the worker
//! 2. Create the renderer (async, auto-selects best backend)
//! 3. Call frame() on each animation frame
//!
//! ```javascript
//! const renderer = await WorkerRenderer.create(canvas);
//! ```

#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]

// Platform-agnostic modules
mod sheets;
mod tables;
mod ui;
mod viewport;

// Worker module (browser-only entry point)
pub mod worker;

// Re-export main types
pub use viewport::Viewport;

pub use worker::WorkerRenderer;

use quadratic_renderer_core::console_logger;

/// Initialize the renderer (WASM entry point)
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn init_wasm() {
    console_error_panic_hook::set_once();

    let _ = log::set_logger(&console_logger::RENDER_LOGGER);
    log::set_max_level(log::LevelFilter::Debug);

    log::info!("Quadratic Rust Renderer (WASM Worker) initialized");
}
