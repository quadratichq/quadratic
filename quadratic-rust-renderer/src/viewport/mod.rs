//! Viewport module - camera/view management
//!
//! The viewport state is controlled by the main thread via SharedArrayBuffer.
//! The Rust renderer only reads this state - all manipulation (pan, zoom,
//! deceleration) is handled in TypeScript.

mod viewport;

#[cfg(feature = "wasm")]
mod viewport_buffer;

pub use viewport::{Viewport, VisibleBounds};

#[cfg(feature = "wasm")]
pub use viewport_buffer::{ViewportBuffer, ViewportBufferIndex, ViewportSource, VIEWPORT_BUFFER_SIZE};
