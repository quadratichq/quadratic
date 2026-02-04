//! Shared types for quadratic-renderer-core
//!
//! This module defines the data structures used for rendering:
//! - Buffer types for GPU upload (TextBuffer, FillBuffer, LineBuffer)
//! - RenderBatch for Layout → Renderer communication
//! - Border types for cell borders
//! - Render types (RenderCell, RenderFill) with Rgba colors
//! - Constants and utility functions

mod borders;
mod buffer_types;
mod render_batch;
mod render_types;

pub use borders::*;
pub use buffer_types::*;
pub use render_batch::*;
pub use render_types::*;
