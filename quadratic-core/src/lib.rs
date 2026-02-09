#![warn(rust_2018_idioms, clippy::semicolon_if_nothing_returned)]
#![allow(clippy::diverging_sub_expression, clippy::match_like_matches_macro)]
#![allow(non_local_definitions)] // TODO: blocked on https://github.com/proptest-rs/proptest/issues/447

#[cfg(feature = "function-timer")]
use std::sync::{LazyLock, Mutex};
#[cfg(feature = "function-timer")]
pub static FUNCTIONS: LazyLock<Mutex<Vec<(String, i64)>>> = LazyLock::new(|| Mutex::new(vec![]));

#[macro_use]
pub mod util;
#[macro_use]
mod error_run;
pub mod a1;
mod clear_option;
pub mod color;
pub mod compression;
pub mod constants;
pub mod controller;
mod copy_formats;
pub mod date_time;
pub mod error_core;
pub mod ext;
pub mod formulas;
pub mod grid;
mod pos;
mod rect;
pub mod renderer_constants;
mod rle;
pub mod selection;
pub mod sheet_offsets;
mod sheet_rect;
pub mod small_timestamp;
mod span;
#[macro_use]
pub mod test_util;
pub mod input;
pub mod values;
pub mod viewport;

#[cfg(feature = "js")]
pub mod wasm_bindings;

pub use a1::TableRef;
pub use clear_option::*;
pub use constants::{DEFAULT_HTML_HEIGHT, DEFAULT_HTML_WIDTH};
pub use copy_formats::CopyFormats;
pub use error_run::*;
pub use ext::*;
pub use grid::RefAdjust;
pub use pos::*;
pub use rect::*;
pub use rle::RunLengthEncoding;
pub use selection::OldSelection;
pub use sheet_rect::*;
pub use span::*;
pub use test_util::*;
pub use values::*;

pub const QUADRANT_SIZE: u64 = 16;

pub mod limits {
    /// Maximum integer range allowed.
    pub const INTEGER_RANGE_LIMIT: f64 = 100_000.0;

    /// Maximum cell range size allowed. Must be strictly less than `u32::MAX`.
    pub const CELL_RANGE_LIMIT: u32 = 1_000_000;
}

pub const DEFAULT_COLUMN_WIDTH: f64 = 100.0;
pub const DEFAULT_ROW_HEIGHT: f64 = 21.0;

const THUMBNAIL_WIDTH: f64 = 1280f64;
const THUMBNAIL_HEIGHT: f64 = THUMBNAIL_WIDTH / (16f64 / 9f64);
