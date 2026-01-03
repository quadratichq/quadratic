//! Quadratic Renderer Core
//!
//! Platform-agnostic rendering and layout engine for Quadratic spreadsheet.
//! This crate contains no WASM-specific code and can be used on any platform.
//!
//! ## Architecture
//!
//! - `types`: Shared data types (RenderBatch, buffers, etc.)
//! - `viewport`: Camera/viewport state and math
//! - `sheets`: Sheet data management (cells, fills, text)
//! - `ui`: UI elements (cursor, grid lines, headings)
//! - `layout`: Text layout and mesh generation
//! - `render`: Render state management
//! - `wgpu_backend`: GPU rendering via wgpu (optional)
//!
//! ## Usage
//!
//! The core library is used by:
//! - `renderer-wasm`: Browser GPU rendering worker
//! - `layout-wasm`: Browser layout worker
//! - `native`: Server-side rendering for thumbnails/exports

#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(dead_code)] // Some scaffolding not yet used

pub mod layout;
pub mod render;
pub mod sheets;
pub mod tables;
pub mod types;
pub mod ui;
pub mod viewport;

#[cfg(feature = "wgpu")]
pub mod wgpu_backend;

pub mod font_loader;

// Re-exports for convenience
pub use layout::LayoutEngine;
pub use render::CoreState;
pub use sheets::{Sheet, Sheets};
pub use types::{
    CursorRenderData, FillBuffer, HashRenderData, HeadingsRenderData, LineBuffer, RenderBatch,
    TableRenderData, TextBuffer,
};
pub use ui::UI;
pub use viewport::Viewport;

#[cfg(feature = "wgpu")]
pub use wgpu_backend::WgpuRenderer;
