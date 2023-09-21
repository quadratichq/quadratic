#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(clippy::diverging_sub_expression, clippy::match_like_matches_macro)]

#[macro_use]
pub mod util;
#[macro_use]
mod error;
pub mod controller;
pub mod ext;
pub mod formulas;
pub mod grid;
mod position;
mod rle;
mod span;
mod values;
#[cfg(feature = "js")]
pub mod wasm_bindings;

pub use error::*;
pub use ext::*;
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

pub const DEFAULT_COLUMN_WIDTH: f32 = 100.0;
pub const DEFAULT_ROW_HEIGHT: f32 = 20.0;
