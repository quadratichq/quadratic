//! Rendering for sheets
//!
//! Uses RenderContext for platform-agnostic rendering.

mod text_renderer;

pub use text_renderer::{render_text_hash, render_horizontal_lines};
