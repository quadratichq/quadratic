//! Layout engine
//!
//! Handles text layout and render batch generation.

mod clip_bounds;
mod engine;

pub use clip_bounds::{calculate_clip_bounds, calculate_clip_updates, ClipBoundsUpdate, LabelOverflowInfo};
pub use engine::LayoutEngine;
