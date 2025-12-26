//! Shared rendering primitives
//!
//! Backend-agnostic data types for rendering. These types hold geometry and
//! color data, and provide render() methods that work with any RenderContext.
//!
//! ## Line Types
//!
//! - `NativeLines` - 1px lines using GPU's native line primitive (fast, always 1px)
//! - `Lines` - Thick lines rendered as triangles (configurable thickness, scalable)
//!
//! ## Usage
//!
//! ```ignore
//! use quadratic_rust_renderer::primitives::{Rects, Lines, NativeLines, LineScaling};
//!
//! // Native 1px lines (for grid lines, etc.)
//! let mut grid = NativeLines::new();
//! grid.add(0.0, 0.0, 100.0, 0.0, [0.8, 0.8, 0.8, 1.0]);
//!
//! // Thick lines that stay constant on screen (2px border)
//! let mut border = Lines::with_thickness(2.0, LineScaling::Pixel);
//! border.add(0.0, 0.0, 100.0, 100.0, [0.0, 0.0, 1.0, 1.0]);
//!
//! // Thick lines that scale with zoom (world-space thickness)
//! let mut drawing = Lines::with_thickness(5.0, LineScaling::World);
//! drawing.add(0.0, 0.0, 50.0, 50.0, [1.0, 0.0, 0.0, 1.0]);
//!
//! // In frame loop:
//! ctx.begin_frame();
//! ctx.clear(0.9, 0.9, 0.9, 1.0);
//! grid.render(&mut ctx, &matrix);
//! border.render(&mut ctx, &matrix, viewport_scale);
//! drawing.render(&mut ctx, &matrix, viewport_scale);
//! ctx.end_frame();
//! ```

mod color;
mod line;
mod native_lines;
mod rect;
mod sprite;
mod texture;

pub use color::{colors, Color};
pub use line::{Line, LineScaling, Lines};
pub use native_lines::{NativeLine, NativeLines};
pub use rect::{Rect, Rects};
pub use sprite::{Sprite, Sprites, UVRect};
pub use texture::{TextureId, TextureInfo, TextureManager};
