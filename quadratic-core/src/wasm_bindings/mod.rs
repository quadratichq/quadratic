use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

pub mod controller;
pub mod js;
pub mod pos;
pub mod rect;

use crate::controller::GridController;
use crate::grid::*;
use crate::*;

#[wasm_bindgen(typescript_custom_section)]
const TYPESCRIPT_IMPORT: &str = r#"
import * as types from './types';
"#;

#[wasm_bindgen]
pub fn hello() {
    // say hello, when loaded successfully
    js::log("[WASM/Rust] quadratic-core ready");
}

/// Returns a column's name from its number.
#[wasm_bindgen]
pub fn column_name(n: f64) -> String {
    util::column_name(n.floor() as i64)
}
/// Returns a column number from a name, or `null` if it is invalid or out of range.
#[wasm_bindgen]
pub fn column_from_name(s: &str) -> Option<f64> {
    Some(util::column_from_name(s)? as f64)
}
