//! Cell text management
//!
//! Handles text layout, fonts, caching, and text decorations.

mod bitmap_font;
mod cells_text;
mod emoji;
mod font_manager;
mod horizontal_line;
mod text_cache;

pub use bitmap_font::{BitmapChar, BitmapFont, BitmapFonts, CharFrame};
pub use cells_text::CellsText;
pub use emoji::{new_emoji_cache, EmojiSpriteCache, EmojiSpriteData};
pub use font_manager::FontManager;
pub use horizontal_line::{lines_to_vertices, HorizontalLine};
pub use text_cache::{new_text_cache, TextCache, TextCacheEntry, TextCacheKey};
