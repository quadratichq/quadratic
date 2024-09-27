use std::str::FromStr;

use quadratic_core::selection::Selection;
use wasm_bindgen::prelude::*;

#[allow(non_snake_case)]
#[wasm_bindgen(js_name = "posToA1")]
pub fn pos_to_a1(x: u32, y: u32) -> String {
    Selection::pos_to_a1(x as u64, y as u64)
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
