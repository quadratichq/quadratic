//! Text rendering module
//!
//! Implements MSDF-based text rendering similar to the TypeScript CellLabel.

mod a1_notation;
mod bitmap_font;
pub mod cell_label;
mod cells_text_hash;
mod label_mesh;
mod text_label;

pub use a1_notation::{column_to_a1, row_to_a1};
pub use bitmap_font::{
    BitmapFont, BitmapFonts,
};
pub use cell_label::{CellLabel, HorizontalLine};
pub use cells_text_hash::{
    hash_key, CellsTextHash, VisibleHashBounds, SPRITE_SCALE_THRESHOLD,
};
pub use label_mesh::LabelMesh;
pub use text_label::{TextAnchor, TextLabel};
