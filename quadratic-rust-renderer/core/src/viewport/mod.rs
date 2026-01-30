//! Viewport module - camera/view management
//!
//! The viewport represents the visible region of the infinite grid.
//! This is a platform-agnostic module - the ViewportBuffer (SharedArrayBuffer)
//! wrapper is handled by the WASM crates.

mod bounds;
#[allow(clippy::module_inception)]
mod viewport;

pub use bounds::{VisibleBounds, VisibleHashBounds};
pub use viewport::Viewport;
