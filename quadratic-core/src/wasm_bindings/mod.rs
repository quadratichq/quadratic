use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

pub mod controller;
pub mod js;

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
