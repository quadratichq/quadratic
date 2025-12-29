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
pub use quadratic_core_shared::a1;
mod clear_option;
pub use quadratic_core_shared::color;
pub mod compression;
pub mod constants;
pub mod controller;
pub mod date_time;
pub mod error_core;
pub mod ext;
pub mod formulas;
pub mod grid;
mod rle;
pub mod selection;
pub use quadratic_core_shared::sheet_offsets;
pub mod small_timestamp;
mod span;
#[macro_use]
pub mod test_util;
pub mod input;
pub mod values;

#[cfg(feature = "js")]
pub mod wasm_bindings;

pub use a1::TableRef;
pub use clear_option::*;
pub use error_run::*;
pub use ext::*;
pub use quadratic_core_shared::CopyFormats;
pub use quadratic_core_shared::RefAdjust;
pub use quadratic_core_shared::{Pos, Rect, ScreenRect, SheetPos, SheetRect};
pub use rle::RunLengthEncoding;
pub use selection::OldSelection;
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
