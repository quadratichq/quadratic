#![warn(rust_2018_idioms, clippy::if_then_some_else_none)]

use wasm_bindgen::prelude::*;

pub mod grid;

#[cfg(test)]
mod tests;

pub use grid::*;

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
