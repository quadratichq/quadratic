//! quadratic-rust-client - WASM bindings for Quadratic client
//!
//! Provides TypeScript-accessible wrappers for core shared types.

use wasm_bindgen::prelude::*;

mod viewport;

/// Initialize the WASM module (sets up panic hook for better error messages)
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}
