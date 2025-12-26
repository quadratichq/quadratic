//! Rendering primitives
//!
//! Self-rendering geometric primitives for WebGL.

mod color;
mod line;
mod rect;
mod sprite;
mod thick_line;
mod thick_rect;
pub mod texture;

pub use color::Color;
pub use line::{Line, Lines};
pub use rect::{Rect, Rects};
pub use sprite::{Sprite, Sprites, UVRect};
pub use texture::{TextureId, TextureInfo, TextureManager};
pub use thick_line::{ThickLine, ThickLines};
pub use thick_rect::{ThickRect, ThickRects};
