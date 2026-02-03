//! Cell text management
//!
//! Handles text layout, fonts, caching, and text decorations.

mod bitmap_font;
mod cell_label;
mod cells_text;
mod emoji;
mod font_manager;
mod horizontal_line;
mod label_mesh;
mod text_cache;
mod text_hash;
mod text_label;

pub use crate::constants::{HASH_HEIGHT, HASH_WIDTH};
pub use bitmap_font::{
    extract_char_code, split_text_to_characters, BitmapChar, BitmapFont, BitmapFonts, CharFrame,
};
pub use cell_label::{
    is_potential_emoji, CellLabel, EmojiCharData, EmojiLookup, NoEmoji, CELL_TEXT_MARGIN_LEFT,
    CELL_VERTICAL_PADDING, DEFAULT_CELL_HEIGHT, DEFAULT_FONT_SIZE, LINE_HEIGHT, OPEN_SANS_FIX_X,
    OPEN_SANS_FIX_Y,
};
pub use cells_text::CellsText;
pub use emoji::{new_emoji_cache, EmojiSpriteCache, EmojiSpriteData};
pub use font_manager::FontManager;
pub use horizontal_line::{lines_to_vertices, HorizontalLine};
pub use label_mesh::{LabelMesh, TextVertex};
pub use text_cache::{new_text_cache, TextCache, TextCacheEntry, TextCacheKey};
pub use text_hash::{hash_coords, TextHash};
pub use text_label::{TextAnchor, TextLabel, HEADING_FONT_SIZE};
