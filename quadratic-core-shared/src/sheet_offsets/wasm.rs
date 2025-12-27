use wasm_bindgen::prelude::*;

use super::SheetOffsets;

#[wasm_bindgen]
pub struct SheetOffsetsWasm {}

#[wasm_bindgen]
impl SheetOffsetsWasm {
    #[wasm_bindgen(js_name = "load")]
    pub fn js_load(data: &str) -> Result<SheetOffsets, JsValue> {
        let sheet_offsets = serde_json::from_str(data);
        match sheet_offsets {
            Ok(sheet_offsets) => Ok(sheet_offsets),
            Err(err) => Err(JsValue::from_str(&err.to_string())),
        }
    }

    #[wasm_bindgen(js_name = "empty")]
    pub fn new_sheet_offsets() -> SheetOffsets {
        SheetOffsets::default()
    }
}
