#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(clippy::diverging_sub_expression, clippy::match_like_matches_macro)]

#[macro_use]
pub mod util;
#[macro_use]
mod error_run;
mod color;
pub mod controller;
pub mod error_core;
pub mod ext;
pub mod formulas;
pub mod grid;
mod position;
mod rle;
mod span;
pub mod test_util;
mod values;
#[cfg(feature = "js")]
pub mod wasm_bindings;

pub use error_run::*;
pub use ext::*;
pub use grid::sheet::sheet_offsets;
pub use position::*;
pub use rle::RunLengthEncoding;
pub use span::*;
pub use values::*;

pub const QUADRANT_SIZE: u64 = 16;

pub mod limits {
    /// Maximum integer range allowed.
    pub const INTEGER_RANGE_LIMIT: f64 = 100_000.0;

    /// Maximum cell range size allowed. Must be strictly less than `u32::MAX`.
    pub const CELL_RANGE_LIMIT: u32 = 1_000_000;
}

pub const DEFAULT_COLUMN_WIDTH: f64 = 100.0;
pub const DEFAULT_ROW_HEIGHT: f64 = 20.0;

const THUMBNAIL_WIDTH: f64 = 1280f64;
const THUMBNAIL_HEIGHT: f64 = THUMBNAIL_WIDTH / (16f64 / 9f64);
