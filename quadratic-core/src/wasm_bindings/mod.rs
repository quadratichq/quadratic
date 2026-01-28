use wasm_bindgen::prelude::*;

pub mod a1;
pub mod controller;
pub mod error;
pub mod input;
pub mod js;
pub mod js_a1_context;
pub mod js_selection;
pub mod merge_cells;
pub mod scheduled_task;
pub mod sheet_content_cache;
pub mod sheet_data_tables_cache;

use crate::controller::GridController;
use crate::grid::js_types::JsResponse;
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

pub fn capture_core_error(func: impl FnOnce() -> Result<Option<JsValue>, String>) -> JsValue {
    match func() {
        Ok(response) => match response {
            Some(response) => response,
            None => JsResponse {
                result: true,
                error: None,
            }
            .into(),
        },
        Err(e) => JsResponse {
            result: false,
            error: Some(e),
        }
        .into(),
    }
}
