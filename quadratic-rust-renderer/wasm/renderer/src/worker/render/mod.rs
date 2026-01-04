//! Render helper functions
//!
//! These functions handle preparing vertices and render data.
//! Actual rendering is now done via core's RenderContext API.

mod background;
mod fills;
mod tables;

// Re-export vertex preparation functions used by renderer.rs
#[cfg(target_arch = "wasm32")]
pub use background::get_background_vertices;
#[cfg(target_arch = "wasm32")]
pub use fills::get_fill_vertices;
#[cfg(target_arch = "wasm32")]
pub use tables::get_table_vertices_for_webgpu;
