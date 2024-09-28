use std::str::FromStr;

use quadratic_core::{selection::Selection, A1};
use wasm_bindgen::prelude::*;

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "posToA1")]
pub fn pos_to_a1(x: u32, y: u32) -> String {
    A1::pos_to_a1(x as u64, y as u64)
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "selectionToA1")]
pub fn a1_to_pos(selection: &str) -> Result<String, String> {
    if let Ok(selection) = Selection::from_str(selection) {
        Ok(selection.to_a1())
    } else {
        Err(format!("Invalid selection: {}", selection))
    }
}

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "a1ToSelection")]
pub fn a1_to_selection(a1: &str) -> Result<String, String> {
    if let Ok(a1) = A1(a1) {
        Ok(a1.to_selection())
    } else {
        Err(format!("Invalid a1: {}", a1))
    }
}
