//! Render helper functions
//!
//! These functions handle the actual rendering logic, separated from the
//! WorkerRenderer wasm_bindgen API surface.

mod background;
mod batch;
mod cursor;
mod fills;
mod headings;
mod tables;
mod text;

// Re-export render functions used by renderer.rs
#[cfg(target_arch = "wasm32")]
pub use background::get_background_vertices;
#[cfg(target_arch = "wasm32")]
pub use batch::render_text_from_cache;
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
pub use batch::render_text_from_cache_webgpu;
#[cfg(target_arch = "wasm32")]
pub use fills::get_fill_vertices;
#[cfg(all(target_arch = "wasm32", feature = "wasm"))]
pub use headings::render_headings_webgpu;
#[cfg(target_arch = "wasm32")]
pub use tables::get_table_vertices_for_webgpu;
#[cfg(target_arch = "wasm32")]
pub use tables::render_table_headers;
// Note: render_text is no longer used - Layout Worker provides all geometry
// Kept for potential future fallback path
#[cfg(target_arch = "wasm32")]
#[allow(dead_code, unused_imports)]
pub use text::render_text;
