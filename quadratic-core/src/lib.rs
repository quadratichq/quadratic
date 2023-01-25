#![warn(rust_2018_idioms, clippy::if_then_some_else_none)]

use wasm_bindgen::prelude::*;

#[macro_use]
pub mod util;
mod cell;
pub mod formulas;
mod position;

pub use cell::{Cell, CellTypes, JsCell};
pub use position::Pos;

pub const QUADRANT_SIZE: u64 = 16;

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn hello() {
    // say hello, when loaded successfully
    log("[WASM/Rust] quadratic-core ready")
}
