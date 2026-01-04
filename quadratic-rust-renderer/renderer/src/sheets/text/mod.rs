//! Text rendering module
//!
//! Implements MSDF-based text rendering similar to the TypeScript CellLabel.

mod a1_notation;
mod bitmap_font;
pub mod cell_label;
pub mod cells_text_hash;
pub mod emoji_sprites;
mod label_mesh;
mod text_label;

pub use a1_notation::{column_to_a1, row_to_a1};
pub use bitmap_font::{BitmapFont, BitmapFonts};
pub use cell_label::{CellLabel, HorizontalLine};
pub use cells_text_hash::{
    CellsTextHash, HASH_HEIGHT, HASH_WIDTH, SPRITE_SCALE_THRESHOLD, VisibleHashBounds, hash_key,
};
pub use emoji_sprites::EmojiSprites;
pub use label_mesh::LabelMesh;
pub use text_label::{TextAnchor, TextLabel};
