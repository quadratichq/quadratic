#![warn(rust_2018_idioms, clippy::if_then_some_else_none)]

use wasm_bindgen::prelude::*;

pub mod grid;

#[cfg(test)]
mod tests;

pub use grid::*;

#[wasm_bindgen]
pub fn hello(s: &str) -> String {
    format!("[WASM/Rust] Hello {s}!")
}
