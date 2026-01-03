//! Quadratic Rust Layout Worker
//!
//! Handles text layout, hash management, and vertex buffer generation for rendering.
//! Runs in a Web Worker and sends pre-computed render batches to the Render Worker.
//!
//! ## Architecture
//!
//! - `sheets`: Sheet data management (cells, fills, text hashes)
//! - `tables`: Table/code cell layout
//! - `ui`: UI element layout (grid lines, cursor, headings)
//! - `worker`: Web Worker entry point
//!
//! ## Data Flow
//!
//! 1. Receives cell data from Core Worker (via bincode)
//! 2. Performs text layout and generates vertex buffers
//! 3. Sends RenderBatch to Render Worker (zero-copy transfer)

#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(dead_code)] // Some scaffolding not yet used

// Core modules
mod sheets;
mod tables;
mod ui;
mod utils;
mod viewport;

// Worker module (WASM entry point)
#[cfg(feature = "wasm")]
pub mod worker;

// Re-exports
pub use quadratic_renderer_core::{HashRenderData, RenderBatch};
pub use viewport::Viewport;

#[cfg(feature = "wasm")]
pub use worker::LayoutWorker;

/// Initialize the layout worker (WASM entry point)
#[cfg(feature = "wasm")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn init_wasm() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    let _ = log::set_logger(&utils::console_logger::LAYOUT_LOGGER);
    log::set_max_level(log::LevelFilter::Debug);

    log::info!("Quadratic Rust Layout Worker initialized");
}
