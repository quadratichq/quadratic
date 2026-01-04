//! Text layout module
//!
//! Handles text layout, MSDF glyph positioning, and vertex buffer generation.

mod bitmap_font;
mod cell_label;
mod cells_text_hash;
mod label_mesh;

pub use bitmap_font::{BitmapFont, BitmapFonts};
pub use cell_label::{CellLabel, HorizontalLine};
pub use cells_text_hash::CellsTextHash;
// LabelMesh is exported for potential external use
#[allow(unused_imports)]
pub use label_mesh::{LabelMesh, LabelMeshes};

/// A1 notation utilities
pub fn column_to_a1(mut col: i64) -> String {
    let mut result = String::new();
    while col > 0 {
        let remainder = ((col - 1) % 26) as u8;
        result.insert(0, (b'A' + remainder) as char);
        col = (col - 1) / 26;
    }
    result
}

pub fn row_to_a1(row: i64) -> String {
    row.to_string()
}
