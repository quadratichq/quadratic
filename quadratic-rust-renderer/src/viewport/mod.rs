//! Viewport module - camera/view management
//!
//! This is a UNIFIED viewport buffer shared by:
//! - Client (TypeScript) - the ONLY writer
//! - Renderer (quadratic-rust-renderer) - reads for GPU rendering
//! - Core (quadratic-core) - reads to compute visible hash bounds
//!
//! The viewport state is controlled by the main thread via SharedArrayBuffer.
//! The Rust components only read this state - all manipulation (pan, zoom,
//! deceleration) is handled in TypeScript.

mod viewport;
mod viewport_buffer;

// Re-export core types from core-shared
pub use quadratic_core_shared::{
    SHEET_ID_SIZE, SliceFlag, SliceOffset, VIEWPORT_BUFFER_SIZE, VIEWPORT_SLICE_SIZE, VisibleBounds,
};

#[cfg(feature = "js")]
pub use quadratic_core_shared::ViewportBuffer;

// Renderer-specific types
pub use viewport::Viewport;
pub use viewport_buffer::ViewportSource;
