//! Shared rendering primitives
//!
//! Backend-agnostic data types for rendering. These types hold geometry and
//! color data, and provide render() methods that work with any RenderContext.

mod color;
mod rects;
mod lines;
mod texture;

pub use color::{
    colors, from_hex, from_name, from_rgb_str, from_rgba, from_rgba_str, parse as parse_color,
    parse_opt as parse_color_opt, Color, DEFAULT_COLOR,
};
pub use rects::{Rect, Rects};
pub use lines::{Lines, LineScaling, NativeLines};
pub use texture::{TextureId, TextureInfo, TextureRegistry};
