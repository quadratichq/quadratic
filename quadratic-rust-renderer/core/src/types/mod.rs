//! Shared types for quadratic-renderer-core
//!
//! This module defines the data structures used for rendering:
//! - Buffer types for GPU upload (TextBuffer, FillBuffer, LineBuffer)
//! - RenderBatch for Layout → Renderer communication
//! - Constants and utility functions

mod buffer_types;
mod constants;
mod hash_coords;
mod render_batch;

pub use buffer_types::*;
pub use constants::*;
pub use hash_coords::*;
pub use render_batch::*;
