//! Text rendering module
//!
//! Implements MSDF-based text rendering similar to the TypeScript CellLabel.

mod a1_notation;
mod bitmap_font;
pub mod cell_label;
mod cells_text_hash;
#[cfg(feature = "wasm")]
pub mod font_loader;
mod label_mesh;
mod text_label;

pub use a1_notation::{column_to_a1, row_to_a1, to_a1};
pub use bitmap_font::{
    extract_char_code, split_text_to_characters, BitmapChar, BitmapFont, BitmapFonts, CharFrame,
};
pub use cell_label::CellLabel;
pub use cells_text_hash::{
    get_hash_coords, hash_key, CellsTextHash, VisibleHashBounds, DEFAULT_CELL_HEIGHT,
    DEFAULT_CELL_WIDTH, HASH_HEIGHT, HASH_PADDING, HASH_WIDTH, SPRITE_SCALE_THRESHOLD,
};
pub use label_mesh::{LabelMesh, TextVertex};
pub use text_label::{TextAnchor, TextLabel, HEADING_FONT_SIZE};
