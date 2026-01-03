//! Shared types for quadratic-renderer-core
//!
//! This module defines the data structures used for rendering:
//! - Buffer types for GPU upload (TextBuffer, FillBuffer, LineBuffer)
//! - RenderBatch for Layout → Renderer communication
//! - Border types for cell borders
//! - Constants and utility functions

mod borders;
mod buffer_types;
mod constants;
mod hash_coords;
mod render_batch;

pub use borders::*;
pub use buffer_types::*;
pub use constants::*;
pub use hash_coords::*;
pub use render_batch::*;
