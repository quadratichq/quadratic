//! Cell text management
//!
//! Handles text layout, fonts, and text hashing.

mod bitmap_font;
mod cells_text;
mod font_manager;

pub use bitmap_font::{BitmapChar, BitmapFont, BitmapFonts, CharFrame};
pub use cells_text::CellsText;
pub use font_manager::FontManager;

/// Scale threshold below which we switch from MSDF text to sprite rendering
pub const SPRITE_SCALE_THRESHOLD: f32 = 0.5;
