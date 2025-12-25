//! Quadratic Rust Renderer
//!
//! A WebGL-based renderer for the Quadratic spreadsheet application.
//! Designed to run in a Web Worker for browser rendering.
//!
//! ## Architecture
//!
//! - `content`: Platform-agnostic rendering content (grid lines, cursor, cells)
//! - `viewport`: Camera/viewport state and math
//! - `webgl`: WebGL2 rendering backend (browser only)
//! - `worker`: Web Worker entry point (browser only)
//!
//! ## Usage (Browser)
//!
//! 1. Transfer an OffscreenCanvas to the worker
//! 2. Create a WorkerRenderer with the canvas
//! 3. Call frame() on each animation frame

#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(dead_code)] // POC - many things are scaffolded but not yet used

// Platform-agnostic modules
pub mod cells;
pub mod content;
pub mod headings;
pub mod text;
pub mod utils;
pub mod viewport;

// Browser-only modules (WebGL + Worker)
#[cfg(feature = "wasm")]
pub mod webgl;
#[cfg(feature = "wasm")]
pub mod worker;

// Re-export main types
pub use content::Content;
pub use viewport::Viewport;

#[cfg(feature = "wasm")]
pub use worker::WorkerRenderer;

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
