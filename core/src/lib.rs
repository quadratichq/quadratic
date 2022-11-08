#![warn(rust_2018_idioms, clippy::if_then_some_else_none)]

pub mod sheet;

#[cfg(test)]
mod tests;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn hello(s: &str) -> String {
    format!("Hello {s}!")
}
