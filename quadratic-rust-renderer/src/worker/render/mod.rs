//! Render helper functions
//!
//! These functions handle the actual rendering logic, separated from the
//! WorkerRenderer wasm_bindgen API surface.

mod background;
mod cursor;
mod fills;
mod headings;
mod tables;
mod text;

// Re-export render functions used by renderer.rs
#[cfg(target_arch = "wasm32")]
pub use background::get_background_vertices;
#[cfg(target_arch = "wasm32")]
pub use fills::get_fill_vertices;
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
pub use headings::render_headings_webgpu;
#[cfg(target_arch = "wasm32")]
pub use tables::render_table_headers;
#[cfg(target_arch = "wasm32")]
pub use tables::get_table_vertices_for_webgpu;
#[cfg(target_arch = "wasm32")]
pub use text::render_text;
