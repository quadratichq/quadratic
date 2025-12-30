//! Viewport module - unified viewport buffer for Client, Renderer, and Core
//!
//! This is a UNIFIED viewport buffer shared by:
//! - Client (TypeScript) - the ONLY writer
//! - Renderer (quadratic-rust-renderer) - reads for GPU rendering
//! - Core (quadratic-core) - reads to compute visible hash bounds
//!
//! The viewport state is controlled by the main thread via SharedArrayBuffer.
//! The Rust components only read this state - all manipulation (pan, zoom,
//! deceleration) is handled in TypeScript.
//!
//! Buffer Layout (two slices for ping-pong pattern):
//!
//! ViewportSlice (72 bytes each):
//!   [0]  flag       - i32: 0 = uninitialized, 1 = ready to read, 2 = locked for reading
//!   [4]  positionX  - f32: Viewport X position in world coordinates
//!   [8]  positionY  - f32: Viewport Y position in world coordinates
//!   [12] scale      - f32: Zoom level (1.0 = 100%)
//!   [16] dpr        - f32: Device pixel ratio
//!   [20] width      - f32: Viewport width in device pixels
//!   [24] height     - f32: Viewport height in device pixels
//!   [28] dirty      - f32: Dirty flag (1.0 = dirty, 0.0 = clean)
//!   [32] reserved   - f32: Reserved for future use
//!   [36] sheet_id   - [u8; 36]: UUID string bytes
//!
//! ViewportData (144 bytes total):
//!   [0-71]   slice_a
//!   [72-143] slice_b

mod viewport_buffer;

pub use viewport_buffer::*;
