//! Shared types for quadratic-rust-layout and quadratic-rust-renderer
//!
//! This crate defines the data structures passed between the Layout Worker
//! and Render Worker. All buffer types are designed for zero-copy transfer
//! via `postMessage` with Transferable objects.

mod buffer_types;
mod constants;
mod hash_coords;
mod render_batch;

// Console logger (requires wasm feature)
#[cfg(feature = "wasm")]
pub mod console_logger;

pub use buffer_types::*;
pub use constants::*;
pub use hash_coords::*;
pub use render_batch::*;
