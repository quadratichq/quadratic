//! Shared rendering primitives
//!
//! Backend-agnostic data types for rendering. These types hold geometry and
//! color data, and provide render() methods that work with any RenderContext.

mod color;
mod font;
mod line;
mod native_lines;
mod rect;
mod sprite;
mod texture;

pub use color::Color;
pub use font::{FontTextureId, FontTextureInfo};
pub use line::{LineScaling, Lines};
pub use native_lines::NativeLines;
pub use rect::Rects;
pub use sprite::UVRect;
pub use texture::{TextureId, TextureInfo};
