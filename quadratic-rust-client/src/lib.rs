use quadratic_core::sheet_offsets::SheetOffsets;
use wasm_bindgen::prelude::*;

pub use quadratic_core::a1::js_selection::JsSelection;

pub mod date_time;
pub mod formulas;
pub mod jsexpr;
pub mod lsp;

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

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}
