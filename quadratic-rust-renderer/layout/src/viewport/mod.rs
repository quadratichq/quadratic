//! Viewport module - camera/view management
//!
//! This module reads viewport state from a SharedArrayBuffer controlled by the main thread.

mod viewport;

// These types are part of the public API
#[allow(unused_imports)]
pub use viewport::{Viewport, VisibleBounds, VisibleHashBounds};
