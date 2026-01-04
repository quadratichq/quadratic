//! Text layout module
//!
//! Handles text layout, MSDF glyph positioning, and vertex buffer generation.
//!
//! CellLabel, BitmapFonts, TextHash, and related types are provided by quadratic-renderer-core.

// Re-export types from core
pub use quadratic_renderer_core::{BitmapFonts, CellLabel};
pub use quadratic_renderer_core::sheets::text::{BitmapFont, TextHash};
